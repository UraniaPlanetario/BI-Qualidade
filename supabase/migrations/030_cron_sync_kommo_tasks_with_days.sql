-- Atualiza o cron sync-kommo-tasks-daily pra:
--   1) Passar ?onlyOpen=false&days=10  → traz abertas + concluídas dos últimos 10 dias
--   2) Adicionar Authorization (service_role legacy JWT, mesmo padrão de sync-from-hub-daily)
-- Motivo: o sync antigo rodava sem days e sem onlyOpen=false, então só pegava
-- tarefas abertas e em ordem asc desde 2023. Atualizações recentes (status mudando
-- pra completa) nunca chegavam ao bronze. Bug detectado em 2026-04-27 após Julia
-- relatar tarefas marcadas como atrasadas no BI que estavam concluídas no Kommo.

SELECT cron.unschedule('sync-kommo-tasks-daily');

SELECT cron.schedule(
  'sync-kommo-tasks-daily',
  '45 7 * * *',
  $$
  SELECT net.http_post(
    url := 'https://wkunbifgxntzbufjkize.supabase.co/functions/v1/sync-kommo-tasks?onlyOpen=false&days=10&maxPages=50',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrdW5iaWZneG50emJ1ZmpraXplIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTA2OTQzMCwiZXhwIjoyMDkwNjQ1NDMwfQ.ynJzC1LXe_La2MJ9-rGKjwymb09tPp_-YP8CVkbyhAw',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
  $$
);
