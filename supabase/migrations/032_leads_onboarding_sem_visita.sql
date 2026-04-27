-- View `gold.leads_onboarding_sem_visita`: leads ativos nos funis de onboarding
-- (Onboarding Escolas, Onboarding SME) que NÃO têm tarefa de VISITA aberta
-- atribuída a um astrônomo. Cenário ideal: todo lead em onboarding tem 1 VISITA
-- aberta (a tarefa é o que aciona o astrônomo). Quem aparece aqui é desvio
-- operacional — possíveis casos:
--   1. Lead vazio movido pra onboarding por engano (sem escola/astrônomo)
--   2. Lead com VISITA já completa mas ainda no funil (provável fechamento administrativo)
--   3. Lead com agendamento marcado no card mas sem tarefa criada → bug operacional
-- A view inclui flag `tem_agendamento_futuro` pra ajudar a triar os casos críticos.

CREATE OR REPLACE VIEW gold.leads_onboarding_sem_visita AS
WITH leads_onb AS (
  SELECT
    l.id AS lead_id,
    l.pipeline_name,
    l.status_id,
    l.created_at,
    l.custom_fields->>'Nome da escola' AS nome_escola,
    l.custom_fields->>'Astrônomo'      AS astronomo_card,
    l.custom_fields->>'Cidade - Estado' AS cidade_estado,
    l.custom_fields->>'Responsável pelo evento' AS responsavel_evento,
    CASE WHEN (l.custom_fields->>'Data e Hora do Agendamento') ~ '^\d{9,10}$'
      THEN to_timestamp((l.custom_fields->>'Data e Hora do Agendamento')::bigint)
      ELSE NULL END AS data_agendamento
  FROM bronze.kommo_leads_raw l
  WHERE l.closed_at IS NULL
    AND l.pipeline_name IN ('Onboarding Escolas', 'Onboarding SME')
)
SELECT
  o.lead_id,
  o.pipeline_name,
  o.nome_escola,
  o.astronomo_card,
  o.cidade_estado,
  o.responsavel_evento,
  o.data_agendamento,
  o.created_at,
  -- Resumo das tarefas existentes no lead (ajuda a entender o caso)
  (SELECT string_agg(
     COALESCE(tt.name, 'task_type ' || t.task_type_id::text)
       || ' (' || CASE WHEN t.is_completed THEN 'completa'
                       WHEN t.complete_till < now() THEN 'atrasada'
                       ELSE 'aberta' END || ')',
     ' | ' ORDER BY t.created_at DESC)
   FROM bronze.kommo_tasks t
   LEFT JOIN bronze.kommo_task_types tt ON tt.id = t.task_type_id
   WHERE t.entity_id = o.lead_id) AS tarefas_no_lead,
  -- Flags pra triagem
  (o.nome_escola IS NULL AND o.astronomo_card IS NULL) AS lead_vazio,
  (o.data_agendamento IS NOT NULL AND o.data_agendamento > now()) AS tem_agendamento_futuro,
  EXISTS (
    SELECT 1 FROM gold.agendamentos_astronomos a
    WHERE a.lead_id = o.lead_id AND a.desc_tarefa = 'VISITA' AND a.status_tarefa = 'completa'
  ) AS ja_teve_visita_completa
FROM leads_onb o
WHERE NOT EXISTS (
  SELECT 1 FROM gold.agendamentos_astronomos a
  WHERE a.lead_id = o.lead_id
    AND a.desc_tarefa = 'VISITA'
    AND a.status_tarefa <> 'completa'
);

GRANT SELECT ON gold.leads_onboarding_sem_visita TO anon, authenticated;
GRANT ALL    ON gold.leads_onboarding_sem_visita TO service_role;
