// Utilitários compartilhados (arquivos com _ no começo não viram rota na Vercel)

// >>> COLE AQUI a "Encrypted URL" do painel da Duttyfy (ou use a variável DUTTYFY_PIX_URL_ENCRYPTED na Vercel).
const URL_DUTTYFY = 'https://www.links-pagamentos.online/api-pix/qp_Q4XL9IImg9cVt9G2xG5qu6OHQi0VwI9gDsJR2a_a3W209JPm_P4MGdzD6Bpf9JN9_-WnAN2uCajCWpPey5w';

export function urlGateway() {
  const u = process.env.DUTTYFY_PIX_URL_ENCRYPTED || URL_DUTTYFY;
  if (!u || u.startsWith('COLE_AQUI')) {
    const e = new Error('Encrypted URL da Duttyfy não configurada.'); e.status = 500; throw e;
  }
  return u;
}

const espera = ms => new Promise(r => setTimeout(r, ms));

// POST com retry (1s, 2s) apenas em erro 5xx/rede. Nunca repete em 4xx.
export async function criarCobranca(corpo) {
  const url = urlGateway();
  let ultimo;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo), signal: AbortSignal.timeout(8000)
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) return d;
      const msg = d.message || d.error || d.mensagem || ('Gateway respondeu HTTP ' + r.status);
      const e = new Error(String(msg).slice(0, 200)); e.status = 502; e.http = r.status;
      if (r.status < 500) throw e;           // 4xx: não repete
      ultimo = e;
    } catch (e) {
      if (e.http && e.http < 500) throw e;
      ultimo = e.http ? e : Object.assign(new Error('Sem resposta do gateway de pagamento.'), { status: 502 });
    }
    if (i < 2) await espera(1000 * 2 ** i);
  }
  throw ultimo;
}

export async function consultarCobranca(transactionId) {
  const r = await fetch(urlGateway() + '?transactionId=' + encodeURIComponent(transactionId), { signal: AbortSignal.timeout(10000) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(d.message || d.error || ('Gateway respondeu HTTP ' + r.status)); e.status = 502; throw e; }
  return d;
}

// CORS: necessário quando o HTML fica na Hydra e o backend na Vercel.
// Opcional: ALLOWED_ORIGINS=https://meusite.com,https://outro.com  (vazio = qualquer origem)
export function cors(req, res) {
  const lista = (process.env.ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean);
  const o = req.headers.origin;
  if (!lista.length) res.setHeader('Access-Control-Allow-Origin', '*');
  else if (o && lista.includes(o)) { res.setHeader('Access-Control-Allow-Origin', o); res.setHeader('Vary', 'Origin'); }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return true; }
  return false;
}

export function responder(res, status, corpo) {
  res.status(status).setHeader('Cache-Control', 'no-store').json(corpo);
}
