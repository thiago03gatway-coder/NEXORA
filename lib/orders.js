import { getPool } from './db.js';

export async function reserveOrder({ campaignId, name, email, phone, cpfHash, amountCents, numbers, eventId, utm }) {
  const pool = getPool();
  const client = await pool.connect();
  const reservationMinutes = Math.max(5, Math.min(60, Number(process.env.RESERVATION_MINUTES || 15)));
  try {
    await client.query('BEGIN');
    // Libera reservas cujo prazo terminou, sem tocar em números já vendidos.
    await client.query(
      `UPDATE nexora_campaign_numbers
       SET status='released', expires_at=NULL, updated_at=NOW()
       WHERE campaign_id=$1 AND status='reserved' AND expires_at <= NOW()`,
      [campaignId]
    );
    await client.query(
      `UPDATE nexora_orders
       SET status='expired', updated_at=NOW()
       WHERE campaign_id=$1 AND status='pending'
         AND NOT EXISTS (
           SELECT 1 FROM nexora_campaign_numbers n
           WHERE n.order_id=nexora_orders.id AND n.status='reserved'
         )`,
      [campaignId]
    );
    const orderResult = await client.query(
      `INSERT INTO nexora_orders
       (campaign_id,buyer_name,buyer_email,buyer_phone,cpf_hash,amount_cents,quantity,numbers,event_id,utm,status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'creating') RETURNING id`,
      [campaignId, name, email, phone, cpfHash, amountCents, numbers.length, numbers, eventId, JSON.stringify(utm || {})]
    );
    const orderId = orderResult.rows[0].id;
    const reserved = await client.query(
      `INSERT INTO nexora_campaign_numbers (campaign_id,number,order_id,status,expires_at)
       SELECT $1, n, $2, 'reserved', NOW() + ($4::text || ' minutes')::interval
       FROM unnest($3::int[]) AS n
       ON CONFLICT (campaign_id,number) DO UPDATE
       SET order_id=EXCLUDED.order_id,status='reserved',expires_at=EXCLUDED.expires_at,updated_at=NOW()
       WHERE nexora_campaign_numbers.status='released'
       RETURNING number`,
      [campaignId, orderId, numbers, reservationMinutes]
    );
    if (reserved.rowCount !== numbers.length) {
      const reservedSet = new Set(reserved.rows.map(row => Number(row.number)));
      const unavailable = numbers.filter(number => !reservedSet.has(number));
      const err = new Error('Um ou mais números foram reservados por outra pessoa. Atualize a seleção e tente novamente.');
      err.code = 'NUMBERS_BUSY';
      err.unavailable = unavailable;
      throw err;
    }
    await client.query('COMMIT');
    return orderId;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); }
}

export async function releaseOrder(orderId, status = 'failed') {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`UPDATE nexora_orders SET status=$2,updated_at=NOW() WHERE id=$1`, [orderId, status]);
    await client.query(`UPDATE nexora_campaign_numbers SET status='released',expires_at=NULL,updated_at=NOW() WHERE order_id=$1 AND status='reserved'`, [orderId]);
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; }
  finally { client.release(); }
}

export async function markPaid(orderId, gatewayPaidAt) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query('SELECT * FROM nexora_orders WHERE id=$1 FOR UPDATE', [orderId]);
    if (!found.rowCount) throw new Error('Pedido não encontrado.');
    const order = found.rows[0];
    if (order.status !== 'paid') {
      const ownership = await client.query(
        `SELECT COUNT(*)::int AS count FROM nexora_campaign_numbers
         WHERE order_id=$1 AND status IN ('reserved','sold')`, [orderId]
      );
      if (Number(ownership.rows[0].count) !== Number(order.quantity)) {
        const err = new Error('Pagamento aprovado, mas a reserva dos números precisa de conferência manual.');
        err.code = 'RESERVATION_MISMATCH';
        throw err;
      }
      await client.query(`UPDATE nexora_orders SET status='paid',paid_at=COALESCE($2::timestamptz,NOW()),updated_at=NOW() WHERE id=$1`, [orderId, gatewayPaidAt || null]);
      await client.query(`UPDATE nexora_campaign_numbers SET status='sold',expires_at=NULL,updated_at=NOW() WHERE order_id=$1 AND status='reserved'`, [orderId]);
    }
    await client.query('COMMIT');
    return order;
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; }
  finally { client.release(); }
}
