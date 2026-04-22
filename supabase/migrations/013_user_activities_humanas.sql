-- ============================================================================
-- View filtrada user_activities_humanas — usada em todo o Monitoramento
-- de Usuários (Visão Geral, Por Categoria, Por Usuário, Consistência CRM,
-- Ranking por Percentil)
--
-- Filtros aplicados:
-- 1. Custom field events só contam se o campo_id estiver em
--    config.dim_campos com incluir=true (whitelist humana)
-- 2. Tarefas só contam task_added e task_completed (criação e conclusão
--    manual). Exclui task_text_changed, task_deadline_changed,
--    task_type_changed, task_deleted e task_result_added.
-- ============================================================================

CREATE OR REPLACE VIEW gold.user_activities_humanas AS
SELECT uad.*
FROM gold.user_activities_daily uad
WHERE NOT (
  (uad.event_type ~ '^custom_field_\d+_value_changed$'
    AND (substring(uad.event_type from 'custom_field_(\d+)_value_changed')::bigint)
      NOT IN (SELECT campo_id FROM config.dim_campos WHERE incluir = true))
  OR uad.event_type IN (
    'task_text_changed', 'task_deadline_changed', 'task_type_changed',
    'task_deleted', 'task_result_added'
  )
);

GRANT SELECT ON gold.user_activities_humanas TO anon, authenticated, service_role;
