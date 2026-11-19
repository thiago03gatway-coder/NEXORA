import { getPool } from '../../lib/db.js';
import { cors, onlyMethod, jsonError } from '../../lib/http.js';
import { cpfHash } from '../../lib/urus.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (!onlyMethod(req, res, 'POST')) return;
  try {
    const cpf = String(req.body?.cpf || '').replace(/\D/g, '');
    if (cpf.length !== 11) return res.status(422).json({ mensagem: 'CPF inválido.' });
    const campaignId = String(req.body?.campanhaId || process.env.CAMPAIGN_ID || 'nexora-games-2026');
    const hash = await cpfHash(cpf);
    const pool = getPool();
    const result = await pool.query(
      `SELECT DISTINCT n.number FROM nexora_campaign_numbers n
       JOIN nexora_orders o ON o.id=n.order_id
       WHERE n.campaign_id=$1 AND o.cpf_hash=$2 AND o.status='paid' AND n.status='sold'
       ORDER BY n.number`, [campaignId, hash]
    );
    return res.status(200).json({ numeros: result.rows.map(r => Number(r.number)) });
  } catch (error) { console.error('NEXORA lookup:', error); return jsonError(res, error); }
}
