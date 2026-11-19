import { criarCobranca, cors, responder } from './_gateway.js';

const PRECO = Number(process.env.PRICE_PER_NUMBER || 0.99);
const MIN = 20, MAX = 1000;
const so = v => String(v || '').replace(/\D/g, '');

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return responder(res, 405, { mensagem: 'Método não permitido.' });
  try {
    const b = req.body && typeof req.body === 'object' ? req.body : {};
    const numeros = Array.isArray(b.numeros) ? [...new Set(b.numeros.map(Number))].filter(n => Number.isInteger(n) && n >= 0 && n < 10000) : [];
    if (numeros.length < MIN || numeros.length > MAX) return responder(res, 400, { mensagem: `Escolha entre ${MIN} e ${MAX} números.` });

    const nome = String(b.nome || '').trim().slice(0, 120);
    const email = String(b.email || '').trim().slice(0, 120);
    const cpf = so(b.cpf), tel = so(b.telefone);
    if (!nome || !/^\S+@\S+\.\S+$/.test(email)) return responder(res, 400, { mensagem: 'Informe nome e e-mail válidos.' });
    if (cpf.length !== 11 && cpf.length !== 14) return responder(res, 400, { mensagem: 'CPF inválido.' });
    if (tel.length < 10 || tel.length > 11) return responder(res, 400, { mensagem: 'Telefone inválido (use DDD + número).' });

    // O valor é SEMPRE calculado aqui, nunca confiamos no navegador. Em centavos, inteiro.
    const amount = Math.round(numeros.length * PRECO * 100);

    const d = await criarCobranca({
      amount,
      customer: { name: nome, document: cpf, email, phone: tel },
      item: { title: `Nexora Games - ${numeros.length} numeros`, price: amount, quantity: 1 },
      paymentMethod: 'PIX',
      utm: String(b.utm || '').slice(0, 2000)
    });

    if (!d.transactionId || !d.pixCode) return responder(res, 502, { mensagem: 'O gateway não retornou o código PIX.' });
    return responder(res, 200, {
      transacaoId: String(d.transactionId),
      pixCopiaECola: d.pixCode,
      qrCodeImagem: '',                 // o site gera o QR Code a partir do pixCode
      eventoId: b.evento_id || ''
    });
  } catch (e) {
    return responder(res, e.status || 500, { mensagem: e.message || 'Erro ao gerar o PIX.' });
  }
}
