import { getPool } from '../lib/db.js';
import { cors, onlyMethod, jsonError } from '../lib/http.js';
import { urusRequest, cents, cpfHash } from '../lib/urus.js';
import { reserveOrder, releaseOrder } from '../lib/orders.js';

function parseUtm(body) {
  const result = { ...(body.utmCampos || {}) };
  if (typeof body.utm === 'string') {
    for (const [key, value] of new URLSearchParams(body.utm)) if (!result[key]) result[key] = value;
  }
  return result;
}

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (!onlyMethod(req, res, 'POST')) return;
  let orderId;
  try {
    const b = req.body || {};
    const campaignId = String(process.env.CAMPAIGN_ID || 'nexora-games-2026');
    const name = String(b.nome || '').trim().replace(/\s+/g, ' ');
    const email = String(b.email || '').trim().toLowerCase();
    const cpf = String(b.cpf || '').replace(/\D/g, '');
    const phone = String(b.telefone || '').replace(/\D/g, '');
    const numbers = Array.isArray(b.numeros) ? [...new Set(b.numeros.map(Number))].sort((a, z) => a-z) : [];
    const amountCents = cents(b.valor);
    const unitCents = cents(process.env.PRICE_PER_NUMBER || '0.99');
    const eventId = String(b.evento_id || '').slice(0, 120);
    const cpfValido = (() => {
      if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
      for (let t = 9; t < 11; t++) {
        let sum = 0;
        for (let i = 0; i < t; i++) sum += Number(cpf[i]) * (t + 1 - i);
        if (((sum * 10) % 11) % 10 !== Number(cpf[t])) return false;
      }
      return true;
    })();
    if (name.length < 5 || !email.includes('@') || !cpfValido || phone.length < 10) {
      return res.status(422).json({ mensagem: 'Confira nome, e-mail, CPF e telefone.' });
    }
    if (!numbers.length || numbers.length !== Number(b.quantidade) || numbers.some(n => !Number.isInteger(n) || n < 0 || n > 9999)) {
      return res.status(422).json({ mensagem: 'A seleção de números é inválida. Atualize a página e tente novamente.' });
    }
    if (numbers.length !== (Array.isArray(b.numeros) ? b.numeros.length : 0)) return res.status(422).json({ mensagem: 'Há números repetidos na seleção.' });
    if (amountCents < 100 || amountCents !== numbers.length * unitCents) {
      return res.status(422).json({ mensagem: 'O valor da compra não confere com a quantidade de números.' });
    }
    if (!eventId) return res.status(422).json({ mensagem: 'Não foi possível gerar o identificador de rastreamento. Atualize a página.' });

    const utm = parseUtm(b);
    const hash = await cpfHash(cpf);
    orderId = await reserveOrder({ campaignId, name, email, phone, cpfHash: hash, amountCents, numbers, eventId, utm });

    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
    const userAgent = String(b.user_agent || req.headers['user-agent'] || '').slice(0, 500);
    const description = `NEXORA GAMES - ${numbers.length} ${numbers.length === 1 ? 'número' : 'números'}`;
    const charge = await urusRequest('/charge', {
      method: 'POST',
      body: JSON.stringify({
        valor: amountCents / 100,
        nome: name,
        email,
        cpf,
        telefone: phone,
        descricao: description,
        produto_id: 0,
        itens: [{ id: campaignId, nome: description, quantidade: numbers.length, preco_unitario: amountCents / 100 / numbers.length }],
        utm_source: utm.utm_source || '',
        utm_medium: utm.utm_medium || '',
        utm_campaign: utm.utm_campaign || '',
        utm_content: utm.utm_content || '',
        utm_term: utm.utm_term || '',
        src: utm.src || '',
        sck: utm.sck || '',
        fbp: String(b.fbp || ''),
        fbc: String(b.fbc || ''),
        evento_id: eventId,
        ip,
        user_agent: userAgent
      })
    });

    if (!charge.pix_code || !charge.venda_id) throw new Error('A UrusPay não retornou venda_id e pix_code.');
    if (charge.valor != null && cents(charge.valor) !== amountCents) throw new Error('O valor retornado pela UrusPay não confere com o pedido.');
    const expiresAt = charge.expira_em ? new Date(charge.expira_em) : new Date(Date.now() + 15 * 60000);
    const pool = getPool();
    await pool.query(
      `UPDATE nexora_orders SET venda_id=$2,correlation_id=$3,pix_code=$4,qr_code_url=$5,check_status_url=$6,
       tracking=$7::jsonb,status='pending',expires_at=$8,updated_at=NOW() WHERE id=$1`,
      [orderId, String(charge.venda_id), charge.correlation_id || null, charge.pix_code, charge.qr_code_url || null,
       charge.check_status_url || null, JSON.stringify(charge.rastreamento || {}), Number.isNaN(expiresAt.getTime()) ? null : expiresAt.toISOString()]
    );
    return res.status(200).json({
      transacaoId: orderId,
      pixCopiaECola: charge.pix_code,
      qrCodeImagem: charge.qr_code_url || null,
      status: 'aguardando',
      valor: amountCents / 100,
      expiraEm: charge.expira_em || null,
      eventoId: eventId,
      rastreamento: charge.rastreamento || null,
      vendaId: String(charge.venda_id)
    });
  } catch (error) {
    if (orderId) await releaseOrder(orderId, 'failed').catch(() => {});
    if (error.code === 'NUMBERS_BUSY') return res.status(409).json({ mensagem: error.message, numerosIndisponiveis: error.unavailable || [] });
    console.error('NEXORA create PIX:', {
      message: error?.message,
      httpStatus: error?.httpStatus,
      providerStatus: error?.providerStatus,
      providerBody: error?.providerBody
    });
    return jsonError(res, error, error.httpStatus && error.httpStatus < 500 ? error.httpStatus : 502);
  }
}
