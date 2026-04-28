-- View `gold.leads_closed_origem`: enriquece gold.leads_closed com classificação
-- de caminho no CRM (Recorrente / Reativada / Resgate / Direto) e tempo
-- canônico até o fechamento.
--
-- Hierarquia (1 caminho por OCURRÊNCIA de fechamento — leads recorrentes
-- têm múltiplas linhas em leads_closed via `occurrence`):
--   1. Recorrente — passou por pipeline "Clientes - CS" antes do fechamento
--   2. Reativada — passou por status "Oportunidade Reativada" / "Reativação CRM"
--   3. Resgate   — passou por pipeline "Resgate/Nutrição Whats"
--   4. Direto    — nenhum dos acima
--
-- O tempo canônico mede a janela relevante pra cada caminho:
--   - Recorrente: tempo desde a última entrada em Clientes-CS antes do fechamento
--   - Reativada: tempo desde a última entrada em status reativada
--   - Resgate:   tempo desde a última entrada no pipeline de resgate
--   - Direto:    tempo desde a criação do lead

CREATE OR REPLACE VIEW gold.leads_closed_origem AS
WITH leads_ts AS (
  SELECT
    lc.*,
    (lc.data_fechamento_fmt::timestamp + interval '23 hours 59 minutes')
      AT TIME ZONE 'America/Sao_Paulo' AS fechamento_ts
  FROM gold.leads_closed lc
  WHERE lc.data_fechamento_fmt IS NOT NULL
),
movs AS (
  SELECT
    l.id,
    MAX(m.moved_at) FILTER (WHERE m.pipeline_to = 'Clientes - CS') AS ultima_clientes_cs,
    MAX(m.moved_at) FILTER (WHERE m.status_to IN ('Oportunidade Reativada', 'Reativação CRM')) AS ultima_reativada,
    MAX(m.moved_at) FILTER (WHERE m.pipeline_to = 'Resgate/Nutrição Whats') AS ultima_resgate
  FROM leads_ts l
  LEFT JOIN gold.leads_movements m
    ON m.lead_id = l.lead_id AND m.moved_at < l.fechamento_ts
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
    WHEN m.ultima_clientes_cs IS NOT NULL THEN 'Recorrente'
    WHEN m.ultima_reativada IS NOT NULL    THEN 'Reativada'
    WHEN m.ultima_resgate IS NOT NULL      THEN 'Resgate'
    ELSE 'Direto'
  END AS caminho_origem,
  COALESCE(m.ultima_clientes_cs, m.ultima_reativada, m.ultima_resgate, l.lead_created_at) AS entrada_caminho_at,
  ROUND(
    EXTRACT(EPOCH FROM (
      l.fechamento_ts -
      COALESCE(m.ultima_clientes_cs, m.ultima_reativada, m.ultima_resgate, l.lead_created_at)
    ))::numeric / 86400,
    1
  ) AS tempo_dias_caminho,
  ROUND(
    EXTRACT(EPOCH FROM (l.fechamento_ts - l.lead_created_at))::numeric / 86400,
    1
  ) AS tempo_dias_total
FROM leads_ts l
LEFT JOIN movs m ON m.id = l.id;

GRANT SELECT ON gold.leads_closed_origem TO anon, authenticated;
GRANT ALL    ON gold.leads_closed_origem TO service_role;
