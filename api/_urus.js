// Utilitários compartilhados (arquivos que começam com _ não viram rota na Vercel)
export const BASE = 'https://uruspaypagamentos.com/api/v1';

export function chave() {
  const k = process.env.URUSPAY_API_KEY;
  if (!k) { const e = new Error('URUSPAY_API_KEY não configurada na Vercel.'); e.status = 500; throw e; }
  return k;
}

export async function urus(path, opts = {}) {
  const r = await fetch(BASE + path, {
    ...opts,
    headers: { Authorization: 'Bearer ' + chave(), 'Content-Type': 'application/json', ...(opts.headers || {}) },
    signal: AbortSignal.timeout(20000)
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.ok === false) {
    const msg = data.erro || data.mensagem || data.error || data.message || ('UrusPay respondeu HTTP ' + r.status);
    const e = new Error(String(msg).slice(0, 200)); e.status = 502; throw e;
  }
  return data;
}

export function responder(res, status, corpo) {
  res.status(status).setHeader('Cache-Control', 'no-store').json(corpo);
}
