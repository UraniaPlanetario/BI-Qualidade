-- Enriquece gold.leads_movements com snapshot dos campos no momento da movimentação:
--   responsible_user_id / responsible_user → backfill do histórico de entity_responsible_changed
--   vendedor_custom / sdr_custom            → prospectivo (não há histórico com value_before/after
--                                             pros eventos de custom_field_changed)
--
-- Também muda o refresh para INCREMENTAL (ON CONFLICT DO NOTHING por event_id).
-- Antes: TRUNCATE + INSERT reescrevia os snapshots a cada rodada.
-- Agora: só novos eventos são inseridos, preservando o snapshot do momento em que
-- foram capturados.

ALTER TABLE gold.leads_movements
  ADD COLUMN IF NOT EXISTS responsible_user_id bigint,
  ADD COLUMN IF NOT EXISTS responsible_user    text,
  ADD COLUMN IF NOT EXISTS vendedor_custom     text,
  ADD COLUMN IF NOT EXISTS sdr_custom          text;

-- UNIQUE em event_id já existia como leads_movements_event_id_key
CREATE INDEX IF NOT EXISTS idx_leads_movements_lead_moved
  ON gold.leads_movements (lead_id, moved_at);

-- Backfill one-shot: responsible_user no momento de cada movimento
WITH resp AS (
  SELECT DISTINCT ON (m.event_id)
    m.event_id,
    (e.value_after->0->'responsible_user'->>'id')::bigint AS user_id
  FROM gold.leads_movements m
  JOIN bronze.kommo_events_raw e
    ON e.entity_id = m.lead_id
   AND e.type = 'entity_responsible_changed'
   AND e.created_at <= m.moved_at
  ORDER BY m.event_id, e.created_at DESC
)
UPDATE gold.leads_movements m
SET responsible_user_id = resp.user_id,
    responsible_user = ku.name
FROM resp
LEFT JOIN bronze.kommo_users ku ON ku.id = resp.user_id
WHERE m.event_id = resp.event_id;

CREATE OR REPLACE FUNCTION gold.refresh_leads_movements()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout TO '300s'
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
    e.id AS event_id,
    e.entity_id AS lead_id,
    l.created_at AS lead_created_at,
    (e.value_before->0->'lead_status'->>'pipeline_id')::bigint AS pipeline_from_id,
    pf.pipeline_name AS pipeline_from,
    (e.value_before->0->'lead_status'->>'id')::bigint AS status_from_id,
    sf.status_name AS status_from,
    (e.value_after->0->'lead_status'->>'pipeline_id')::bigint AS pipeline_to_id,
    pt.pipeline_name AS pipeline_to,
    (e.value_after->0->'lead_status'->>'id')::bigint AS status_to_id,
    st.status_name AS status_to,
    e.created_by AS moved_by_id,
    u.name AS moved_by,
    e.created_at AS moved_at,
    -- responsible_user no momento do movimento: último entity_responsible_changed <= moved_at
    (SELECT (re.value_after->0->'responsible_user'->>'id')::bigint
     FROM bronze.kommo_events_raw re
     WHERE re.entity_id = e.entity_id
       AND re.type = 'entity_responsible_changed'
       AND re.created_at <= e.created_at
     ORDER BY re.created_at DESC LIMIT 1) AS responsible_user_id,
    (SELECT ru.name FROM bronze.kommo_users ru
     WHERE ru.id = (SELECT (re.value_after->0->'responsible_user'->>'id')::bigint
                    FROM bronze.kommo_events_raw re
                    WHERE re.entity_id = e.entity_id
                      AND re.type = 'entity_responsible_changed'
                      AND re.created_at <= e.created_at
                    ORDER BY re.created_at DESC LIMIT 1)
    ) AS responsible_user,
    -- vendedor/sdr: snapshot do valor atual do bronze no momento do refresh
    l.custom_fields->>'Vendedor/Consultor' AS vendedor_custom,
    l.custom_fields->>'SDR' AS sdr_custom
  FROM bronze.kommo_events_raw e
  LEFT JOIN bronze.kommo_leads_raw l ON l.id = e.entity_id
  LEFT JOIN bronze.kommo_users u ON u.id = e.created_by
  LEFT JOIN bronze.kommo_pipelines sf ON sf.pipeline_id = (e.value_before->0->'lead_status'->>'pipeline_id')::bigint
    AND sf.status_id = (e.value_before->0->'lead_status'->>'id')::bigint
  LEFT JOIN bronze.kommo_pipelines st ON st.pipeline_id = (e.value_after->0->'lead_status'->>'pipeline_id')::bigint
    AND st.status_id = (e.value_after->0->'lead_status'->>'id')::bigint
  LEFT JOIN bronze.kommo_pipelines pf ON pf.pipeline_id = (e.value_before->0->'lead_status'->>'pipeline_id')::bigint
    AND pf.status_id = (e.value_before->0->'lead_status'->>'id')::bigint
  LEFT JOIN bronze.kommo_pipelines pt ON pt.pipeline_id = (e.value_after->0->'lead_status'->>'pipeline_id')::bigint
    AND pt.status_id = (e.value_after->0->'lead_status'->>'id')::bigint
  WHERE e.type = 'lead_status_changed'
    AND e.value_before IS NOT NULL
    AND e.value_after IS NOT NULL
  ON CONFLICT (event_id) DO NOTHING;

  GET DIAGNOSTICS row_count = ROW_COUNT;
  RETURN row_count || ' rows inserted (incremental)';
END;
$function$;
