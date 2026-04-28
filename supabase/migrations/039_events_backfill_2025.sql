-- Backfill incremental de bronze.kommo_events_raw pra cobrir 2025.
-- O sync diário só pega updated_at >= 3d, então o histórico só tem jan-abr/2026.
-- Esse cron roda toda madrugada (02:00 BRT = 05:00 UTC) e processa uma janela
-- de 5 dias indo de trás pra frente, terminando quando chegar em 2025-01-01.
--
-- Estratégia:
--   - Tabela `config.events_backfill_progress` guarda o cursor (`next_to`)
--   - Cada execução: from_ts = next_to - 5 dias, to_ts = next_to
--   - Após sucesso, atualiza next_to = next_to - 5 dias
--   - Se next_to < 2025-01-01, marca como concluído e o cron vira no-op
--
-- Volume estimado: ~200k eventos/janela × 73 noites = ~15M eventos cobrindo 2025.
-- Em meses de recesso (jul/dez) o volume é menor; em meses cheios pode chegar
-- perto do limite (500 pages × 250 = 125k).

CREATE TABLE IF NOT EXISTS config.events_backfill_progress (
  id           int PRIMARY KEY DEFAULT 1,
  next_to      timestamptz NOT NULL,
  cutoff       timestamptz NOT NULL,
  step_days    int NOT NULL DEFAULT 5,
  is_done      boolean NOT NULL DEFAULT false,
  last_run_at  timestamptz,
  last_status  text,
  CONSTRAINT singleton CHECK (id = 1)
);

ALTER TABLE config.events_backfill_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_all_authenticated" ON config.events_backfill_progress
  FOR SELECT TO authenticated, anon USING (true);
GRANT SELECT ON config.events_backfill_progress TO anon, authenticated;
GRANT ALL    ON config.events_backfill_progress TO service_role;

INSERT INTO config.events_backfill_progress (id, next_to, cutoff, step_days)
VALUES (1, '2026-01-01 00:00:00+00', '2025-01-01 00:00:00+00', 5)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION config.run_events_backfill()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  prog config.events_backfill_progress;
  from_ts bigint;
  to_ts bigint;
  request_id bigint;
BEGIN
  SELECT * INTO prog FROM config.events_backfill_progress WHERE id = 1;

  IF prog.is_done THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'backfill ja concluido');
  END IF;

  IF prog.next_to <= prog.cutoff THEN
    UPDATE config.events_backfill_progress
    SET is_done = true, last_run_at = now(), last_status = 'reached cutoff'
    WHERE id = 1;
    RETURN jsonb_build_object('done', true, 'reached_cutoff', prog.cutoff);
  END IF;

  from_ts := EXTRACT(EPOCH FROM (prog.next_to - (prog.step_days || ' days')::interval))::bigint;
  to_ts   := EXTRACT(EPOCH FROM prog.next_to)::bigint;

  SELECT net.http_post(
    url := 'https://wkunbifgxntzbufjkize.supabase.co/functions/v1/sync-kommo-events-daily?from_ts='
           || from_ts::text || '&to_ts=' || to_ts::text || '&maxPages=500',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrdW5iaWZneG50emJ1ZmpraXplIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTA2OTQzMCwiZXhwIjoyMDkwNjQ1NDMwfQ.ynJzC1LXe_La2MJ9-rGKjwymb09tPp_-YP8CVkbyhAw',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  ) INTO request_id;

  UPDATE config.events_backfill_progress
  SET next_to = prog.next_to - (prog.step_days || ' days')::interval,
      last_run_at = now(),
      last_status = 'dispatched request_id=' || request_id::text
                    || ' window=' || prog.next_to::text
                    || ' minus ' || prog.step_days || 'd'
  WHERE id = 1;

  RETURN jsonb_build_object(
    'dispatched', true,
    'request_id', request_id,
    'from_ts', from_ts,
    'to_ts', to_ts,
    'next_to_after', prog.next_to - (prog.step_days || ' days')::interval
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION config.run_events_backfill() TO service_role;

SELECT cron.schedule(
  'events-backfill-2025',
  '0 5 * * *',
  $$ SELECT config.run_events_backfill(); $$
);
