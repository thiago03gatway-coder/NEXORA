import { createHash } from 'node:crypto';

const BASE = 'https://uruspaypagamentos.com/api/v1';

export async function urusRequest(path, options = {}) {
  const key = process.env.URUSPAY_API_KEY;
  if (!key) {
    const err = new Error('URUSPAY_API_KEY não configurada na Vercel.');
    err.publicMessage = err.message;
    err.httpStatus = 500;
    throw err;
  }

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

    // Read as text first so we can diagnose non-JSON 500/502 responses too.
    const raw = await response.text();
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { raw };
    }

    if (!response.ok || data.ok === false) {
      const providerMessage =
        data.mensagem ||
        data.message ||
        data.error ||
        data.detail ||
        (typeof data.raw === 'string' ? data.raw.replace(/\s+/g, ' ').slice(0, 500) : '') ||
        `UrusPay respondeu HTTP ${response.status}`;

      const err = new Error(`UrusPay HTTP ${response.status}: ${providerMessage}`);
      err.httpStatus = response.status;
      err.publicMessage = `Falha na UrusPay (HTTP ${response.status}): ${providerMessage}`;
      err.providerStatus = response.status;
      err.providerBody = data;
      throw err;
    }

    return data;
  } catch (error) {
    if (error?.name === 'AbortError') {
      const err = new Error('Tempo limite ao conectar com a UrusPay após 20 segundos.');
      err.publicMessage = err.message;
      err.httpStatus = 504;
      throw err;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function cents(value) { return Math.round(Number(value) * 100); }

export function cpfHash(cpf) {
  return createHash('sha256')
    .update(String(cpf).replace(/\D/g, ''))
    .digest('hex');
}
