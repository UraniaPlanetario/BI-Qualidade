-- O trigger ATIVO em auth.users (on_auth_user_created) chama
-- handle_new_auth_user que apontava pra public.users_new — tabela renomeada
-- pra public.users na migration 018. Como o trigger é SECURITY DEFINER e roda
-- dentro do auth.users INSERT, qualquer falha aborta o INSERT com
-- "Database error saving new user". Bug detectado quando admin tentou enviar
-- email de criar senha pra usuário shadow.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  existing_id uuid;
BEGIN
  SELECT id INTO existing_id
  FROM public.users
  WHERE email = NEW.email;

  IF existing_id IS NOT NULL THEN
    UPDATE public.users
    SET auth_user_id = NEW.id, updated_at = now()
    WHERE id = existing_id AND auth_user_id IS DISTINCT FROM NEW.id;
  ELSE
    INSERT INTO public.users (id, auth_user_id, email, full_name, is_active)
    VALUES (
      NEW.id,
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      true
    )
    ON CONFLICT (email) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;
