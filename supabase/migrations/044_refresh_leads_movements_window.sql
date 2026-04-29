-- Refresh por janela de tempo: muito mais rápido que NOT EXISTS cross-table.
-- Pega events posteriores a (max moved_at - 1 dia) e usa ON CONFLICT pros duplicados.
-- O `-1 dia` é margem de segurança caso events do mesmo dia ainda não tenham sido
-- todos materializados.
--
-- A v2 (043) usava NOT EXISTS contra a própria leads_movements, que com 308k events
-- e 305k movements precisava varrer ambas as tabelas — caía em lock timeout. Usar
-- created_at indexado é O(log n) por row.

CREATE OR REPLACE FUNCTION gold.refresh_leads_movements()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '600s'
AS $function$
DECLARE
  row_count INT;
  cutoff_ts timestamptz;
BEGIN
  SELECT COALESCE(MAX(moved_at) - interval '1 day', '2000-01-01'::timestamptz)
  INTO cutoff_ts FROM gold.leads_movements;

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
    AND e.created_at >= cutoff_ts
    AND e.value_before IS NOT NULL
    AND e.value_after IS NOT NULL
  ON CONFLICT (event_id) DO NOTHING;

  GET DIAGNOSTICS row_count = ROW_COUNT;
  RETURN row_count || ' rows inserted (window from ' || cutoff_ts || ')';
END;
$function$;
