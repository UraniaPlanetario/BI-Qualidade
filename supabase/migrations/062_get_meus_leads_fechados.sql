-- RPC retorna leads_closed do vendedor logado + pipeline/status atuais.
-- Filtragem feita no banco via SECURITY DEFINER — cliente nunca recebe dados
-- de outro vendedor.

CREATE OR REPLACE FUNCTION gold.get_meus_leads_fechados()
RETURNS TABLE (
  lead_id bigint,
  lead_name text,
  vendedor text,
  data_fechamento_fmt date,
  data_agendamento_fmt timestamptz,
  data_cancelamento_fmt date,
  cancelado boolean,
  pipeline_onboarding text,
  pipeline_atual text,
  status_atual text,
  lead_price numeric,
  n_diarias text,
  occurrence int,
  lead_created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'gold', 'bronze'
AS $$
  SELECT
    lc.lead_id,
    lc.lead_name,
    lc.vendedor,
    lc.data_fechamento_fmt,
    lc.data_agendamento_fmt,
    lc.data_cancelamento_fmt,
    lc.cancelado,
    lc.pipeline_onboarding,
    l.pipeline_name AS pipeline_atual,
    l.status_name AS status_atual,
    lc.lead_price,
    lc.n_diarias,
    lc.occurrence,
    lc.lead_created_at
  FROM gold.leads_closed lc
  LEFT JOIN bronze.kommo_leads_raw l ON l.id = lc.lead_id
  WHERE lc.vendedor = (
    SELECT u.vendedor_consultor FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND u.vendedor_consultor IS NOT NULL
    LIMIT 1
  );
$$;

GRANT EXECUTE ON FUNCTION gold.get_meus_leads_fechados() TO anon, authenticated;
