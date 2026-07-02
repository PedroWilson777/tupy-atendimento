import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export function buildSystemPrompt(conv, products, config = {}) {
  const catalog = products.map(p => {
    const preco = Number(p.preco) > 0 ? `Preco: R$${Number(p.preco).toFixed(2)}` : 'Preco: sob consulta (orcamento)';
    return `- ${p.nome} | Cat: ${p.cat} | ${preco} | ${p.desc} | ${p.estoque}`;
  }).join('\n');

  const ctx = conv.clientName
    ? `O cliente se chama ${conv.clientName}. Use o nome ao responder.`
    : 'Ainda nao sabemos o nome do cliente.';

  const nome = config.nome || 'Iara';
  const negocio = config.negocio || 'Tupy Carrocerias';
  const instrucoes = config.instrucoes || '';

  return `Voce e ${nome}, assistente virtual da ${negocio}, fabrica de carrocerias para caminhoes.

CONTEXTO: ${ctx}
${instrucoes ? `\nINSTRUCOES ESPECIAIS: ${instrucoes}\n` : ''}
FLUXO DE ATENDIMENTO (simples e curto):
1. Primeira mensagem: cumprimente e pergunte se a pessoa precisa de alguma coisa. Exemplo: "Ola, sou a ${nome} da ${negocio}. Precisa de alguma coisa?".
2. Quando a pessoa responder que sim: pergunte o que ela precisa. Exemplo: "Claro! O que voce precisa?".
3. Responda de forma curta e direta usando o catalogo abaixo. Nao peca o nome do cliente e nao adicione etapas alem dessas.
4. Orcamentos: os precos das carrocerias sao sob consulta. Antes de gerar o pedido de orcamento, pergunte o MODELO DO CAMINHAO (marca e modelo do chassi) e a CIDADE do cliente, mostre um resumo (carroceria, caminhao, cidade) e pergunte "Tudo certo?".
5. Fechamento: SOMENTE apos o cliente confirmar, gere o JSON do pedido. Nunca gere antes da confirmacao. Diga que a equipe da ${negocio} entrara em contato com o orcamento.

CATALOGO:
${catalog}

REGRAS ABSOLUTAS:
- ZERO emojis em todas as respostas.
- ZERO asteriscos ou qualquer marcacao Markdown.
- Texto corrido, limpo e direto.
- Para pedido de orcamento: ***{"tipo":"pedido","produto":"NOME","quantidade":1,"obs":"Caminhao: MARCA MODELO | Cidade: CIDADE"}***
- Para imagem: ###{"tipo":"imagem","produto":"NOME"}###
- Responda apenas em portugues brasileiro.`;
}

export async function callBot(conv, userMsg, products, config = {}) {
  const history = (conv.history || []).slice(-20);
  history.push({ role: 'user', content: userMsg });

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    system: buildSystemPrompt(conv, products, config),
    messages: history,
  });

  const text = response.content[0]?.text || 'Desculpe, tive um problema. Tente novamente.';
  return text;
}

export function parseOrder(text) {
  // Aceita varios formatos: ***{...}***, ```json {...} ```, ``` {...} ``` ou JSON cru com "tipo":"pedido"
  const m =
    text.match(/\*\*\*(\{[\s\S]*?\})\*\*\*/) ||
    text.match(/```json\s*(\{[\s\S]*?\})\s*```/i) ||
    text.match(/```\s*(\{[\s\S]*?\})\s*```/) ||
    text.match(/(\{[\s\S]*?"tipo"\s*:\s*"pedido"[\s\S]*?\})/);
  if (!m) return null;
  try {
    const obj = JSON.parse(m[1]);
    return obj.tipo === 'pedido' ? obj : null;
  } catch { return null; }
}

export function parseImageRequest(text) {
  const m = text.match(/###(\{.*?\})###/s);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

export function cleanResponse(text) {
  return text
    .replace(/\*\*\*\{[\s\S]*?\}\*\*\*/g, '')                       // ***{...}***
    .replace(/###\{[\s\S]*?\}###/g, '')                            // ###{...}###
    .replace(/```json\s*\{[\s\S]*?\}\s*```/gi, '')                 // ```json {...} ```
    .replace(/```\s*\{[\s\S]*?\}\s*```/g, '')                      // ``` {...} ```
    .replace(/\{[\s\S]*?"tipo"\s*:\s*"pedido"[\s\S]*?\}/g, '')     // JSON cru de pedido
    .replace(/```/g, '')                                           // crases soltas
    .replace(/\[?NOTIFICACAO PEDIDO\]?[^\n]*/gi, '')               // notificacao pedido
    .replace(/\[?NOTIFICACAO ATENDENTE\]?[^\n]*/gi, '')            // notificacao atendente
    .replace(/\n{3,}/g, '\n\n')                                    // colapsa linhas vazias
    .trim();
}

export function detectName(pushName, firstUserMsg) {
  if (pushName && pushName.length >= 2 && pushName !== 'Cliente') {
    return pushName.split(' ')[0];
  }
  const candidate = firstUserMsg.trim().split(/\s+/)[0].replace(/[^a-zA-ZÀ-ú]/g, '');
  if (candidate.length >= 2 && candidate.length <= 20) {
    return candidate.charAt(0).toUpperCase() + candidate.slice(1).toLowerCase();
  }
  return null;
}
