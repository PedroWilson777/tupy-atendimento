import { createClient } from '@supabase/supabase-js';

// Sem env vars do Supabase, roda 100% em memória (dev local)
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

let memProducts = null;
let memOrders = [];

// ── Conversas (in-memory) ──────────────────────────────────
const convMap = new Map();
const recentPhones = []; // mantém ordem por last_time

export async function getConversation(phone) {
  return convMap.get(phone) || null;
}

export async function saveConversation(phone, conv) {
  convMap.set(phone, conv);
  // mantém lista de recentes (sem duplicatas)
  const idx = recentPhones.indexOf(phone);
  if (idx !== -1) recentPhones.splice(idx, 1);
  recentPhones.unshift(phone);
}

export async function listConversations() {
  return recentPhones.slice(0, 50).map(p => convMap.get(p)).filter(Boolean);
}

export async function deleteConversation(phone) {
  convMap.delete(phone);
  const idx = recentPhones.indexOf(phone);
  if (idx !== -1) recentPhones.splice(idx, 1);
}

// ── Produtos ───────────────────────────────────────────────

export async function getProducts() {
  if (!supabase) return memProducts || getDefaultProducts();
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('id', { ascending: true });
  if (error || !data || data.length === 0) return getDefaultProducts();
  return data.map(p => ({ ...p, desc: p.description }));
}

export async function saveProducts(products) {
  if (!supabase) { memProducts = products; return; }
  const toSave = products.map(p => ({
    id: p.id,
    nome: p.nome,
    cat: p.cat,
    preco: p.preco,
    description: p.desc || p.description || '',
    estoque: p.estoque || 'Sob consulta',
    imagem: p.imagem || '',
  }));
  const { error } = await supabase.from('products').upsert(toSave);
  if (error) console.error('Erro ao salvar produtos:', error);
}

// ── Pedidos (orçamentos) ───────────────────────────────────

export async function addOrder(order) {
  if (!supabase) { memOrders.unshift(order); return; }
  const { error } = await supabase
    .from('orders')
    .insert([{
      id: order.id,
      client: order.client,
      phone: order.phone,
      produto: order.produto,
      qtd: order.qtd,
      obs: order.obs,
      status: order.status,
    }]);
  if (error) console.error('Erro ao salvar pedido:', error);
}

export async function getOrders() {
  if (!supabase) return memOrders;
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  return data || [];
}

export async function removeOrder(id) {
  if (!supabase) { memOrders = memOrders.filter(o => String(o.id) !== String(id)); return; }
  await supabase.from('orders').delete().eq('id', id);
}

// ── Produtos padrão (fallback) ──────────────────────────────

function getDefaultProducts() {
  return [
    { id: 1, nome: 'Caçamba Basculante', cat: 'Basculante', preco: 0, desc: 'Caçamba basculante reforçada para caminhões toco, truck e traçado. Chapas de alta resistência, pistão hidráulico.', estoque: 'Sob encomenda', imagem: '' },
    { id: 2, nome: 'Carroceria Graneleira', cat: 'Graneleiro', preco: 0, desc: 'Carroceria graneleira em madeira e aço para transporte de grãos e cargas a granel. Grades sobrepostas removíveis.', estoque: 'Sob encomenda', imagem: '' },
    { id: 3, nome: 'Carroceria Madeireira', cat: 'Madeireiro', preco: 0, desc: 'Carroceria madeireira com fueiros reforçados para transporte de toras e madeira bruta.', estoque: 'Sob encomenda', imagem: '' },
    { id: 4, nome: 'Carroceria Carga Seca', cat: 'Carga Seca', preco: 0, desc: 'Carroceria aberta de madeira para carga geral. Assoalho em madeira de lei, laterais removíveis.', estoque: 'Sob encomenda', imagem: '' },
    { id: 5, nome: 'Carroceria Boiadeira', cat: 'Boiadeiro', preco: 0, desc: 'Carroceria boiadeira para transporte de gado, com grades altas reforçadas e porteira traseira.', estoque: 'Sob encomenda', imagem: '' },
    { id: 6, nome: 'Baú de Alumínio', cat: 'Baú', preco: 0, desc: 'Baú de carga em alumínio para transporte protegido. Portas traseiras duplas e revestimento interno.', estoque: 'Sob encomenda', imagem: '' },
    { id: 7, nome: 'Reforma e Manutenção de Carrocerias', cat: 'Serviços', preco: 0, desc: 'Reforma completa, troca de assoalho, pintura e manutenção de carrocerias de todas as marcas.', estoque: 'Agendamento', imagem: '' },
  ];
}
