// Sem banco de dados não há lista de números vendidos.
export default function handler(req, res) {
  res.status(200).setHeader('Cache-Control', 'no-store').json({ indisponiveis: [], total: 10000 });
}
