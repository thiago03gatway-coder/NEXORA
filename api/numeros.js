import { cors } from './_gateway.js';
// Sem banco de dados não há lista de números vendidos.
export default function handler(req, res) {
  if (cors(req, res)) return;
  res.status(200).setHeader('Cache-Control', 'no-store').json({ indisponiveis: [], total: 10000 });
}
