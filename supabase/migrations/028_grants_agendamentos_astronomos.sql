-- 028_grants_agendamentos_astronomos.sql — concede SELECT pras roles do PostgREST
-- (anon e authenticated). Sem isso, a RLS nem chega a ser avaliada e o cliente
-- recebe 42501 "permission denied". service_role já tem ALL por padrão no Supabase.

GRANT SELECT ON gold.agendamentos_astronomos TO anon, authenticated;
GRANT ALL    ON gold.agendamentos_astronomos TO service_role;

GRANT SELECT ON bronze.kommo_task_types TO anon, authenticated;
GRANT ALL    ON bronze.kommo_task_types TO service_role;
