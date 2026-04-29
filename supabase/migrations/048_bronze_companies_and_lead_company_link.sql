-- Adiciona suporte a empresas (entidade Company do Kommo) na arquitetura bronze.
-- Motivação: o card de agendamento dos astrônomos precisa do endereço, cidade,
-- estado, local da cúpula e turno — todos são custom fields da empresa, não do
-- lead. Direção da relação: lead → company (cada lead carrega 1 empresa via
-- _embedded.companies[0]). Uma empresa pode ter N leads, mas o agendamento já
-- amarra o lead correto (via task de visita em onboarding).

-- 1. Tabela bronze pras empresas
CREATE TABLE IF NOT EXISTS bronze.kommo_companies_raw (
  id BIGINT PRIMARY KEY,
  name TEXT,
  responsible_user_id BIGINT,
  responsible_user_name TEXT,
  group_id BIGINT,
  created_by BIGINT,
  updated_by BIGINT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  closest_task_at TIMESTAMPTZ,
  is_deleted BOOLEAN DEFAULT FALSE,
  -- {field_name: value}: cômodo pra fields de nome único (Cidade, Estado, Local, Turno).
  custom_fields JSONB,
  -- {field_id: value}: necessário pra desambiguar "Endereço" (existem 2 fields
  -- com mesmo nome — id 586024 ADDRESS é o correto, id 852349 é um duplicado).
  custom_fields_by_id JSONB,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kommo_companies_responsible
  ON bronze.kommo_companies_raw(responsible_user_id);
CREATE INDEX IF NOT EXISTS idx_kommo_companies_synced
  ON bronze.kommo_companies_raw(synced_at DESC);

ALTER TABLE bronze.kommo_companies_raw ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read kommo_companies" ON bronze.kommo_companies_raw;
CREATE POLICY "Allow read kommo_companies" ON bronze.kommo_companies_raw
  FOR SELECT USING (true);
GRANT SELECT ON bronze.kommo_companies_raw TO anon, authenticated;
GRANT ALL    ON bronze.kommo_companies_raw TO service_role;

-- 2. company_id em leads
ALTER TABLE bronze.kommo_leads_raw
  ADD COLUMN IF NOT EXISTS company_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_kommo_leads_company
  ON bronze.kommo_leads_raw(company_id);

COMMENT ON COLUMN bronze.kommo_leads_raw.company_id IS
  'FK opcional pra bronze.kommo_companies_raw.id. Populado pelo sync-kommo-leads-daily (extrai _embedded.companies[0].id) e reforçado pelo sync-kommo-companies (que, ao iterar empresas, faz UPDATE em massa via _embedded.leads).';
