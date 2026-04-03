-- Campos adicionais para blocos de análise

-- Bloco 2: Performance / Vendedor
ALTER TABLE leads_quality ADD COLUMN IF NOT EXISTS vendedor_consultor TEXT;       -- ID: 847427
ALTER TABLE leads_quality ADD COLUMN IF NOT EXISTS sdr TEXT;                      -- ID: 852041

-- Bloco 4: Contexto
ALTER TABLE leads_quality ADD COLUMN IF NOT EXISTS cidade_estado TEXT;            -- ID: 848739
ALTER TABLE leads_quality ADD COLUMN IF NOT EXISTS etapa_funil TEXT;              -- ID: 851177
ALTER TABLE leads_quality ADD COLUMN IF NOT EXISTS tipo_cliente TEXT;             -- ID: 848211

-- Bloco 5: Comercial
ALTER TABLE leads_quality ADD COLUMN IF NOT EXISTS data_fechamento TIMESTAMPTZ;  -- ID: 850461
ALTER TABLE leads_quality ADD COLUMN IF NOT EXISTS data_hora_agendamento TIMESTAMPTZ; -- ID: 841867
ALTER TABLE leads_quality ADD COLUMN IF NOT EXISTS produtos TEXT;                -- ID: 841197 (multiselect)
ALTER TABLE leads_quality ADD COLUMN IF NOT EXISTS closed_at_kommo TIMESTAMPTZ;  -- campo nativo lead.closed_at

-- Indexes adicionais
CREATE INDEX IF NOT EXISTS idx_leads_quality_vendedor ON leads_quality(vendedor_consultor);
CREATE INDEX IF NOT EXISTS idx_leads_quality_cidade ON leads_quality(cidade_estado);
