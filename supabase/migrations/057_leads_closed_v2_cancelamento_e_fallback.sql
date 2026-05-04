-- Atualiza gold.refresh_leads_closed com 2 mudanças de regra:
--
-- 1. Cancelamento depende SOMENTE de "Data cancelamento" (custom field).
--    O custom field "Cancelado (Onboarding)" = 'Sim' SEM data preenchida
--    NÃO conta mais como cancelado (era o caso do lead 22404497).
--    Movimentação pra fora também não conta sozinha.
--
-- 2. Recuperação: se "Data de Fechamento" > "Data cancelamento", o lead
--    foi recuperado (alguém alterou a data depois do cancelamento) e
--    DEIXA DE SER cancelado (era o caso do lead 22627041).
--
-- Adicionalmente:
-- 3. Fallback pra leads que estão atualmente em Onboarding mas não têm
--    movimentação registrada em leads_movements (caso de 23393894, 26847949
--    — provável bug do sync de events que não capturou a movimentação
--    antiga). Usa lead.created_at como entrada_onboarding_at.

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
    SELECT
      m.lead_id,
      m.pipeline_from AS pipeline_origem,
      m.pipeline_to AS pipeline_onboarding,
      m.moved_at AS entrada_onboarding_at
    FROM gold.leads_movements m
    WHERE m.pipeline_to IN ('Onboarding Escolas', 'Onboarding SME')
      AND (m.pipeline_from IS NULL OR m.pipeline_from NOT IN ('Onboarding Escolas', 'Onboarding SME'))
  ),
  internal_only_leads AS (
    SELECT DISTINCT m.lead_id
    FROM gold.leads_movements m
    WHERE m.pipeline_to IN ('Onboarding Escolas', 'Onboarding SME')
      AND m.pipeline_from IN ('Onboarding Escolas', 'Onboarding SME')
      AND m.lead_id NOT IN (SELECT lead_id FROM external_entries)
      AND m.lead_id NOT IN (
        SELECT m2.lead_id FROM gold.leads_movements m2
        WHERE m2.pipeline_from IN ('Onboarding Escolas', 'Onboarding SME')
          AND m2.pipeline_to NOT IN ('Onboarding Escolas', 'Onboarding SME', 'Financeiro', 'Clientes - CS')
      )
  ),
  internal_entries AS (
    SELECT DISTINCT ON (m.lead_id)
      m.lead_id,
      NULL::text AS pipeline_origem,
      m.pipeline_to AS pipeline_onboarding,
      m.moved_at AS entrada_onboarding_at
    FROM gold.leads_movements m
    WHERE m.lead_id IN (SELECT lead_id FROM internal_only_leads)
      AND m.pipeline_to IN ('Onboarding Escolas', 'Onboarding SME')
    ORDER BY m.lead_id, m.moved_at ASC
  ),
  -- NOVO: leads atualmente em Onboarding sem movimentação registrada.
  -- Sync de events pode ter perdido movimentações antigas; capturamos eles
  -- aqui usando lead.created_at como entrada (aproximação — não temos a
  -- data exata da entrada no Onboarding).
  current_in_onboarding_no_movs AS (
    SELECT
      l.id AS lead_id,
      NULL::text AS pipeline_origem,
      l.pipeline_name AS pipeline_onboarding,
      l.created_at AS entrada_onboarding_at
    FROM bronze.kommo_leads_raw l
    WHERE l.pipeline_name IN ('Onboarding Escolas', 'Onboarding SME')
      AND COALESCE(l.is_deleted, FALSE) = FALSE
      AND l.id NOT IN (SELECT lead_id FROM external_entries)
      AND l.id NOT IN (SELECT lead_id FROM internal_entries)
  ),
  all_entries AS (
    SELECT * FROM external_entries
    UNION ALL
    SELECT * FROM internal_entries
    UNION ALL
    SELECT * FROM current_in_onboarding_no_movs
  ),
  deduped AS (
    SELECT DISTINCT ON (ae.lead_id, l.custom_fields->>'Data de Fechamento')
      ae.lead_id,
      ae.pipeline_origem,
      ae.pipeline_onboarding,
      ae.entrada_onboarding_at,
      l.name AS lead_name,
      l.price AS lead_price,
      l.created_at AS lead_created_at,
      l.is_deleted,
      l.custom_fields
    FROM all_entries ae
    LEFT JOIN bronze.kommo_leads_raw l ON l.id = ae.lead_id
    WHERE (l.is_deleted = FALSE OR l.is_deleted IS NULL)
      AND l.custom_fields->>'Vendedor/Consultor' IS NOT NULL
      AND l.custom_fields->>'Vendedor/Consultor' != ''
      AND l.custom_fields->>'Data de Fechamento' IS NOT NULL
      AND l.custom_fields->>'Data e Hora do Agendamento' IS NOT NULL
      AND CASE
        WHEN (l.custom_fields->>'Data de Fechamento') ~ '^\d+$'
          AND (l.custom_fields->>'Data e Hora do Agendamento') ~ '^\d+$'
        THEN (l.custom_fields->>'Data de Fechamento')::bigint < (l.custom_fields->>'Data e Hora do Agendamento')::bigint
        ELSE TRUE
      END
    ORDER BY ae.lead_id, l.custom_fields->>'Data de Fechamento', ae.entrada_onboarding_at ASC
  ),
  numbered AS (
    SELECT d.*, ROW_NUMBER() OVER (PARTITION BY d.lead_id ORDER BY d.entrada_onboarding_at) AS occurrence
    FROM deduped d
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
    n.lead_id, n.lead_name, n.lead_price,
    n.custom_fields->>'Vendedor/Consultor',
    n.custom_fields->>'SDR',
    n.custom_fields->>'Cidade - Estado',
    n.custom_fields->>'Tipo de cliente',
    n.custom_fields->>'Produtos',
    n.custom_fields->>'Data de Fechamento',
    n.custom_fields->>'Data e Hora do Agendamento',
    n.custom_fields->>'Nº de Diárias',
    n.custom_fields->>'Faixa de alunos',
    n.custom_fields->>'Nº de alunos',
    n.custom_fields->>'Canal de entrada',
    n.custom_fields->>'Origem da oportunidade',
    n.custom_fields->>'Experiência',
    n.custom_fields->>'Conteúdo da apresentação',
    n.custom_fields->>'Horizonte de Agendamento',
    n.custom_fields->>'Astrônomo',
    n.custom_fields->>'Turnos do evento',
    n.custom_fields->>'Brinde',
    CASE WHEN (n.custom_fields->>'Data de Fechamento') ~ '^\d+$'
      THEN to_timestamp((n.custom_fields->>'Data de Fechamento')::bigint)::date ELSE NULL END,
    CASE WHEN (n.custom_fields->>'Data e Hora do Agendamento') ~ '^\d+$'
      THEN to_timestamp((n.custom_fields->>'Data e Hora do Agendamento')::bigint) ELSE NULL END,
    -- data_cancelamento_fmt: só preenchida se o custom field existe e é numérico
    CASE WHEN (n.custom_fields->>'Data cancelamento') ~ '^\d+$'
      THEN to_timestamp((n.custom_fields->>'Data cancelamento')::bigint)::date ELSE NULL END,
    n.pipeline_origem, n.pipeline_onboarding, n.entrada_onboarding_at, n.lead_created_at,
    n.occurrence,
    -- NOVA REGRA DE cancelado:
    -- - Sem Data cancelamento → NÃO cancelado
    -- - Com Data cancelamento E Data Fechamento <= Data Cancelamento → CANCELADO
    -- - Com Data cancelamento E Data Fechamento > Data Cancelamento → RECUPERADO (não cancelado)
    CASE
      WHEN (n.custom_fields->>'Data cancelamento') ~ '^\d+$'
        AND (n.custom_fields->>'Data de Fechamento') ~ '^\d+$'
        AND (n.custom_fields->>'Data de Fechamento')::bigint > (n.custom_fields->>'Data cancelamento')::bigint
      THEN FALSE  -- recuperado
      WHEN (n.custom_fields->>'Data cancelamento') ~ '^\d+$'
      THEN TRUE   -- cancelado
      ELSE FALSE  -- sem data cancelamento → não cancelado
    END AS cancelado,
    -- cancelado_at: timestamp do custom field "Data cancelamento" (ou NULL).
    -- Removido o fallback pra movimentação porque agora cancelamento depende
    -- só do custom field.
    CASE WHEN (n.custom_fields->>'Data cancelamento') ~ '^\d+$'
      THEN to_timestamp((n.custom_fields->>'Data cancelamento')::bigint) ELSE NULL END AS cancelado_at,
    n.custom_fields
  FROM numbered n;

  GET DIAGNOSTICS row_count = ROW_COUNT;
  RETURN row_count || ' rows inserted';
END;
$function$;
