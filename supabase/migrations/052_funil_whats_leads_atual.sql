-- View gold.funil_whats_leads_atual — 1 row por lead atualmente no pipeline
-- "Vendas WhatsApp" (pipeline_id 10832516), com tudo que o dashboard de
-- Auditoria do Funil de Vendas precisa pra montar a aba "Hoje":
--   - dados básicos do lead (nome, status, responsável, vendedor)
--   - quando entrou no funil (criação OU primeira movimentação pra cá)
--   - quando entrou na etapa atual (última movimentação que o trouxe pra etapa)
--   - tarefa aberta vinculada (se houver) + dias vencida
--   - última mensagem ENVIADA (qualquer remetente, bot ou humano)

CREATE OR REPLACE VIEW gold.funil_whats_leads_atual AS
WITH
-- Primeira entrada no Vendas WhatsApp (vindo de outro pipeline). Pra leads
-- que nasceram no funil, esse CTE não retorna linha — usamos created_at
-- como fallback no SELECT principal.
entrada_funil AS (
  SELECT lead_id, MIN(moved_at) AS entrada_at
  FROM gold.leads_movements
  WHERE pipeline_to_id = 10832516
    AND (pipeline_from_id IS DISTINCT FROM 10832516)
  GROUP BY lead_id
),
-- Quando o lead entrou na etapa em que está hoje. Pegamos a última mov
-- (mais recente) cujo destino bate com o status_id atual do lead.
entrada_etapa_atual AS (
  SELECT m.lead_id, MAX(m.moved_at) AS entrada_at
  FROM gold.leads_movements m
  JOIN bronze.kommo_leads_raw l ON l.id = m.lead_id
  WHERE m.pipeline_to_id = 10832516
    AND m.status_to_id = l.status_id
  GROUP BY m.lead_id
),
-- Última mensagem ENVIADA (bot ou humano) — independente da janela comercial.
ultima_msg AS (
  SELECT lead_id, MAX(data_criacao) AS enviada_at
  FROM gold.cubo_historico_mensagens
  WHERE tipo = 'enviada'
  GROUP BY lead_id
),
-- Tarefa aberta com prazo mais próximo (se múltiplas no lead). Usamos a
-- mais "urgente" — vencida há mais tempo OU prazo mais próximo.
tarefa_aberta AS (
  SELECT DISTINCT ON (entity_id)
    entity_id AS lead_id,
    id AS tarefa_id,
    text AS tarefa_text,
    complete_till AS tarefa_complete_till,
    responsible_user_id AS tarefa_responsible_user_id,
    responsible_user_name AS tarefa_responsible_user_name,
    created_at AS tarefa_created_at
  FROM bronze.kommo_tasks
  WHERE entity_type = 'leads'
    AND COALESCE(is_completed, false) = false
  ORDER BY entity_id, complete_till ASC NULLS LAST
)
SELECT
  l.id AS lead_id,
  l.name AS lead_name,
  l.responsible_user_id,
  l.responsible_user_name,
  l.custom_fields->>'Vendedor/Consultor' AS vendedor_consultor,
  l.pipeline_id,
  l.pipeline_name,
  l.status_id,
  l.status_name,
  l.created_at AS lead_created_at,
  COALESCE(ef.entrada_at, l.created_at) AS entrada_funil_at,
  COALESCE(ee.entrada_at, ef.entrada_at, l.created_at) AS entrada_etapa_atual_at,
  -- Computamos os dias na própria view pra facilitar ordenação no PostgREST
  EXTRACT(EPOCH FROM (NOW() - COALESCE(ef.entrada_at, l.created_at))) / 86400.0
    AS dias_no_funil,
  EXTRACT(EPOCH FROM (NOW() - COALESCE(ee.entrada_at, ef.entrada_at, l.created_at))) / 86400.0
    AS dias_na_etapa_atual,
  ta.tarefa_id,
  ta.tarefa_text,
  ta.tarefa_complete_till,
  ta.tarefa_responsible_user_id,
  ta.tarefa_responsible_user_name,
  CASE
    WHEN ta.tarefa_complete_till IS NULL THEN NULL
    WHEN ta.tarefa_complete_till >= NOW() THEN 0
    ELSE EXTRACT(EPOCH FROM (NOW() - ta.tarefa_complete_till)) / 86400.0
  END AS dias_tarefa_vencida,
  um.enviada_at AS ultima_msg_enviada_at,
  CASE
    WHEN um.enviada_at IS NULL THEN NULL
    ELSE EXTRACT(EPOCH FROM (NOW() - um.enviada_at)) / 86400.0
  END AS dias_sem_interacao
FROM bronze.kommo_leads_raw l
LEFT JOIN entrada_funil       ef ON ef.lead_id = l.id
LEFT JOIN entrada_etapa_atual ee ON ee.lead_id = l.id
LEFT JOIN tarefa_aberta       ta ON ta.lead_id = l.id
LEFT JOIN ultima_msg          um ON um.lead_id = l.id
WHERE l.pipeline_id = 10832516
  AND l.is_deleted IS NOT TRUE;

GRANT SELECT ON gold.funil_whats_leads_atual TO anon, authenticated;
GRANT ALL    ON gold.funil_whats_leads_atual TO service_role;
