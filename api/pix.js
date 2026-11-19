import { urus, responder } from './_urus.js';

const PRECO = Number(process.env.PRICE_PER_NUMBER || 0.99);
const MIN = 20, MAX = 1000;
const so = v => String(v || '').replace(/\D/g, '');

export default async function handler(req, res) {
  if (req.method !== 'POST') return responder(res, 405, { mensagem: 'Método não permitido.' });
  try {
    const b = req.body && typeof req.body === 'object' ? req.body : {};
    const numeros = Array.isArray(b.numeros) ? [...new Set(b.numeros.map(Number))].filter(n => Number.isInteger(n) && n >= 0 && n < 10000) : [];
    if (numeros.length < MIN || numeros.length > MAX) return responder(res, 400, { mensagem: `Escolha entre ${MIN} e ${MAX} números.` });
    if (!b.nome || !b.email) return responder(res, 400, { mensagem: 'Nome e e-mail são obrigatórios.' });

    // O valor é SEMPRE calculado aqui, nunca confiamos no navegador.
    const valor = Math.round(numeros.length * PRECO * 100) / 100;
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const u = b.utmCampos || {};

    const d = await urus('/charge', {
      method: 'POST',
      body: JSON.stringify({
        valor,
        nome: String(b.nome).slice(0, 120),
        email: String(b.email).slice(0, 120),
        cpf: so(b.cpf),
        telefone: so(b.telefone),
        descricao: `Nexora Games - ${numeros.length} numeros`,
        itens: [{ id: 'cota', nome: 'Cota Nexora Games', quantidade: numeros.length, preco_unitario: PRECO }],
        utm_source: u.utm_source || '', utm_medium: u.utm_medium || '', utm_campaign: u.utm_campaign || '',
        utm_content: u.utm_content || '', utm_term: u.utm_term || '', src: u.src || '', sck: u.sck || '',
        fbp: b.fbp || '', fbc: b.fbc || '', evento_id: b.evento_id || '',
        ip, user_agent: String(b.user_agent || req.headers['user-agent'] || '').slice(0, 300)
      })
    });

    if (!d.venda_id || !d.pix_code) return responder(res, 502, { mensagem: 'A UrusPay não retornou o código PIX.' });
    return responder(res, 200, {
      transacaoId: String(d.venda_id),
      pixCopiaECola: d.pix_code,
      qrCodeImagem: d.qr_code_url || '',
      eventoId: (d.rastreamento && d.rastreamento.evento_id) || b.evento_id || '',
      expiraEm: d.expira_em || null,
      rastreamento: d.rastreamento || null
    });
  } catch (e) {
    return responder(res, e.status || 500, { mensagem: e.message || 'Erro ao gerar o PIX.' });
  }
}
