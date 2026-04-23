-- Bulk overrides baseados no XLSX "leads fechados em 2026.xlsx" (validado pela Julia).
-- Corrige 10 divergências onde a regra automática do cubo escolheu o vendedor errado.
--
-- Causa: campo Vendedor/Consultor no Kommo foi alterado por automação/manual do CS
-- em alguns leads, e o moved_by do último Closed-won (usado pela regra v4) não
-- coincidiu com o vendedor real em casos de plantão/almoço. O XLSX exportado antes
-- dessas alterações reflete o vendedor correto.
--
-- Daqui pra frente (com o monitoramento diário da API de leads + CS/automação
-- desligada), novos leads não devem precisar de override.

INSERT INTO config.lead_vendedor_override (lead_id, vendedor, motivo, criado_por) VALUES
  (16499989, 'Daiana Léia',       'Bulk override 2026: XLSX leads fechados em 2026.xlsx', 'ia@uraniaplanetario.com.br'),
  (18341895, 'Matheus Flores',    'Bulk override 2026: CF alterado pela automação antiga de CS; XLSX confirma Matheus', 'ia@uraniaplanetario.com.br'),
  (20965345, 'Karen Medeiros',    'Bulk override 2026: XLSX confirma Karen (regra v4 sobrecorrigiu)', 'ia@uraniaplanetario.com.br'),
  (23267544, 'Perla Nogueira',    'Bulk override 2026: XLSX confirma Perla', 'ia@uraniaplanetario.com.br'),
  (22276009, 'Karen Medeiros',    'Bulk override 2026: XLSX confirma Karen (regra v4 sobrecorrigiu)', 'ia@uraniaplanetario.com.br'),
  (23479744, 'Emilly Fernandes',  'Bulk override 2026: XLSX confirma Emilly (regra v4 sobrecorrigiu)', 'ia@uraniaplanetario.com.br'),
  (23679423, 'Daiana Léia',       'Bulk override 2026: XLSX confirma Daiana', 'ia@uraniaplanetario.com.br'),
  (23722281, 'Karen Medeiros',    'Bulk override 2026: XLSX confirma Karen (regra v4 sobrecorrigiu)', 'ia@uraniaplanetario.com.br'),
  (22395689, 'Emilly Fernandes',  'Bulk override 2026: XLSX confirma Emilly (CF atual é Catarine)', 'ia@uraniaplanetario.com.br'),
  (23312216, 'Karen Medeiros',    'Bulk override 2026: XLSX confirma Karen', 'ia@uraniaplanetario.com.br')
ON CONFLICT (lead_id) DO UPDATE SET
  vendedor = EXCLUDED.vendedor,
  motivo = EXCLUDED.motivo,
  criado_por = EXCLUDED.criado_por;
