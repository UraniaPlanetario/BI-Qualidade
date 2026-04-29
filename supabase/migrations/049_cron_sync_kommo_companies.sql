-- Cron diário pra sincronizar empresas do Kommo. Roda às 8:00 UTC (5:00 BRT),
-- entre o sync de tasks (7:45 UTC) e o refresh do gold de agendamentos
-- (8:35 UTC), pra garantir que os campos da empresa cheguem na view antes
-- dela ser refreshed.
--
-- A function também faz backfill bidirecional: pra cada empresa iterada,
-- atualiza bronze.kommo_leads_raw.company_id em massa via _embedded.leads.
-- Isso resolve o gap onde leads antigos (fora da janela de days=3 do
-- sync-kommo-leads-daily) não têm company_id.

SELECT cron.unschedule('sync-kommo-companies-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-kommo-companies-daily');

SELECT cron.schedule(
  'sync-kommo-companies-daily',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://wkunbifgxntzbufjkize.supabase.co/functions/v1/sync-kommo-companies',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
