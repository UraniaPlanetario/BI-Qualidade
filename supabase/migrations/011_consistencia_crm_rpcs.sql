-- ============================================================================
-- Consistência CRM — RPCs for Monitoramento de Usuários
-- ============================================================================

-- Partial index to speed up pipeline filtering on the large leads table
CREATE INDEX IF NOT EXISTS idx_kommo_leads_pipeline_name
ON bronze.kommo_leads_raw(pipeline_name)
WHERE pipeline_name IS NOT NULL;

-- ----------------------------------------------------------------------------
-- campos_alterados_filtrados_por_user
-- Counts field-change events per user in a period, excluding 6 fields that
-- are known to be updated by bots/integrations (not human actions):
--   851177 Etapa do funil
--   850685 Parar IA Whatsapp
--   850687 Parar IA Instagram
--   853875 Origem da oportunidade
--   849769 Canal de entrada
--   586018 tracking
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION gold.campos_alterados_filtrados_por_user(
  p_from timestamptz,
  p_to timestamptz
) RETURNS TABLE(user_id bigint, total bigint)
LANGUAGE sql STABLE
AS $$
  SELECT criado_por_id AS user_id, COUNT(*)::bigint AS total
  FROM gold.cubo_alteracao_campos_eventos
  WHERE data_criacao >= p_from
    AND data_criacao <= p_to
    AND criado_por_id IS NOT NULL
    AND campo_id NOT IN (851177, 850685, 850687, 853875, 849769, 586018)
  GROUP BY criado_por_id;
$$;

GRANT EXECUTE ON FUNCTION gold.campos_alterados_filtrados_por_user(timestamptz, timestamptz)
  TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- leads_atribuidos_por_user
-- Counts distinct leads a user was responsible for at any moment during
-- [p_from, p_to], restricted to leads currently in Vendas WhatsApp pipeline.
-- Dual counting is intentional: a lead that changed responsible user during
-- the period counts for every user who owned it.
--
-- Timelines are reconstructed from bronze.kommo_events_raw
-- (type = 'entity_responsible_changed'). Leads without any responsibility
-- change use the current responsible_user_id from kommo_leads_raw.
--
-- SECURITY DEFINER + statement_timeout=60s because the query can take ~8s
-- and exceed anon role's 3s default timeout.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION gold.leads_atribuidos_por_user(
  p_from timestamptz,
  p_to timestamptz
) RETURNS TABLE(user_id bigint, leads bigint)
LANGUAGE sql STABLE
SECURITY DEFINER
SET statement_timeout = '60s'
AS $$
  WITH leads_wpp AS (
    SELECT id, responsible_user_id
    FROM bronze.kommo_leads_raw
    WHERE pipeline_name = 'Vendas WhatsApp'
  ),
  events_parsed AS (
    SELECT
      e.entity_id AS lead_id,
      e.created_at,
      (e.value_before->0->'responsible_user'->>'id')::bigint AS user_before,
      (e.value_after->0->'responsible_user'->>'id')::bigint AS user_after,
      ROW_NUMBER() OVER (PARTITION BY e.entity_id ORDER BY e.created_at ASC) AS rn_asc
    FROM bronze.kommo_events_raw e
    JOIN leads_wpp l ON l.id = e.entity_id
    WHERE e.type = 'entity_responsible_changed'
      AND e.entity_type = 'lead'
  ),
  intervals AS (
    SELECT ep.lead_id, ep.user_after AS user_id, ep.created_at AS start_at,
           LEAD(ep.created_at) OVER (PARTITION BY ep.lead_id ORDER BY ep.created_at) AS end_at
    FROM events_parsed ep
    UNION ALL
    SELECT ep.lead_id, ep.user_before AS user_id, '-infinity'::timestamptz, ep.created_at
    FROM events_parsed ep
    WHERE ep.rn_asc = 1
    UNION ALL
    SELECT l.id, l.responsible_user_id, '-infinity'::timestamptz, 'infinity'::timestamptz
    FROM leads_wpp l
    WHERE NOT EXISTS (SELECT 1 FROM events_parsed e WHERE e.lead_id = l.id)
  )
  SELECT i.user_id, COUNT(DISTINCT i.lead_id)::bigint AS leads
  FROM intervals i
  WHERE i.user_id IS NOT NULL AND i.user_id != 0
    AND i.start_at <= p_to
    AND (i.end_at IS NULL OR i.end_at >= p_from)
  GROUP BY i.user_id;
$$;

GRANT EXECUTE ON FUNCTION gold.leads_atribuidos_por_user(timestamptz, timestamptz)
  TO anon, authenticated, service_role;
