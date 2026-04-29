-- Otimização do gold.refresh_leads_movements pra evitar timeout.
--
-- Problemas da versão anterior:
--   1. 2 subqueries correlatas idênticas pra resolver responsible_user_id e
--      responsible_user.name (1 lookup por row × 308k rows).
--   2. JOINs duplicados em kommo_pipelines (sf/pf, st/pt — pares idênticos).
--   3. Processava TODOS os events lead_status_changed mesmo quando 99% já
--      estavam materializados.
--
-- v2:
--   - LATERAL JOIN com kommo_events_raw resolve responsible_user_id uma vez
--     por row (em vez de 2 subqueries correlatas).
--   - JOIN com kommo_users pra trazer o name.
--   - Remove duplicação sf/pf e st/pt.
--   - Filtra `NOT EXISTS (SELECT 1 FROM gold.leads_movements WHERE event_id = e.id)`
--     pra processar só o delta.
--
-- Substituída pela 044 (window-based) — esta versão ainda apresentou lock
-- timeout no scan de NOT EXISTS pra todos os events.

CREATE OR REPLACE FUNCTION gold.refresh_leads_movements()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '600s'
AS $function$
DECLARE row_count INT;
BEGIN
  INSERT INTO gold.leads_movements
    (event_id, lead_id, lead_created_at,
     pipeline_from_id, pipeline_from, status_from_id, status_from,
     pipeline_to_id, pipeline_to, status_to_id, status_to,
     moved_by_id, moved_by, moved_at,
     responsible_user_id, responsible_user,
     vendedor_custom, sdr_custom)
  SELECT
    e.id, e.entity_id, l.created_at,
    (e.value_before->0->'lead_status'->>'pipeline_id')::bigint, pf.pipeline_name,
    (e.value_before->0->'lead_status'->>'id')::bigint,        pf.status_name,
    (e.value_after ->0->'lead_status'->>'pipeline_id')::bigint, pt.pipeline_name,
    (e.value_after ->0->'lead_status'->>'id')::bigint,        pt.status_name,
    e.created_by, u.name, e.created_at,
    r.resp_id, ru.name,
    l.custom_fields->>'Vendedor/Consultor',
    l.custom_fields->>'SDR'
  FROM bronze.kommo_events_raw e
  LEFT JOIN bronze.kommo_leads_raw l ON l.id = e.entity_id
  LEFT JOIN bronze.kommo_users u ON u.id = e.created_by
  LEFT JOIN bronze.kommo_pipelines pf
    ON pf.pipeline_id = (e.value_before->0->'lead_status'->>'pipeline_id')::bigint
   AND pf.status_id   = (e.value_before->0->'lead_status'->>'id')::bigint
  LEFT JOIN bronze.kommo_pipelines pt
    ON pt.pipeline_id = (e.value_after->0->'lead_status'->>'pipeline_id')::bigint
   AND pt.status_id   = (e.value_after->0->'lead_status'->>'id')::bigint
  LEFT JOIN LATERAL (
    SELECT (re.value_after->0->'responsible_user'->>'id')::bigint AS resp_id
    FROM bronze.kommo_events_raw re
    WHERE re.entity_id = e.entity_id
      AND re.type = 'entity_responsible_changed'
      AND re.created_at <= e.created_at
    ORDER BY re.created_at DESC LIMIT 1
  ) r ON TRUE
  LEFT JOIN bronze.kommo_users ru ON ru.id = r.resp_id
  WHERE e.type = 'lead_status_changed'
    AND e.value_before IS NOT NULL
    AND e.value_after IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM gold.leads_movements m WHERE m.event_id = e.id
    )
  ON CONFLICT (event_id) DO NOTHING;

  GET DIAGNOSTICS row_count = ROW_COUNT;
  RETURN row_count || ' rows inserted (incremental v2)';
END;
$function$;

-- Índices que aceleram o LATERAL e o filtro por tipo
CREATE INDEX IF NOT EXISTS idx_kommo_events_responsible_lookup
  ON bronze.kommo_events_raw (entity_id, created_at DESC)
  WHERE type = 'entity_responsible_changed';

CREATE INDEX IF NOT EXISTS idx_kommo_events_status_changed
  ON bronze.kommo_events_raw (id)
  WHERE type = 'lead_status_changed';
