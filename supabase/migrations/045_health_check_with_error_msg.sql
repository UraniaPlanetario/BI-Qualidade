-- Inclui a mensagem de erro retornada pelo pg_cron na detecção de cron_falhou,
-- além de descrições humanas pros tipos de problema. O payload do alerta passa
-- a ter o motivo exato da falha (statement timeout, lock timeout, OOM, etc),
-- útil pra o email enviado pelo n8n explicar o problema sem precisar abrir o PG.

CREATE OR REPLACE FUNCTION gold.check_refresh_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  problemas jsonb := '[]'::jsonb;
  rec record;
  max_ts timestamptz;
BEGIN
  FOR rec IN
    SELECT j.jobname,
           (SELECT MAX(d.start_time) FROM cron.job_run_details d
            WHERE d.jobid = j.jobid AND d.start_time > now() - interval '26 hours') AS last_run,
           (SELECT d.status FROM cron.job_run_details d
            WHERE d.jobid = j.jobid AND d.start_time > now() - interval '26 hours'
            ORDER BY d.start_time DESC LIMIT 1) AS last_status,
           (SELECT d.return_message FROM cron.job_run_details d
            WHERE d.jobid = j.jobid AND d.start_time > now() - interval '26 hours'
            ORDER BY d.start_time DESC LIMIT 1) AS last_message
    FROM cron.job j
    WHERE j.jobname LIKE 'refresh-%'
  LOOP
    IF rec.last_run IS NULL THEN
      problemas := problemas || jsonb_build_object(
        'tipo', 'cron_nao_rodou',
        'job', rec.jobname,
        'descricao', 'Job não executou nas últimas 26h'
      );
    ELSIF rec.last_status <> 'succeeded' THEN
      problemas := problemas || jsonb_build_object(
        'tipo', 'cron_falhou',
        'job', rec.jobname,
        'status', rec.last_status,
        'last_run', rec.last_run,
        'erro', rec.last_message
      );
    END IF;
  END LOOP;

  SELECT MAX(moved_at) INTO max_ts FROM gold.leads_movements;
  IF max_ts IS NULL OR max_ts < now() - interval '2 days' THEN
    problemas := problemas || jsonb_build_object(
      'tipo', 'tabela_atrasada',
      'tabela', 'gold.leads_movements',
      'ultima_atualizacao', max_ts,
      'descricao', 'A tabela está com mais de 2 dias sem atualização — refreshes podem estar falhando.'
    );
  END IF;

  SELECT MAX(data_fechamento_fmt::timestamp) INTO max_ts FROM gold.leads_closed;
  IF max_ts IS NULL OR max_ts < now() - interval '2 days' THEN
    problemas := problemas || jsonb_build_object(
      'tipo', 'tabela_atrasada',
      'tabela', 'gold.leads_closed',
      'ultima_atualizacao', max_ts,
      'descricao', 'Sem fechamentos novos há mais de 2 dias — pode ser cenário real (sem fechamentos) ou refresh travado.'
    );
  END IF;

  SELECT MAX(activity_date::timestamp) INTO max_ts FROM gold.user_activities_daily;
  IF max_ts IS NULL OR max_ts < now() - interval '2 days' THEN
    problemas := problemas || jsonb_build_object(
      'tipo', 'tabela_atrasada',
      'tabela', 'gold.user_activities_daily',
      'ultima_atualizacao', max_ts,
      'descricao', 'Atividades diárias dos usuários não foram atualizadas.'
    );
  END IF;

  RETURN jsonb_build_object(
    'checked_at', now(),
    'problemas', problemas,
    'tem_problema', jsonb_array_length(problemas) > 0
  );
END;
$function$;
