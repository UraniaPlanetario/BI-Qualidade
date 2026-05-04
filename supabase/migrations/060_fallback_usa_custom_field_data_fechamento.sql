-- gold.refresh_leads_closed v4 (final) — incorpora todas as regras das
-- migrations 057, 058, 059, 060 num único CREATE OR REPLACE definitivo:
--
-- 1. Múltiplas occurrences por lead (recompras), agrupadas por gap > 30 dias
--    entre entradas externas no Onboarding.
-- 2. data_fechamento_fmt = entrada_onboarding_at, exceto última occurrence
--    quando custom field "Data de Fechamento" está em [entrada-30d, entrada]
--    (caso fechou-no-mês-anterior + moveu-no-próximo-dia-útil).
-- 3. cancelado determinado pelo pipeline_final da janela da occurrence
--    (saída pra Vendas Whats / Outbound / Resgate / Recepção). Pra última
--    occurrence, custom field "Data cancelamento" também conta.
-- 4. Recuperado: se Data Fechamento > Data cancelamento, NÃO é cancelado.
-- 5. Fallback (leads atualmente em Onboarding sem mov registrada em
--    leads_movements): usa custom field "Data de Fechamento" como
--    entrada_onboarding_at quando preenchido (resolve casos de events
--    perdidos pela API do Kommo). Cai pra lead.created_at se o custom
--    field não estiver disponível.

CREATE OR REPLACE FUNCTION gold.refresh_leads_closed()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '300s'
AS $function$
DECLARE
  row_count INT;
BEGIN
  TRUNCATE gold.leads_closed;

  WITH
  external_entries AS (
    SELECT m.lead_id, m.pipeline_from AS pipeline_origem,
           m.pipeline_to AS pipeline_onboarding, m.moved_at AS entrada_at
    FROM gold.leads_movements m
    WHERE m.pipeline_to IN ('Onboarding Escolas', 'Onboarding SME')
      AND (m.pipeline_from IS NULL OR m.pipeline_from NOT IN ('Onboarding Escolas', 'Onboarding SME'))
  ),
  internal_only_leads AS (
    SELECT DISTINCT m.lead_id FROM gold.leads_movements m
    WHERE m.pipeline_to IN ('Onboarding Escolas', 'Onboarding SME')
      AND m.pipeline_from IN ('Onboarding Escolas', 'Onboarding SME')
      AND m.lead_id NOT IN (SELECT lead_id FROM external_entries)
  ),
  internal_first_entries AS (
    SELECT DISTINCT ON (m.lead_id) m.lead_id, NULL::text AS pipeline_origem,
      m.pipeline_to AS pipeline_onboarding, m.moved_at AS entrada_at
    FROM gold.leads_movements m
    WHERE m.lead_id IN (SELECT lead_id FROM internal_only_leads)
      AND m.pipeline_to IN ('Onboarding Escolas', 'Onboarding SME')
    ORDER BY m.lead_id, m.moved_at ASC
  ),
  current_in_onboarding_no_movs AS (
    SELECT l.id AS lead_id, NULL::text AS pipeline_origem,
      l.pipeline_name AS pipeline_onboarding,
      CASE
        WHEN (l.custom_fields->>'Data de Fechamento') ~ '^\d+$'
        THEN to_timestamp((l.custom_fields->>'Data de Fechamento')::bigint)
        ELSE l.created_at
      END AS entrada_at
    FROM bronze.kommo_leads_raw l
    WHERE l.pipeline_name IN ('Onboarding Escolas', 'Onboarding SME')
      AND COALESCE(l.is_deleted, FALSE) = FALSE
      AND l.id NOT IN (SELECT lead_id FROM external_entries)
      AND l.id NOT IN (SELECT lead_id FROM internal_first_entries)
  ),
  all_entries AS (
    SELECT * FROM external_entries
    UNION ALL SELECT * FROM internal_first_entries
    UNION ALL SELECT * FROM current_in_onboarding_no_movs
  ),
  gap_marked AS (
    SELECT *,
      CASE
        WHEN entrada_at - LAG(entrada_at) OVER (PARTITION BY lead_id ORDER BY entrada_at) > INTERVAL '30 days'
          OR LAG(entrada_at) OVER (PARTITION BY lead_id ORDER BY entrada_at) IS NULL
        THEN 1 ELSE 0
      END AS new_group
    FROM all_entries
  ),
  with_group AS (
    SELECT *,
      SUM(new_group) OVER (PARTITION BY lead_id ORDER BY entrada_at
                           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS group_id
    FROM gap_marked
  ),
  occurrences AS (
    SELECT DISTINCT ON (lead_id, group_id)
      lead_id, pipeline_origem, pipeline_onboarding, entrada_at AS entrada_onboarding_at
    FROM with_group
    ORDER BY lead_id, group_id, entrada_at
  ),
  numbered AS (
    SELECT lead_id, pipeline_origem, pipeline_onboarding, entrada_onboarding_at,
      ROW_NUMBER() OVER (PARTITION BY lead_id ORDER BY entrada_onboarding_at) AS occurrence,
      LEAD(entrada_onboarding_at) OVER (PARTITION BY lead_id ORDER BY entrada_onboarding_at) AS next_entrada_at
    FROM occurrences
  ),
  with_pipeline_final AS (
    SELECT n.*,
      CASE
        WHEN n.next_entrada_at IS NULL THEN
          (SELECT pipeline_name FROM bronze.kommo_leads_raw WHERE id = n.lead_id)
        ELSE
          (SELECT m.pipeline_to FROM gold.leads_movements m
           WHERE m.lead_id = n.lead_id
             AND m.moved_at >= n.entrada_onboarding_at
             AND m.moved_at < n.next_entrada_at
             AND m.pipeline_to IS NOT NULL
           ORDER BY m.moved_at DESC LIMIT 1)
      END AS pipeline_final,
      (SELECT MAX(m.moved_at) FROM gold.leads_movements m
       WHERE m.lead_id = n.lead_id
         AND m.pipeline_from IN ('Onboarding Escolas', 'Onboarding SME')
         AND m.pipeline_to IN ('Vendas WhatsApp', 'Outbound', 'Recepção Leads Insta', 'Resgate/Nutrição Whats')
         AND m.moved_at >= n.entrada_onboarding_at
         AND (n.next_entrada_at IS NULL OR m.moved_at < n.next_entrada_at)
      ) AS mov_pra_captacao_at
    FROM numbered n
  ),
  with_lead_data AS (
    SELECT wpf.*,
      l.name AS lead_name, l.price AS lead_price,
      l.created_at AS lead_created_at, l.custom_fields,
      (wpf.next_entrada_at IS NULL) AS is_last_occurrence,
      MAX(wpf.occurrence) OVER (PARTITION BY wpf.lead_id) AS total_occurrences
    FROM with_pipeline_final wpf
    LEFT JOIN bronze.kommo_leads_raw l ON l.id = wpf.lead_id
    WHERE COALESCE(l.is_deleted, FALSE) = FALSE
      AND l.custom_fields->>'Vendedor/Consultor' IS NOT NULL
      AND l.custom_fields->>'Vendedor/Consultor' != ''
  ),
  filtered AS (
    SELECT * FROM with_lead_data wld
    WHERE
      CASE
        WHEN wld.is_last_occurrence THEN
          wld.custom_fields->>'Data de Fechamento' IS NOT NULL
          AND wld.custom_fields->>'Data e Hora do Agendamento' IS NOT NULL
          AND CASE
            WHEN (wld.custom_fields->>'Data de Fechamento') ~ '^\d+$'
              AND (wld.custom_fields->>'Data e Hora do Agendamento') ~ '^\d+$'
            THEN (wld.custom_fields->>'Data de Fechamento')::bigint
                 < (wld.custom_fields->>'Data e Hora do Agendamento')::bigint
            ELSE TRUE
          END
        ELSE TRUE
      END
  )
  INSERT INTO gold.leads_closed
    (lead_id, lead_name, lead_price, vendedor, sdr, cidade_estado, tipo_cliente, produtos,
     data_fechamento, data_agendamento, n_diarias, faixa_alunos, n_alunos,
     canal_entrada, origem_oportunidade, experiencia, conteudo_apresentacao,
     horizonte_agendamento, astronomo, turnos_evento, brinde,
     data_fechamento_fmt, data_agendamento_fmt, data_cancelamento_fmt,
     pipeline_origem, pipeline_onboarding, entrada_onboarding_at, lead_created_at,
     occurrence, cancelado, cancelado_at, custom_fields)
  SELECT
    f.lead_id, f.lead_name, f.lead_price,
    f.custom_fields->>'Vendedor/Consultor', f.custom_fields->>'SDR',
    f.custom_fields->>'Cidade - Estado', f.custom_fields->>'Tipo de cliente', f.custom_fields->>'Produtos',
    f.custom_fields->>'Data de Fechamento', f.custom_fields->>'Data e Hora do Agendamento',
    f.custom_fields->>'Nº de Diárias', f.custom_fields->>'Faixa de alunos', f.custom_fields->>'Nº de alunos',
    f.custom_fields->>'Canal de entrada', f.custom_fields->>'Origem da oportunidade',
    f.custom_fields->>'Experiência', f.custom_fields->>'Conteúdo da apresentação',
    f.custom_fields->>'Horizonte de Agendamento', f.custom_fields->>'Astrônomo',
    f.custom_fields->>'Turnos do evento', f.custom_fields->>'Brinde',
    CASE
      WHEN f.is_last_occurrence
        AND (f.custom_fields->>'Data de Fechamento') ~ '^\d+$'
        AND to_timestamp((f.custom_fields->>'Data de Fechamento')::bigint)::date <= f.entrada_onboarding_at::date
        AND to_timestamp((f.custom_fields->>'Data de Fechamento')::bigint)::date >= (f.entrada_onboarding_at::date - INTERVAL '30 days')
      THEN to_timestamp((f.custom_fields->>'Data de Fechamento')::bigint)::date
      ELSE f.entrada_onboarding_at::date
    END,
    CASE WHEN (f.custom_fields->>'Data e Hora do Agendamento') ~ '^\d+$'
      THEN to_timestamp((f.custom_fields->>'Data e Hora do Agendamento')::bigint) ELSE NULL END,
    CASE
      WHEN f.pipeline_final IN ('Vendas WhatsApp', 'Outbound', 'Recepção Leads Insta', 'Resgate/Nutrição Whats')
      THEN f.mov_pra_captacao_at::date
      WHEN f.is_last_occurrence AND (f.custom_fields->>'Data cancelamento') ~ '^\d+$'
      THEN to_timestamp((f.custom_fields->>'Data cancelamento')::bigint)::date
      ELSE NULL
    END,
    f.pipeline_origem, f.pipeline_onboarding, f.entrada_onboarding_at, f.lead_created_at,
    f.occurrence,
    CASE
      WHEN f.pipeline_final IN ('Vendas WhatsApp', 'Outbound', 'Recepção Leads Insta', 'Resgate/Nutrição Whats') THEN TRUE
      WHEN f.is_last_occurrence AND (f.custom_fields->>'Data cancelamento') ~ '^\d+$'
        AND (NOT ((f.custom_fields->>'Data de Fechamento') ~ '^\d+$')
             OR (f.custom_fields->>'Data de Fechamento')::bigint <= (f.custom_fields->>'Data cancelamento')::bigint)
      THEN TRUE
      ELSE FALSE
    END,
    CASE
      WHEN f.pipeline_final IN ('Vendas WhatsApp', 'Outbound', 'Recepção Leads Insta', 'Resgate/Nutrição Whats')
      THEN f.mov_pra_captacao_at
      WHEN f.is_last_occurrence AND (f.custom_fields->>'Data cancelamento') ~ '^\d+$'
      THEN to_timestamp((f.custom_fields->>'Data cancelamento')::bigint)
      ELSE NULL
    END,
    f.custom_fields
  FROM filtered f;

  GET DIAGNOSTICS row_count = ROW_COUNT;
  RETURN row_count || ' rows inserted';
END;
$function$;
