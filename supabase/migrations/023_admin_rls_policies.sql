-- Correção: is_bi_admin() apontava pra users_new (renomeada pra users em migration 018)
-- e tabelas da Admin UI tinham apenas policy de SELECT, bloqueando INSERT/UPDATE/DELETE
-- até pra admins globais.

CREATE OR REPLACE FUNCTION public.is_bi_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid() AND u.is_global_admin = true
  );
$function$;

-- Policy FOR ALL (INSERT/UPDATE/DELETE/SELECT) restrita a global admins nas tabelas
-- editadas pela Admin UI. service_role bypassa RLS, edge functions continuam OK.
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'users', 'user_platform_access', 'user_departments',
    'department_route_access', 'route_access_policies', 'route_access_rules',
    'departments', 'platforms'
  ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS admin_write_all ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY admin_write_all ON public.%I
         FOR ALL TO authenticated
         USING (public.is_bi_admin())
         WITH CHECK (public.is_bi_admin())',
      t
    );
  END LOOP;
END $$;
