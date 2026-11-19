NEXORA GAMES — URUSPAY — PRONTO PARA VERCEL
================================================

ESTRUTURA
---------
Este ZIP já está organizado com index.html na raiz e as rotas em /api.
Importe o conteúdo inteiro deste ZIP para um repositório GitHub e conecte
esse repositório à Vercel. NÃO selecione uma subpasta como Root Directory:
a raiz do projeto é a própria pasta onde está este README.

O checkout visual foi preservado. No Vercel, a página usa automaticamente
o backend no mesmo domínio por meio de /api. Não precisa editar URL depois
do deploy.

ANTES DE PUBLICAR
-----------------
1. Revogue a chave UrusPay que foi compartilhada na conversa e gere outra.
2. Crie um banco PostgreSQL no Neon (ou outro PostgreSQL compatível).
3. Abra o SQL Editor do banco e execute TODO o conteúdo de schema.sql.
4. No projeto Vercel, vá em Settings > Environment Variables e adicione:

   URUSPAY_API_KEY       = SUA_NOVA_CHAVE_URUSPAY
   DATABASE_URL          = SUA_URL_POSTGRESQL_COM_SSL
   CAMPAIGN_ID           = nexora-games-2026
   PRICE_PER_NUMBER      = 0.99
   RESERVATION_MINUTES   = 15

   ALLOWED_ORIGINS       = https://SEU-PROJETO.vercel.app

   Se também for usar o domínio da Hydra durante o teste, acrescente o
   domínio exato separado por vírgula:
   https://SEU-PROJETO.vercel.app,https://SEU-DOMINIO-HYDRA.com

5. Salve as variáveis e faça Deploy / Redeploy.
6. Não envie a API Key para o navegador, HTML, GitHub ou este README.

TESTES DEPOIS DO DEPLOY
-----------------------
Abra:

  https://SEU-PROJETO.vercel.app/api/health

Resultado esperado:
  ok: true
  database: connected
  uruspay_key_configured: true

Depois abra:

  https://SEU-PROJETO.vercel.app/api/numeros?campanha=nexora-games-2026

Deve retornar JSON com "indisponiveis" e "total".

Só faça cobrança real depois que /api/health indicar banco conectado e chave
configurada. Gere um PIX de valor baixo e pague para validar a confirmação.

O QUE ESTÁ IMPLEMENTADO
-----------------------
- POST /api/pix cria cobrança na UrusPay.
- GET /api/pix/{id} consulta /api/v1/status/{venda_id}.
- Pago é reconhecido quando pago === true OU status === "paid".
- A confirmação verifica o valor recebido antes de marcar números como vendidos.
- PostgreSQL mantém pedidos, números vendidos e reservas temporárias.
- Reservas vencidas são liberadas no banco para evitar bloqueios permanentes.
- GET /api/numeros informa números vendidos e reservas ainda válidas.
- POST /api/numeros/consulta consulta números pagos pelo CPF (armazenado como hash).
- UTMs, fbp, fbc, evento_id, IP e user-agent são enviados à UrusPay.
- Pixel do navegador dispara Purchase com o mesmo eventID após confirmação.

IMPORTANTE SOBRE A CONFIRMAÇÃO
------------------------------
A documentação fornecida não descreve webhook. Portanto, o site confirma por
polling enquanto a página de pagamento está aberta. Não é possível garantir
confirmação automática com a página fechada sem um webhook oficial ou processo
server-side adicional da UrusPay.

IMPORTANTE SOBRE TESTES
-----------------------
O pacote foi preparado e os arquivos foram revisados estaticamente. Não é
possível validar uma cobrança real daqui: o deploy, a chave nova e a conexão
do banco precisam ser configurados na sua conta. Não considere o PIX pronto
para produção até concluir o teste de ponta a ponta.
