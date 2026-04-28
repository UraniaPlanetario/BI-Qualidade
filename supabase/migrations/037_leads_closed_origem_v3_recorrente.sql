-- v3 da view leads_closed_origem — corrige o tempo do caminho Recorrente.
--
-- Problema da v2: usava MAX(moved_at) WHERE pipeline_to='Clientes - CS', que
-- capturava também mudanças de STATUS dentro do Clientes-CS (Negociação →
-- Pré Reserva → Venda Ganha). Como essas mudanças costumam acontecer horas
-- antes do reentry no Onboarding, o tempo médio de Recorrente caía pra ~1 dia.
--
-- v3:
--   - Cutoff agora é `entrada_onboarding_at` (timestamptz preciso) em vez de
--     fechamento_fmt + 23h59 (impreciso, podia capturar movements do mesmo dia).
--   - Pra TEMPO de Recorrente, usa o marco "fim do atendimento anterior":
--       1ª escolha: última `status_to='Venda ganha' AND pipeline_to IN (Onb...)`
--                   antes da entrada atual no Onboarding (= fim da última visita)
--       2ª escolha (fallback): primeira ENTRADA em Clientes-CS (filtrando
--                   `pipeline_from <> 'Clientes - CS'` pra ignorar mudanças
--                   internas de status)
--   - Quando nenhum desses marcos existe (lead antigo, pre-bronze), o tempo
--     fica NULL — melhor honesto que enganoso.
--
-- (Substituída pela v4 — migration 038 — que amplia a classificação como
-- Recorrente para capturar leads sem entrada original rastreável.)

CREATE OR REPLACE VIEW gold.leads_closed_origem AS
WITH leads_ts AS (
  SELECT lc.* FROM gold.leads_closed lc
  WHERE lc.data_fechamento_fmt IS NOT NULL
),
movs AS (
  SELECT
    l.id,
    MAX(m.moved_at) FILTER (
      WHERE m.pipeline_to = 'Clientes - CS'
        AND (m.pipeline_from IS NULL OR m.pipeline_from <> 'Clientes - CS')
    ) AS ultima_entrada_clientes_cs,
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
    WHEN m.ultima_entrada_clientes_cs IS NOT NULL THEN 'Recorrente'
    WHEN m.ultima_reativada IS NOT NULL            THEN 'Reativada'
    WHEN m.ultima_resgate IS NOT NULL              THEN 'Resgate'
    ELSE 'Direto'
  END AS caminho_origem,
  CASE
    WHEN m.ultima_entrada_clientes_cs IS NOT NULL THEN COALESCE(m.ultima_venda_ganha_onb, m.ultima_entrada_clientes_cs)
    ELSE l.lead_created_at
  END AS entrada_caminho_at,
  CASE
    WHEN m.ultima_entrada_clientes_cs IS NOT NULL THEN
      CASE
        WHEN COALESCE(m.ultima_venda_ganha_onb, m.ultima_entrada_clientes_cs) IS NOT NULL THEN
          ROUND(EXTRACT(EPOCH FROM (l.entrada_onboarding_at -
            COALESCE(m.ultima_venda_ganha_onb, m.ultima_entrada_clientes_cs)))::numeric / 86400, 1)
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
