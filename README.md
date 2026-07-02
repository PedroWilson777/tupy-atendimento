# Atendimento Iara — Tupy Carrocerias

Atendimento IA via WhatsApp para a Tupy Carrocerias, com dashboard de acompanhamento em tempo real. Mesma arquitetura do atendimento Lidia (Talita Saúde).

## Stack

- **Node.js + Express** — servidor e API
- **Evolution API** — WhatsApp (webhook + envio)
- **Claude Haiku** — IA de atendimento (Iara)
- **Supabase** — produtos e pedidos de orçamento
- **Railway** — deploy (auto-deploy via GitHub)

## Como funciona

1. Cliente manda mensagem no WhatsApp → Evolution API chama `/api/webhook`
2. Iara responde usando o catálogo de carrocerias (preços sob consulta)
3. Para orçamento, a Iara coleta **modelo do caminhão** e **cidade**, confirma e gera o pedido
4. O pedido aparece no painel **Orçamentos** do dashboard
5. No dashboard dá pra acompanhar conversas ao vivo, **pausar a IA** por conversa e responder manual (texto, imagem, áudio)

## Variáveis de ambiente (Railway)

| Variável | Descrição |
|----------|-----------|
| `ANTHROPIC_API_KEY` | Chave da API da Anthropic |
| `EVOLUTION_API_URL` | URL da instância Evolution API |
| `EVOLUTION_API_KEY` | API key da Evolution |
| `EVOLUTION_INSTANCE` | Nome da instância do WhatsApp |
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_KEY` | Service role key (ou anon key) do Supabase |
| `BOT_NOME` | Nome da IA (padrão: Iara) |
| `BOT_NEGOCIO` | Nome do negócio (padrão: Tupy Carrocerias) |
| `BOT_INSTRUCOES` | Instruções especiais injetadas no prompt |

## Setup

1. Rodar `supabase_schema.sql` no SQL Editor do Supabase
2. Subir o repo no GitHub e conectar no Railway
3. Configurar as variáveis de ambiente acima
4. Na Evolution API, apontar o webhook da instância para `https://SEU-APP.railway.app/api/webhook` (evento `messages.upsert`)
5. Abrir o dashboard na URL raiz do app

## Rodar local

```bash
npm install
npm start
# dashboard em http://localhost:3000
```

Sem as variáveis de ambiente o servidor sobe mesmo assim: o catálogo usa os produtos padrão (fallback) e as conversas ficam em memória.
