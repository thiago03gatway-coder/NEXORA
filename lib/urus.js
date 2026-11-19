import { createHash } from 'node:crypto';
const BASE = 'https://uruspaypagamentos.com/api/v1';

export async function urusRequest(path, options = {}) {
  const key = process.env.URUSPAY_API_KEY;
  if (!key) throw new Error('URUSPAY_API_KEY não configurada na Vercel.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(BASE + path, {
      ...options,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {})
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      const err = new Error(data.mensagem || data.message || data.error || `UrusPay respondeu HTTP ${response.status}`);
      err.httpStatus = response.status;
      throw err;
    }
    return data;
  } finally { clearTimeout(timer); }
}

export function cents(value) { return Math.round(Number(value) * 100); }
export function cpfHash(cpf) {
  return createHash('sha256').update(String(cpf).replace(/\D/g, '')).digest('hex');
}
