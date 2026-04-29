-- Adiciona 3 campos qualitativos à view gold.qualidade_sdr — espelha a aba
-- "Qualitativo" da Qualidade de Fechamento. Os campos são preenchidos pela
-- líder de qualidade no card do lead (mesma fonte de dados, lead.custom_fields).
--
-- Custom field IDs no Kommo:
--   1151727 → "Score de Qualidade"           (select)   → score_qualidade
--   1150827 → "Observações gerais do atendimento" (textarea) → observacoes_gerais
--   1150829 → "Ponto Critico"                (textarea) → ponto_critico

DROP VIEW IF EXISTS gold.qualidade_sdr;

CREATE OR REPLACE VIEW gold.qualidade_sdr AS
WITH base AS (
  SELECT
    l.id AS lead_id,
    l.name AS lead_name,
    l.pipeline_name,
    l.status_name,
    l.created_at AS lead_created_at,
    l.updated_at AS lead_updated_at,
    lc.data_fechamento_fmt,
    COALESCE(lc.data_fechamento_fmt::date, l.updated_at::date) AS data_referencia,
    lc.canal_entrada,
    lc.vendedor,
    COALESCE(NULLIF(l.custom_fields->>'SDR', ''), lc.sdr) AS sdr,
    l.custom_fields AS cf
  FROM bronze.kommo_leads_raw l
  LEFT JOIN gold.leads_closed lc ON lc.lead_id = l.id AND NOT lc.cancelado
  WHERE l.is_deleted IS NOT TRUE
    AND l.custom_fields IS NOT NULL
    AND (
      l.custom_fields ? 'C1 Tempo de primeira ação (agilidade no atendimento)'
      OR l.custom_fields ? 'C1 Tentativa de ligação inicial'
      OR l.custom_fields ? 'C1 Registro correto no CRM (status/origem)'
      OR l.custom_fields ? 'C1 Clareza na primeira abordagem'
      OR l.custom_fields ? 'C1 Definição de próxima ação (follow-up)'
      OR l.custom_fields ? 'C2 Cumprimento do SLA (48h)'
      OR l.custom_fields ? 'C2 Cobertura de contato (acionou todos os leads)'
      OR l.custom_fields ? 'C2 Quantidade adequada de tentativas (1–2)'
      OR l.custom_fields ? 'C2 Uso equilibrado de canais (ligação + WhatsApp)'
      OR l.custom_fields ? 'C2 Identificação de sinais do lead'
      OR l.custom_fields ? 'C3 Cumprimento do SLA (72h)'
      OR l.custom_fields ? 'C3 Personalização da abordagem (quente vs frio)'
      OR l.custom_fields ? 'C3 Cadência bem distribuída'
      OR l.custom_fields ? 'C3 Tentativa de evolução da conversa'
      OR l.custom_fields ? 'C3 Registro das interações no CRM'
      OR l.custom_fields ? 'C4 Cumprimento do SLA (48h)'
      OR l.custom_fields ? 'C4 Intensidade adequada de contato'
      OR l.custom_fields ? 'C4 Mudança de abordagem (novo ângulo)'
      OR l.custom_fields ? 'C4 Persistência com equilíbrio (sem abandono ou excesso)'
      OR l.custom_fields ? 'C4 Critério na decisão de avanço ou queda'
      OR l.custom_fields ? 'C5 Cumprimento do SLA (24h)'
      OR l.custom_fields ? 'C5 Execução de tentativa final objetiva'
      OR l.custom_fields ? 'C5 Clareza na abordagem de encerramento'
      OR l.custom_fields ? 'C5 Critério para envio ao resgate'
      OR l.custom_fields ? 'C5 Organização final do lead no CRM'
    )
)
SELECT
  b.lead_id, b.lead_name, b.pipeline_name, b.status_name,
  b.lead_created_at, b.lead_updated_at,
  b.data_fechamento_fmt, b.data_referencia,
  b.canal_entrada, b.vendedor, b.sdr,
  b.cf->>'C1 Tempo de primeira ação (agilidade no atendimento)' AS c1_tempo,
  b.cf->>'C1 Tentativa de ligação inicial' AS c1_ligacao,
  b.cf->>'C1 Registro correto no CRM (status/origem)' AS c1_registro,
  b.cf->>'C1 Clareza na primeira abordagem' AS c1_clareza,
  b.cf->>'C1 Definição de próxima ação (follow-up)' AS c1_proxima,
  b.cf->>'C2 Cumprimento do SLA (48h)' AS c2_sla,
  b.cf->>'C2 Cobertura de contato (acionou todos os leads)' AS c2_cobertura,
  b.cf->>'C2 Quantidade adequada de tentativas (1–2)' AS c2_tentativas,
  b.cf->>'C2 Uso equilibrado de canais (ligação + WhatsApp)' AS c2_canais,
  b.cf->>'C2 Identificação de sinais do lead' AS c2_sinais,
  b.cf->>'C3 Cumprimento do SLA (72h)' AS c3_sla,
  b.cf->>'C3 Personalização da abordagem (quente vs frio)' AS c3_personalizacao,
  b.cf->>'C3 Cadência bem distribuída' AS c3_cadencia,
  b.cf->>'C3 Tentativa de evolução da conversa' AS c3_evolucao,
  b.cf->>'C3 Registro das interações no CRM' AS c3_registro,
  b.cf->>'C4 Cumprimento do SLA (48h)' AS c4_sla,
  b.cf->>'C4 Intensidade adequada de contato' AS c4_intensidade,
  b.cf->>'C4 Mudança de abordagem (novo ângulo)' AS c4_mudanca,
  b.cf->>'C4 Persistência com equilíbrio (sem abandono ou excesso)' AS c4_persistencia,
  b.cf->>'C4 Critério na decisão de avanço ou queda' AS c4_criterio,
  b.cf->>'C5 Cumprimento do SLA (24h)' AS c5_sla,
  b.cf->>'C5 Execução de tentativa final objetiva' AS c5_execucao,
  b.cf->>'C5 Clareza na abordagem de encerramento' AS c5_clareza,
  b.cf->>'C5 Critério para envio ao resgate' AS c5_resgate,
  b.cf->>'C5 Organização final do lead no CRM' AS c5_organizacao,
  gold.qualidade_nota_etapa(
    b.cf->>'C1 Tempo de primeira ação (agilidade no atendimento)', 30,
    b.cf->>'C1 Tentativa de ligação inicial', 25,
    b.cf->>'C1 Registro correto no CRM (status/origem)', 20,
    b.cf->>'C1 Clareza na primeira abordagem', 15,
    b.cf->>'C1 Definição de próxima ação (follow-up)', 10
  ) AS nota_c1,
  gold.qualidade_nota_etapa(
    b.cf->>'C2 Cumprimento do SLA (48h)', 30,
    b.cf->>'C2 Cobertura de contato (acionou todos os leads)', 25,
    b.cf->>'C2 Quantidade adequada de tentativas (1–2)', 15,
    b.cf->>'C2 Uso equilibrado de canais (ligação + WhatsApp)', 15,
    b.cf->>'C2 Identificação de sinais do lead', 15
  ) AS nota_c2,
  gold.qualidade_nota_etapa(
    b.cf->>'C3 Cumprimento do SLA (72h)', 25,
    b.cf->>'C3 Personalização da abordagem (quente vs frio)', 25,
    b.cf->>'C3 Cadência bem distribuída', 20,
    b.cf->>'C3 Tentativa de evolução da conversa', 15,
    b.cf->>'C3 Registro das interações no CRM', 15
  ) AS nota_c3,
  gold.qualidade_nota_etapa(
    b.cf->>'C4 Cumprimento do SLA (48h)', 25,
    b.cf->>'C4 Intensidade adequada de contato', 25,
    b.cf->>'C4 Mudança de abordagem (novo ângulo)', 20,
    b.cf->>'C4 Persistência com equilíbrio (sem abandono ou excesso)', 15,
    b.cf->>'C4 Critério na decisão de avanço ou queda', 15
  ) AS nota_c4,
  gold.qualidade_nota_etapa(
    b.cf->>'C5 Cumprimento do SLA (24h)', 25,
    b.cf->>'C5 Execução de tentativa final objetiva', 25,
    b.cf->>'C5 Clareza na abordagem de encerramento', 20,
    b.cf->>'C5 Critério para envio ao resgate', 15,
    b.cf->>'C5 Organização final do lead no CRM', 15
  ) AS nota_c5,
  -- Campos qualitativos (mesmos da aba Qualitativo da Qualidade de Fechamento)
  b.cf->>'Score de Qualidade' AS score_qualidade,
  b.cf->>'Observações gerais do atendimento' AS observacoes_gerais,
  b.cf->>'Ponto Critico' AS ponto_critico
FROM base b;

GRANT SELECT ON gold.qualidade_sdr TO anon, authenticated;
GRANT ALL    ON gold.qualidade_sdr TO service_role;
