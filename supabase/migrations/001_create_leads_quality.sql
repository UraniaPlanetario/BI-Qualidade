-- Tabela principal: dados de qualidade extraídos do Kommo CRM
CREATE TABLE IF NOT EXISTS leads_quality (
  id BIGSERIAL PRIMARY KEY,
  kommo_lead_id BIGINT NOT NULL UNIQUE,
  lead_name TEXT,
  lead_price NUMERIC,
  pipeline_name TEXT,
  status_name TEXT,
  responsible_user TEXT,
  created_at_kommo TIMESTAMPTZ,

  -- Campos de Qualidade (aba Qualidade do Kommo)
  dia_semana_criacao TEXT,           -- ID: 1150697 | select
  tipo_de_dia TEXT,                  -- ID: 1150801 | select
  faixa_horario_criacao TEXT,        -- ID: 1150803 | select
  quem_atendeu_primeiro TEXT,        -- ID: 1150805 | select
  qualidade_abordagem_inicial TEXT,  -- ID: 1151533 | select
  personalizacao_atendimento TEXT,   -- ID: 1151593 | select
  clareza_comunicacao TEXT,          -- ID: 1151653 | select
  conectou_solucao_necessidade TEXT, -- ID: 1151655 | select
  explicou_beneficios TEXT,          -- ID: 1151657 | select
  personalizou_argumentacao TEXT,    -- ID: 1151659 | select
  houve_desconto TEXT,               -- ID: 1151661 | select
  desconto_justificado TEXT,         -- ID: 1151663 | select
  quebrou_preco_sem_necessidade TEXT, -- ID: 1151665 | select
  retorno_etapa_funil TEXT,          -- ID: 1150807 | select
  retorno_resgate TEXT,              -- ID: 1150809 | select
  tempo_primeira_resposta TEXT,      -- ID: 1150811 | select
  pediu_data TEXT,                   -- ID: 1150813 | select
  data_sugerida TEXT,                -- ID: 1150815 | text
  dias_ate_fechar TEXT,              -- ID: 1150819 | select
  ligacoes_feitas TEXT,              -- ID: 1150821 | select
  conhecia_urania TEXT,              -- ID: 1150823 | text
  proximo_passo_definido TEXT,       -- ID: 1151725 | select
  observacoes_gerais TEXT,           -- ID: 1150827 | textarea
  ponto_critico TEXT,                -- ID: 1150829 | textarea
  ponto_positivo TEXT,               -- ID: 1150831 | text
  score_qualidade TEXT,              -- ID: 1151727 | select

  -- Metadata de sync
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index para buscas frequentes
CREATE INDEX IF NOT EXISTS idx_leads_quality_pipeline ON leads_quality(pipeline_name);
CREATE INDEX IF NOT EXISTS idx_leads_quality_score ON leads_quality(score_qualidade);
CREATE INDEX IF NOT EXISTS idx_leads_quality_responsible ON leads_quality(responsible_user);

-- RLS (obrigatório no ecossistema Urânia)
ALTER TABLE leads_quality ENABLE ROW LEVEL SECURITY;

-- Policy: leitura pública (dados de BI, não sensíveis)
CREATE POLICY "Allow read access" ON leads_quality FOR SELECT USING (true);

-- Policy: insert/update apenas via service_role (sync script)
CREATE POLICY "Allow service role write" ON leads_quality FOR ALL USING (true) WITH CHECK (true);
