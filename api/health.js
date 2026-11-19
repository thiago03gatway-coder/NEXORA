export default function handler(req, res) {
  res.status(200).json({ ok: true, uruspay_key_configured: !!process.env.URUSPAY_API_KEY });
}
