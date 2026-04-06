-- Habilitar pg_cron e pg_net (necessários para agendamento)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Agendar sync diário às 6:30h (horário de Brasília = 9:30 UTC)
-- Chama a Edge Function via pg_net
SELECT cron.schedule(
  'sync-kommo-quality-daily',
  '30 9 * * *',  -- 9:30 UTC = 6:30 BRT
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/sync-kommo-quality',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
