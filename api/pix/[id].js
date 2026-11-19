import { getPool } from '../../lib/db.js';
import { cors, onlyMethod, jsonError } from '../../lib/http.js';
import { urusRequest, cents } from '../../lib/urus.js';
import { markPaid, releaseOrder } from '../../lib/orders.js';

function roletasFor(quantity) {
  if (quantity >= 900) return 10;
  if (quantity >= 400) return 3;
  if (quantity >= 200) return 1;
  return 0;
}

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (!onlyMethod(req, res, 'GET')) return;
  try {
    const id = String(req.query.id || '');
    const pool = getPool();
    const found = await pool.query('SELECT * FROM nexora_orders WHERE id=$1', [id]);
    if (!found.rowCount) return res.status(404).json({ mensagem: 'Pedido não encontrado.' });
    let order = found.rows[0];
    if (order.status === 'paid') return res.status(200).json({ status: 'pago', nome: order.buyer_name, valorPago: order.amount_cents / 100, transacaoId: order.id, numerosConfirmados: order.numbers, eventoId: order.event_id, roletas: roletasFor(order.quantity), paidAt: order.paid_at });
    if (['cancelled','expired','refunded','failed'].includes(order.status)) {
      const mapped = order.status === 'cancelled' ? 'cancelado' : order.status === 'refunded' ? 'estornado' : order.status === 'failed' ? 'falhou' : 'expirado';
      return res.status(200).json({ status: mapped });
    }
    if (!order.venda_id) return res.status(200).json({ status: 'aguardando' });

    const gateway = await urusRequest(`/status/${encodeURIComponent(order.venda_id)}`, { method: 'GET' });
    const paid = gateway.pago === true || String(gateway.status || '').toLowerCase() === 'paid';
    if (paid) {
      if (gateway.valor != null && cents(gateway.valor) !== order.amount_cents) {
        console.error('NEXORA amount mismatch', { order: order.id, expected: order.amount_cents, actual: cents(gateway.valor) });
        return res.status(409).json({ mensagem: 'O valor confirmado pelo gateway diverge do pedido. A confirmação foi bloqueada para verificação.' });
      }
      order = await markPaid(order.id, gateway.pago_em || null);
      return res.status(200).json({ status: 'pago', nome: order.buyer_name, valorPago: order.amount_cents / 100, transacaoId: order.id, numerosConfirmados: order.numbers, eventoId: order.event_id, roletas: roletasFor(order.quantity), paidAt: gateway.pago_em || new Date().toISOString() });
    }
    const status = String(gateway.status || 'pending').toLowerCase();
    if (status === 'cancelled' || status === 'refunded' || status === 'expired') {
      await releaseOrder(order.id, status === 'cancelled' ? 'cancelled' : status === 'refunded' ? 'refunded' : 'expired');
      return res.status(200).json({ status: status === 'cancelled' ? 'cancelado' : status === 'refunded' ? 'estornado' : 'expirado' });
    }
    return res.status(200).json({ status: 'aguardando' });
  } catch (error) {
    console.error('NEXORA check status:', error);
    if (error.code === 'RESERVATION_MISMATCH') return res.status(409).json({ mensagem: error.message, status: 'revisao_manual' });
    return jsonError(res, error, error.httpStatus && error.httpStatus < 500 ? error.httpStatus : 502);
  }
}
