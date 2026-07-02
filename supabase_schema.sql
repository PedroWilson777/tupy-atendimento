-- Schema do Supabase para Tupy Carrocerias (Atendimento Iara)

-- 1. Tabela de Conversas
CREATE TABLE IF NOT EXISTS public.conversations (
  phone TEXT PRIMARY KEY,
  phone_clean TEXT NOT NULL,
  client_name TEXT,
  history JSONB DEFAULT '[]'::jsonb,
  messages JSONB DEFAULT '[]'::jsonb,
  last_msg TEXT,
  last_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabela de Produtos (carrocerias — preço 0 = sob consulta)
CREATE TABLE IF NOT EXISTS public.products (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  cat TEXT NOT NULL,
  preco NUMERIC(10, 2) NOT NULL DEFAULT 0,
  description TEXT,
  estoque TEXT DEFAULT 'Sob encomenda',
  imagem TEXT
);

-- Inserindo produtos padrão iniciais
INSERT INTO public.products (nome, cat, preco, description, estoque, imagem) VALUES
('Caçamba Basculante', 'Basculante', 0, 'Caçamba basculante reforçada para caminhões toco, truck e traçado. Chapas de alta resistência, pistão hidráulico.', 'Sob encomenda', ''),
('Carroceria Graneleira', 'Graneleiro', 0, 'Carroceria graneleira em madeira e aço para transporte de grãos e cargas a granel. Grades sobrepostas removíveis.', 'Sob encomenda', ''),
('Carroceria Madeireira', 'Madeireiro', 0, 'Carroceria madeireira com fueiros reforçados para transporte de toras e madeira bruta.', 'Sob encomenda', ''),
('Carroceria Carga Seca', 'Carga Seca', 0, 'Carroceria aberta de madeira para carga geral. Assoalho em madeira de lei, laterais removíveis.', 'Sob encomenda', ''),
('Carroceria Boiadeira', 'Boiadeiro', 0, 'Carroceria boiadeira para transporte de gado, com grades altas reforçadas e porteira traseira.', 'Sob encomenda', ''),
('Baú de Alumínio', 'Baú', 0, 'Baú de carga em alumínio para transporte protegido. Portas traseiras duplas e revestimento interno.', 'Sob encomenda', ''),
('Reforma e Manutenção de Carrocerias', 'Serviços', 0, 'Reforma completa, troca de assoalho, pintura e manutenção de carrocerias de todas as marcas.', 'Agendamento', '')
ON CONFLICT DO NOTHING;

-- 3. Tabela de Pedidos (orçamentos)
CREATE TABLE IF NOT EXISTS public.orders (
  id TEXT PRIMARY KEY,
  client TEXT NOT NULL,
  phone TEXT NOT NULL,
  produto TEXT NOT NULL,
  qtd INTEGER DEFAULT 1,
  obs TEXT,
  status TEXT DEFAULT 'novo',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
