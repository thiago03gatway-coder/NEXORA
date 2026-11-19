export function cors(req, res) {
  const origin = req.headers.origin || '';
  const allowed = (process.env.ALLOWED_ORIGINS || '*').split(',').map(x => x.trim()).filter(Boolean);
  const ok = allowed.includes('*') || allowed.includes(origin);
  if (ok) res.setHeader('Access-Control-Allow-Origin', allowed.includes('*') ? '*' : origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(204).end(); return true; }
  if (!ok) { res.status(403).json({ mensagem: 'Origem não autorizada.' }); return true; }
  return false;
}

export function jsonError(res, error, status = 500) {
  const message = error?.publicMessage || error?.message || 'Erro interno.';
  return res.status(status).json({ mensagem: message });
}

export function onlyMethod(req, res, method) {
  if (req.method !== method) { res.setHeader('Allow', method + ', OPTIONS'); res.status(405).json({ mensagem: 'Método não permitido.' }); return false; }
  return true;
}
