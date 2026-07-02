import express from 'express';
import { callBot, parseOrder, parseImageRequest, cleanResponse, detectName } from './lib/bot.js';
import { sendText, sendImage, sendAudio, isGroup, extractPhone, checkInstance } from './lib/evolution.js';
import {
  getConversation, saveConversation, listConversations, deleteConversation,
  getProducts, saveProducts, addOrder, getOrders, removeOrder
} from './lib/storage.js';

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ── Estado de pausa por telefone ──────────────────────────
const pausedPhones = new Set();

// ── Configurações da Iara — carrega do env para sobreviver a restarts ──
let botConfig = {
  nome: process.env.BOT_NOME || 'Iara',
  negocio: process.env.BOT_NEGOCIO || 'Tupy Carrocerias',
  instrucoes: process.env.BOT_INSTRUCOES || 'Seja simpatica, objetiva e profissional. Precos sempre sob consulta: colete modelo do caminhao e cidade antes de fechar o pedido de orcamento.',
};

// ── WEBHOOK ───────────────────────────────────────────────
app.post('/api/webhook', async (req, res) => {
  try {
    const payload = req.body;
    if (payload.event !== 'messages.upsert') return res.json({ ok: true });

    const data = payload.data;
    if (!data) return res.json({ ok: true });
    const { key, message, pushName } = data;

    if (key?.fromMe) return res.json({ ok: true });
    if (isGroup(key?.remoteJid || '')) return res.json({ ok: true });

    const text =
      message?.conversation ||
      message?.extendedTextMessage?.text ||
      message?.imageMessage?.caption || null;

    if (!text) return res.json({ ok: true });

    const phone = key.remoteJid;
    const phoneClean = extractPhone(phone);

    let conv = await getConversation(phone) || {
      phone, phoneClean, clientName: null,
      history: [], messages: [], lastMsg: '', lastTime: null,
      paused: false,
    };

    if (!conv.clientName) {
      const isFirstMsg = conv.history.filter(h => h.role === 'user').length === 0;
      if (!isFirstMsg) {
        const name = detectName(pushName, text);
        if (name) conv.clientName = name;
      }
    }

    conv.history.push({ role: 'user', content: text });
    conv.messages.push({ role: 'user', content: text, time: new Date().toISOString() });
    conv.lastMsg = text;
    conv.lastTime = new Date().toISOString();
    await saveConversation(phone, conv);

    // Se IA pausada, apenas salva a mensagem sem responder
    if (conv.paused || pausedPhones.has(phone)) {
      return res.json({ ok: true, paused: true });
    }

    const products = await getProducts();
    const response = await callBot(conv, text, products, botConfig);
    const order = parseOrder(response);
    const imgReq = parseImageRequest(response);
    const clean = cleanResponse(response);

    conv.history.push({ role: 'assistant', content: response });
    conv.messages.push({ role: 'bot', content: clean, time: new Date().toISOString() });
    conv.lastMsg = `${botConfig.nome}: ${clean.slice(0, 50)}`;
    conv.lastTime = new Date().toISOString();
    await saveConversation(phone, conv);

    if (order?.tipo === 'pedido') {
      const detalhes = [];
      if (order.modalidade) detalhes.push(`Modalidade: ${order.modalidade}`);
      if (order.valor_total) detalhes.push(`Total: R$${Number(order.valor_total).toFixed(2)}`);
      if (order.endereco) detalhes.push(`Endereco: ${order.endereco}`);
      if (order.obs) detalhes.push(order.obs);
      await addOrder({
        id: Date.now().toString(),
        client: conv.clientName || phoneClean,
        phone: phoneClean,
        produto: order.produto,
        qtd: order.quantidade || 1,
        obs: detalhes.join(' | '),
        time: new Date().toISOString(),
        status: 'novo',
      });
    }

    await sendText(phone, clean);

    if (imgReq?.tipo === 'imagem') {
      const prod = products.find(p =>
        imgReq.produto.toLowerCase().includes(p.nome.toLowerCase()) ||
        p.nome.toLowerCase().includes(imgReq.produto.toLowerCase())
      );
      if (prod?.imagem) await sendImage(phone, prod.imagem, prod.nome);
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('[webhook] Erro:', err.message);
    return res.json({ ok: false, error: err.message });
  }
});

// ── CONVERSAS ─────────────────────────────────────────────
app.get('/api/conversations', async (req, res) => {
  try { res.json(await listConversations()); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/conversations', async (req, res) => {
  const { phone } = req.query;
  if (!phone) return res.status(400).json({ error: 'phone obrigatório' });
  await deleteConversation(decodeURIComponent(phone));
  res.json({ ok: true });
});

// ── PAUSAR / RETOMAR IA ────────────────────────────────────
app.post('/api/pause', async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone obrigatório' });
  const conv = await getConversation(phone);
  if (!conv) return res.status(404).json({ error: 'conversa não encontrada' });
  conv.paused = !conv.paused;
  await saveConversation(phone, conv);
  res.json({ ok: true, paused: conv.paused });
});

// ── ENVIO MANUAL (texto) ───────────────────────────────────
app.post('/api/send', async (req, res) => {
  const { phone, text } = req.body;
  if (!phone || !text) return res.status(400).json({ error: 'phone e text obrigatórios' });
  try {
    await sendText(phone, text);
    const conv = await getConversation(phone);
    if (conv) {
      conv.messages.push({ role: 'bot', content: text, time: new Date().toISOString(), manual: true });
      conv.history.push({ role: 'assistant', content: text });
      conv.lastMsg = `[Manual] ${text.slice(0, 40)}`;
      conv.lastTime = new Date().toISOString();
      await saveConversation(phone, conv);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── ENVIO DE IMAGEM ────────────────────────────────────────
app.post('/api/send-image', async (req, res) => {
  const { phone, imageBase64, caption } = req.body;
  if (!phone || !imageBase64) return res.status(400).json({ error: 'phone e imageBase64 obrigatórios' });
  try {
    await sendImage(phone, imageBase64, caption || '');
    const conv = await getConversation(phone);
    if (conv) {
      conv.messages.push({ role: 'bot', content: `[Imagem enviada] ${caption || ''}`, time: new Date().toISOString(), manual: true, type: 'image', imageBase64 });
      conv.lastMsg = '[Imagem]';
      conv.lastTime = new Date().toISOString();
      await saveConversation(phone, conv);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── ENVIO DE ÁUDIO ─────────────────────────────────────────
app.post('/api/send-audio', async (req, res) => {
  const { phone, audioBase64 } = req.body;
  if (!phone || !audioBase64) return res.status(400).json({ error: 'phone e audioBase64 obrigatórios' });
  try {
    await sendAudio(phone, audioBase64);
    const conv = await getConversation(phone);
    if (conv) {
      conv.messages.push({ role: 'bot', content: '[Áudio enviado]', time: new Date().toISOString(), manual: true, type: 'audio' });
      conv.lastMsg = '[Áudio]';
      conv.lastTime = new Date().toISOString();
      await saveConversation(phone, conv);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── CONFIGURAÇÕES DA IARA ──────────────────────────────────
app.get('/api/bot-config', (req, res) => res.json(botConfig));

app.post('/api/bot-config', (req, res) => {
  const { nome, negocio, instrucoes } = req.body;
  if (nome) botConfig.nome = nome;
  if (negocio) botConfig.negocio = negocio;
  if (instrucoes !== undefined) botConfig.instrucoes = instrucoes;
  res.json({ ok: true, config: botConfig });
});

// ── PRODUTOS ──────────────────────────────────────────────
app.get('/api/products', async (req, res) => res.json(await getProducts()));

app.post('/api/products', async (req, res) => {
  const { products } = req.body;
  if (!Array.isArray(products)) return res.status(400).json({ error: 'products deve ser array' });
  await saveProducts(products);
  res.json({ ok: true });
});

// ── PEDIDOS (ORÇAMENTOS) ──────────────────────────────────
app.get('/api/orders', async (req, res) => res.json(await getOrders()));

app.delete('/api/orders', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id obrigatório' });
  await removeOrder(id);
  res.json({ ok: true });
});

// ── STATUS ────────────────────────────────────────────────
app.get('/api/status', async (req, res) => {
  const connected = await checkInstance();
  res.json({ connected });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`[Iara] Servidor rodando na porta ${PORT}`));
