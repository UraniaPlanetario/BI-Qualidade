-- ============================================================================
-- Performance: RPC agregada + índices para Monitoramento de Usuários
-- ============================================================================

-- Índice para JOIN da view alteracoes_humanas (config.dim_campos → cubo_alteracao)
CREATE INDEX IF NOT EXISTS idx_ca_campo
  ON gold.cubo_alteracao_campos_eventos(campo_id);

-- Índice composto para mensagens_por_user_lead
CREATE INDEX IF NOT EXISTS idx_chm_criado_por_data
  ON gold.cubo_historico_mensagens(criado_por_id, data_criacao)
  WHERE tipo = 'enviada';

-- RPC agregada para Overview/UsersBlock/Consistência/Ranking
-- Substitui a paginação de ~34 páginas × 1000 linhas (10–15s) por
-- uma única chamada retornando ~900 linhas pré-agregadas (<1s).
-- UserDetailBlock continua consumindo user_activities_humanas bruta
-- (precisa de granularidade por hora), carregada lazy só quando a
-- aba "Por Usuário" é ativada.
CREATE OR REPLACE FUNCTION gold.activities_summary_periodo(
  p_from timestamptz,
  p_to timestamptz
) RETURNS TABLE(
  user_id bigint,
  user_name text,
  role_name text,
  category text,
  event_type text,
  total bigint,
  dias_com_atividade integer
) LANGUAGE sql STABLE AS $$
  WITH meta AS (
    SELECT COUNT(DISTINCT activity_date)::int AS dias
    FROM gold.user_activities_humanas
    WHERE activity_date >= p_from::date AND activity_date <= p_to::date
  )
  SELECT
    uad.user_id,
    uad.user_name,
    uad.role_name,
    uad.category,
    uad.event_type,
    SUM(uad.activity_count)::bigint AS total,
    m.dias AS dias_com_atividade
  FROM gold.user_activities_humanas uad
  CROSS JOIN meta m
  WHERE uad.activity_date >= p_from::date AND uad.activity_date <= p_to::date
  GROUP BY uad.user_id, uad.user_name, uad.role_name, uad.category, uad.event_type, m.dias;
$$;

GRANT EXECUTE ON FUNCTION gold.activities_summary_periodo(timestamptz, timestamptz)
  TO anon, authenticated, service_role;
