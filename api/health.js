import { getPool } from '../lib/db.js';
import { cors, onlyMethod, jsonError } from '../lib/http.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (!onlyMethod(req, res, 'GET')) return;
  try {
    const pool = getPool();
    await pool.query('SELECT 1');
    return res.status(200).json({
      ok: true,
      database: 'connected',
      uruspay_key_configured: Boolean(process.env.URUSPAY_API_KEY),
      campaign_id: process.env.CAMPAIGN_ID || 'nexora-games-2026'
    });
  } catch (error) {
    console.error('NEXORA health:', error);
    return jsonError(res, error, 503);
  }
}
