-- lista_vendedores_pra_impersonar: filtra fora vendedores sem kommo_user_id
-- (não faz sentido impersonar quem não tem o id mapeado — Auditoria não funciona).
-- Antes era LEFT JOIN; agora INNER JOIN.

CREATE OR REPLACE FUNCTION gold.lista_vendedores_pra_impersonar()
RETURNS TABLE (vendedor TEXT, kommo_user_id BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'gold', 'bronze'
AS $$
  WITH vendedores AS (
    SELECT DISTINCT vendedor FROM gold.leads_closed WHERE vendedor IS NOT NULL
  ),
  kommo_users AS (
    SELECT id, name FROM bronze.kommo_users WHERE COALESCE(is_active, true) = true
  )
  SELECT v.vendedor::TEXT, ku.id::BIGINT AS kommo_user_id
  FROM vendedores v
  JOIN kommo_users ku ON ku.name = v.vendedor
  ORDER BY v.vendedor;
$$;
