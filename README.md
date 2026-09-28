# ARTÈL24H — Aplicativo de Comércio Multicanal

Aplicativo web inicial do ARTÈL24H com:

- Central de Canais;
- Hub Multicanal independente;
- Catálogo Central;
- Centro de Operações;
- Aprovações explícitas;
- API local para evolução dos conectores.

## Executar localmente

Requisitos: Node.js 18 ou superior.

```bash
cp .env.example .env
npm install
npm start
```

Abra `http://localhost:3000`.

Para desenvolvimento com reinício automático:

```bash
npm run dev
```

## Estado atual e regra de verdade

Esta versão é um esqueleto funcional executável. Os conectores externos não estão configurados e todos os canais começam como `DESCONECTADA`. O botão **Conectar** registra uma solicitação de autorização, mas não finge conexão nem validação de API.

Os dados são mantidos em memória para facilitar o primeiro teste e serão perdidos ao reiniciar o processo. Para produção, substitua os repositórios em `server.js` por PostgreSQL/Prisma, configure autenticação, armazenamento seguro de credenciais e implemente cada conector em módulo separado.

## API principal

- `GET /api/health`
- `GET /api/dashboard`
- `GET /api/channels`
- `POST /api/channels/:id/connect`
- `POST /api/channels/:id/validate`
- `GET /api/products`
- `POST /api/products`
- `GET /api/operations`
- `GET /api/approvals`
- `POST /api/approvals/:id/resolve`
- `GET /api/connectors`

## Próxima camada recomendada

1. Persistência com PostgreSQL e migrations.
2. Autenticação de usuários e RBAC para OBSERVAR, ANALISAR, PREPARAR, EXECUTAR, VERIFICAR e ADMINISTRAR.
3. Gestão de segredos fora do banco.
4. Implementação de `ShopifyConnector`, `MercadoLivreConnector`, `ShopeeConnector` e `DSersConnector` em módulos independentes.
5. Verificação real por API/webhooks antes de marcar qualquer canal como conectado.
6. Filas para sincronização, retentativas autorizadas e observabilidade.
