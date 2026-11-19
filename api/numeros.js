import { getPool } from '../lib/db.js';
import { cors, onlyMethod, jsonError } from '../lib/http.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (!onlyMethod(req, res, 'GET')) return;
  try {
    const campaignId = String(req.query.campanha || process.env.CAMPAIGN_ID || 'nexora-games-2026');
    const pool = getPool();
    const result = await pool.query(
      `SELECT number FROM nexora_campaign_numbers
       WHERE campaign_id=$1 AND (status='sold' OR (status='reserved' AND expires_at > NOW()))
       ORDER BY number`, [campaignId]
    );
    return res.status(200).json({ indisponiveis: result.rows.map(r => Number(r.number)), total: 10000 });
  } catch (error) { console.error('NEXORA numbers:', error); return jsonError(res, error); }
}
