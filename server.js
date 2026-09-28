const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const port = Number(process.env.PORT || 3000);
const now = () => new Date().toISOString();

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const channels = [
  { id: 'shopify', name: 'Shopify', provider: 'Shopify', logo: 'S', status: 'DISCONNECTED', connected: false, permissions: [], lastSyncAt: null, lastActivity: null, productsSynced: 0, ordersSynced: 0, stockSynced: 0, recentErrors: [] },
  { id: 'mercadolivre', name: 'Mercado Livre', provider: 'Mercado Livre', logo: 'ML', status: 'DISCONNECTED', connected: false, permissions: [], lastSyncAt: null, lastActivity: null, productsSynced: 0, ordersSynced: 0, stockSynced: 0, recentErrors: [] },
  { id: 'shopee', name: 'Shopee', provider: 'Shopee', logo: 'SH', status: 'DISCONNECTED', connected: false, permissions: [], lastSyncAt: null, lastActivity: null, productsSynced: 0, ordersSynced: 0, stockSynced: 0, recentErrors: [] },
  { id: 'dsers', name: 'DSers / Dropshipping', provider: 'DSers', logo: 'DS', status: 'DISCONNECTED', connected: false, permissions: [], lastSyncAt: null, lastActivity: null, productsSynced: 0, ordersSynced: 0, stockSynced: 0, recentErrors: [] }
];
const products = [];
const operations = [];
const approvals = [];
const connectors = channels.map((channel) => ({ id: `connector_${channel.id}`, channelId: channel.id, name: `${channel.name} Connector`, provider: channel.provider, version: '1.0.0', capabilities: ['catalog_sync', 'price_sync', 'stock_sync'], status: 'DISCONNECTED', webhooksAvailable: false, api: 'DADO NÃO DISPONÍVEL', lastUsedAt: null, knownLimits: [], errors: [] }));

function result(data, res, status = 200) { return res.status(status).json({ success: true, data }); }
function failure(message, res, status = 400, extra = {}) { return res.status(status).json({ success: false, error: message, ...extra }); }
function operation(agent, task, status = 'CONCLUIDO', details = {}) {
  const item = { id: `op_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, agent, task, status, startedAt: now(), completedAt: status === 'CONCLUIDO' ? now() : null, result: status === 'CONCLUIDO' ? details.result || 'Operação concluída' : null, error: status === 'FALHOU' ? details.error || 'Erro não especificado' : null, source: details.source || 'ARTÈL24H', approvalRequired: Boolean(details.approvalRequired), channelId: details.channelId || null, productId: details.productId || null };
  operations.unshift(item);
  return item;
}

app.get('/api/health', (req, res) => result({ status: 'ok', app: process.env.APP_NAME || 'ARTÈL24H', timestamp: now() }, res));
app.get('/api/dashboard', (req, res) => result({ channels, products, operations: operations.slice(0, 20), approvals }, res));
app.get('/api/channels', (req, res) => result(channels, res));
app.post('/api/channels/:id/connect', (req, res) => {
  const channel = channels.find((item) => item.id === req.params.id);
  if (!channel) return failure('Canal não encontrado', res, 404);
  channel.status = 'AWAITING_AUTH';
  channel.connected = false;
  channel.lastActivity = now();
  const approval = { id: `approval_${Date.now()}`, type: 'CHANNEL_AUTHORIZATION', channelId: channel.id, action: 'Autorizar conexão', status: 'PENDING', createdAt: now(), reason: 'A autorização externa ainda não foi confirmada.' };
  approvals.unshift(approval);
  operation('HUB MULTICANAL', `Solicitar conexão: ${channel.name}`, 'AGUARDANDO APROVAÇÃO', { channelId: channel.id, approvalRequired: true, result: 'Aguardando autorização real do provedor.' });
  return result({ channel, approval }, res, 202);
});
app.post('/api/approvals/:id/resolve', (req, res) => {
  const approval = approvals.find((item) => item.id === req.params.id);
  if (!approval) return failure('Aprovação não encontrada', res, 404);
  const status = String(req.body.status || '').toUpperCase();
  if (!['APPROVED', 'REJECTED'].includes(status)) return failure('status deve ser APPROVED ou REJECTED', res);
  approval.status = status; approval.resolvedAt = now();
  const channel = channels.find((item) => item.id === approval.channelId);
  if (channel && status === 'APPROVED') {
    // Aprovação da aplicação não prova autenticação do provedor. O canal continua aguardando teste real.
    channel.status = 'AWAITING_AUTH';
    channel.lastActivity = now();
    operation('VERIFICADOR', `Validar credenciais: ${channel.name}`, 'AGUARDANDO', { channelId: channel.id, result: 'Aguardando credenciais e resposta real da API.' });
  }
  if (channel && status === 'REJECTED') { channel.status = 'DISCONNECTED'; channel.connected = false; }
  return result({ approval, channel }, res);
});
app.post('/api/channels/:id/validate', (req, res) => {
  const channel = channels.find((item) => item.id === req.params.id);
  if (!channel) return failure('Canal não encontrado', res, 404);
  return failure('Validação real indisponível: configure o conector e as credenciais do provedor antes de ativar o canal.', res, 409, { status: 'DADO NÃO DISPONÍVEL' });
});
app.get('/api/products', (req, res) => result(products, res));
app.post('/api/products', (req, res) => {
  const body = req.body || {};
  if (!body.name || !body.sku) return failure('name e sku são obrigatórios', res);
  const product = { id: `prod_${Date.now()}`, sku: body.sku, name: body.name, description: body.description || '', category: body.category || '', supplier: body.supplier || 'DADO NÃO DISPONÍVEL', origin: body.origin || 'DADO NÃO DISPONÍVEL', cost: body.cost ?? null, price: body.price ?? null, margin: body.margin ?? null, currency: body.currency || 'BRL', stock: body.stock ?? null, availability: body.availability || 'DADO NÃO DISPONÍVEL', markets: body.markets || [], channelsPublished: [], status: 'DRAFT', source: body.source || 'Entrada manual', createdAt: now(), updatedAt: now() };
  products.unshift(product);
  operation('CATÁLOGO CENTRAL', `Cadastrar produto: ${product.name}`, 'CONCLUIDO', { productId: product.id, result: 'Produto criado como rascunho.' });
  return result(product, res, 201);
});
app.get('/api/operations', (req, res) => result(operations, res));
app.get('/api/approvals', (req, res) => result(approvals, res));
app.get('/api/connectors', (req, res) => result(connectors, res));

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.use((error, req, res, next) => { console.error(error); return failure('Erro interno do servidor', res, 500); });
app.listen(port, () => console.log(`ARTÈL24H disponível em http://localhost:${port}`));
