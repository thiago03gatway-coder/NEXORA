import { urus, responder } from '../_urus.js';

const MAPA = { paid: 'pago', pending: 'pendente', cancelled: 'cancelado', refunded: 'estornado' };

export default async function handler(req, res) {
  if (req.method !== 'GET') return responder(res, 405, { mensagem: 'Método não permitido.' });
  const id = String(req.query.id || '');
  if (!/^\d{1,20}$/.test(id)) return responder(res, 400, { mensagem: 'Identificador inválido.' });
  try {
    const d = await urus('/status/' + id);
    const pago = d.pago === true || d.status === 'paid';
    return responder(res, 200, {
      status: pago ? 'pago' : (MAPA[d.status] || 'pendente'),
      transacaoId: id,
      valorPago: pago ? Number(d.valor) : null
    });
  } catch (e) {
    return responder(res, e.status || 500, { mensagem: e.message });
  }
}
