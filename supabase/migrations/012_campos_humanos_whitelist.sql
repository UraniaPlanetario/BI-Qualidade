-- ============================================================================
-- Whitelist de campos humanos — substitui a blacklist de 6 campos-bot
-- ============================================================================

-- 1. bronze.kommo_custom_fields — catálogo de todos os custom fields do Kommo
CREATE TABLE IF NOT EXISTS bronze.kommo_custom_fields (
  id bigint PRIMARY KEY,
  name text,
  type text,
  entity_type text NOT NULL,
  code text,
  is_deletable boolean,
  is_computed boolean,
  sort integer,
  group_id text,
  synced_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kommo_custom_fields_entity
  ON bronze.kommo_custom_fields(entity_type);
ALTER TABLE bronze.kommo_custom_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read kommo_custom_fields" ON bronze.kommo_custom_fields
  FOR SELECT USING (true);
GRANT SELECT ON bronze.kommo_custom_fields TO anon, authenticated;
GRANT ALL ON bronze.kommo_custom_fields TO service_role;

-- 2. config.dim_campos — whitelist (campo_id, incluir, nota)
CREATE TABLE IF NOT EXISTS config.dim_campos (
  campo_id bigint PRIMARY KEY,
  incluir boolean NOT NULL DEFAULT false,
  nota text,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dim_campos_incluir
  ON config.dim_campos(incluir) WHERE incluir = true;
ALTER TABLE config.dim_campos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read dim_campos" ON config.dim_campos
  FOR SELECT USING (true);
GRANT SELECT ON config.dim_campos TO anon, authenticated;
GRANT ALL ON config.dim_campos TO service_role;

CREATE OR REPLACE FUNCTION config.dim_campos_update_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dim_campos_update_at ON config.dim_campos;
CREATE TRIGGER trg_dim_campos_update_at
  BEFORE UPDATE ON config.dim_campos
  FOR EACH ROW EXECUTE FUNCTION config.dim_campos_update_at();

-- 3. gold.alteracoes_humanas — view filtrada pela whitelist + com campo_nome
CREATE OR REPLACE VIEW gold.alteracoes_humanas AS
SELECT
  c.id,
  c.event_id,
  c.lead_id,
  c.entity_type,
  c.campo_alterado,
  c.campo_id,
  kcf.name AS campo_nome,
  c.criado_por_id,
  c.criado_por,
  c.data_criacao,
  c.dia_util,
  c.hora_brt,
  c.dentro_janela,
  c.valor_antes,
  c.valor_depois
FROM gold.cubo_alteracao_campos_eventos c
JOIN config.dim_campos dc ON dc.campo_id = c.campo_id AND dc.incluir = true
LEFT JOIN bronze.kommo_custom_fields kcf ON kcf.id = c.campo_id;

GRANT SELECT ON gold.alteracoes_humanas TO anon, authenticated, service_role;

-- 4. Atualiza RPC para consumir a view (deixa de usar blacklist hardcoded)
CREATE OR REPLACE FUNCTION gold.campos_alterados_filtrados_por_user(
  p_from timestamptz,
  p_to timestamptz
) RETURNS TABLE(user_id bigint, total bigint)
LANGUAGE sql STABLE
AS $$
  SELECT criado_por_id AS user_id, COUNT(*)::bigint AS total
  FROM gold.alteracoes_humanas
  WHERE data_criacao >= p_from
    AND data_criacao <= p_to
    AND criado_por_id IS NOT NULL
  GROUP BY criado_por_id;
$$;

GRANT EXECUTE ON FUNCTION gold.campos_alterados_filtrados_por_user(timestamptz, timestamptz)
  TO anon, authenticated, service_role;

-- Note: populate config.dim_campos after running sync-kommo-custom-fields edge function
-- initial whitelist covers 62 fields matching the team's list (see business-rules.md)
