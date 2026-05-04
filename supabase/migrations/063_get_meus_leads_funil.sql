-- RPC retorna leads do vendedor logado em gold.funil_whats_leads_atual.
-- Cruza lead.responsible_user_id com users.kommo_user_id do user logado.
-- SECURITY DEFINER pra cliente nunca receber dados de outros vendedores.

CREATE OR REPLACE FUNCTION gold.get_meus_leads_funil()
RETURNS SETOF gold.funil_whats_leads_atual
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'gold'
AS $$
  SELECT * FROM gold.funil_whats_leads_atual
  WHERE responsible_user_id = (
    SELECT u.kommo_user_id FROM public.users u
    WHERE u.auth_user_id = auth.uid() AND u.kommo_user_id IS NOT NULL LIMIT 1
  );
$$;

GRANT EXECUTE ON FUNCTION gold.get_meus_leads_funil() TO anon, authenticated;
