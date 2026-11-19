import { consultarCobranca, cors, responder } from '../_gateway.js';

const MAPA = { PENDING: 'pendente', COMPLETED: 'pago', EXPIRED: 'expirado', CANCELED: 'cancelado', CANCELLED: 'cancelado', FAILED: 'falhou', REFUNDED: 'estornado' };

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return responder(res, 405, { mensagem: 'Método não permitido.' });
  const id = String(req.query.id || '');
  if (!/^[\w-]{8,64}$/.test(id)) return responder(res, 400, { mensagem: 'Identificador inválido.' });
  try {
    const d = await consultarCobranca(id);
    const st = String(d.status || '').toUpperCase();
    return responder(res, 200, { status: MAPA[st] || 'pendente', transacaoId: id, pagoEm: d.paidAt || null });
  } catch (e) {
    return responder(res, e.status || 500, { mensagem: e.message });
  }
}
