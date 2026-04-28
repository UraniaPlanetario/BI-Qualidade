-- v4: amplia a classificação como Recorrente pra capturar leads que passaram
-- TEMPO em Clientes-CS (mesmo sem registro da entrada original — pode ser
-- pre-bronze ou registrada como mudança de status). Mantém o cálculo preciso
-- de tempo da v3.
--
-- Classificação Recorrente: lead teve QUALQUER movement em Clientes-CS antes
--   da entrada atual no onboarding (cobre entrada original + mudanças de status).
-- Tempo Recorrente: usa a "última Venda Ganha em Onboarding anterior" ou,
--   no fallback, a entrada ORIGINAL em Clientes-CS (filtrada). Se nenhum
--   marco existir, tempo = NULL (lead muito antigo, pre-bronze).

CREATE OR REPLACE VIEW gold.leads_closed_origem AS
WITH leads_ts AS (
  SELECT lc.* FROM gold.leads_closed lc
  WHERE lc.data_fechamento_fmt IS NOT NULL
),
movs AS (
  SELECT
    l.id,
    -- Pra CLASSIFICAÇÃO: qualquer presença em Clientes-CS antes do fechamento atual
    MAX(m.moved_at) FILTER (WHERE m.pipeline_to = 'Clientes - CS') AS qualquer_clientes_cs,
    -- Pra TEMPO: entrada ORIGINAL em Clientes-CS (vinda de outro pipeline)
    MAX(m.moved_at) FILTER (
      WHERE m.pipeline_to = 'Clientes - CS'
        AND (m.pipeline_from IS NULL OR m.pipeline_from <> 'Clientes - CS')
    ) AS entrada_original_clientes_cs,
    -- Pra TEMPO: última "Venda Ganha" no Onboarding anterior (preferida)
    MAX(m.moved_at) FILTER (
      WHERE m.status_to = 'Venda ganha'
        AND m.pipeline_to IN ('Onboarding Escolas', 'Onboarding SME')
    ) AS ultima_venda_ganha_onb,
    MAX(m.moved_at) FILTER (
      WHERE m.status_to IN ('Oportunidade Reativada', 'Reativação CRM')
    ) AS ultima_reativada,
    MAX(m.moved_at) FILTER (
      WHERE m.pipeline_to = 'Resgate/Nutrição Whats'
        AND (m.pipeline_from IS NULL OR m.pipeline_from <> 'Resgate/Nutrição Whats')
    ) AS ultima_resgate
  FROM leads_ts l
  LEFT JOIN gold.leads_movements m
    ON m.lead_id = l.lead_id
   AND m.moved_at < l.entrada_onboarding_at
  GROUP BY l.id
)
SELECT
  l.id, l.lead_id, l.lead_name, l.lead_price, l.vendedor, l.sdr,
  l.cidade_estado, l.tipo_cliente, l.produtos,
  l.data_fechamento_fmt, l.data_agendamento_fmt, l.data_cancelamento_fmt,
  l.n_diarias, l.faixa_alunos, l.n_alunos,
  l.pipeline_origem, l.pipeline_onboarding, l.entrada_onboarding_at,
  l.lead_created_at, l.occurrence, l.cancelado, l.cancelado_at,
  l.canal_entrada, l.origem_oportunidade, l.astronomo,
  CASE
    WHEN m.qualquer_clientes_cs IS NOT NULL THEN 'Recorrente'
    WHEN m.ultima_reativada IS NOT NULL     THEN 'Reativada'
    WHEN m.ultima_resgate IS NOT NULL       THEN 'Resgate'
    ELSE 'Direto'
  END AS caminho_origem,
  CASE
    WHEN m.qualquer_clientes_cs IS NOT NULL
      THEN COALESCE(m.ultima_venda_ganha_onb, m.entrada_original_clientes_cs)
    ELSE l.lead_created_at
  END AS entrada_caminho_at,
  CASE
    WHEN m.qualquer_clientes_cs IS NOT NULL THEN
      CASE
        WHEN COALESCE(m.ultima_venda_ganha_onb, m.entrada_original_clientes_cs) IS NOT NULL THEN
          ROUND(EXTRACT(EPOCH FROM (l.entrada_onboarding_at -
            COALESCE(m.ultima_venda_ganha_onb, m.entrada_original_clientes_cs)))::numeric / 86400, 1)
        ELSE NULL
      END
    ELSE
      ROUND(EXTRACT(EPOCH FROM (l.entrada_onboarding_at - l.lead_created_at))::numeric / 86400, 1)
  END AS tempo_dias_caminho,
  ROUND(EXTRACT(EPOCH FROM (l.entrada_onboarding_at - l.lead_created_at))::numeric / 86400, 1) AS tempo_dias_total
FROM leads_ts l
LEFT JOIN movs m ON m.id = l.id;

GRANT SELECT ON gold.leads_closed_origem TO anon, authenticated;
GRANT ALL    ON gold.leads_closed_origem TO service_role;
