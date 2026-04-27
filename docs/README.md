# BI Urânia — Documentação Técnica

Este diretório contém a documentação completa do BI interno da Urânia Planetário (repositório `urania-analytics`, ainda acessível via `BI-Qualidade`). Integra dados do Kommo CRM em uma arquitetura medallion (bronze → gold + config) no Supabase, consumidos por sete dashboards React.

## Índice

### Fundamentos

- **[data-model.md](data-model.md)** — Arquitetura de dados completa: schemas `bronze`, `gold`, `config`, RPCs, índices, funções de refresh, cron jobs, edge functions de sync. Inclui diagramas de fluxo e SQL completo das transformações.
- **[business-rules.md](business-rules.md)** — Conceitos de domínio e fórmulas: MPA, multiplicadores de comissão, nota de tempo de resposta, janela de horário comercial (`business_minutes`), definições de "lead aberto", campos automatizados excluídos, deduplicação de passagens, etc.

### Dashboards

Um arquivo por dashboard — estrutura de arquivos, hooks, componentes, e cada visual descrito com: tipo, dado exibido, fonte, filtros, fórmula.

- **[dashboards/qualidade.md](dashboards/qualidade.md)** — Qualidade de Atendimento (scores de 24 critérios por vendedor)
- **[dashboards/leads-fechados.md](dashboards/leads-fechados.md)** — Leads Fechados (gold.leads_closed, segmentado por vendedor/astrônomo)
- **[dashboards/campanhas-semanais.md](dashboards/campanhas-semanais.md)** — Cinco rankings de campanha (ticket médio, leads, diárias, faturamento, Astronerd)
- **[dashboards/faturamento.md](dashboards/faturamento.md)** — Progresso anual com metas 70/80/90/100% + tema espacial
- **[dashboards/desempenho-sdr.md](dashboards/desempenho-sdr.md)** — MPA, comissão, 5 blocos (tempo, msg, campos, qualificação)
- **[dashboards/desempenho-vendedor.md](dashboards/desempenho-vendedor.md)** — Tempo de resposta, campos, fechamentos, diárias, faturamento, cancelamentos
- **[dashboards/monitoramento-usuarios.md](dashboards/monitoramento-usuarios.md)** — Atividades no CRM + Consistência CRM + Ranking por Percentil
- **[dashboards/calendario-astronomos.md](dashboards/calendario-astronomos.md)** — Onboarding: agenda de visitas, mapa, e auditoria de divergências (3 abas)

## Como navegar

- **Está vendo um número estranho num dashboard?** Abra o `.md` do dashboard → localize o visual → confira a fórmula e os filtros aplicados. Se o filtro mencionar uma tabela ou RPC, pule para `data-model.md`.
- **Precisa entender uma regra de negócio?** `business-rules.md` tem o porquê + a fórmula + onde está implementada.
- **Quer adicionar/alterar uma tabela ou RPC?** `data-model.md` tem o fluxo completo bronze → gold, incluindo o SQL de cada refresh.
- **Vai mexer no schema?** Comece por `data-model.md` (pipeline de sync e refresh), depois identifique quais dashboards consomem aquela tabela nos docs de cada dashboard.

## Convenções

- **Código** é nomeado em inglês; **UI** em português.
- **Datas de negócio** são tratadas em `America/Sao_Paulo` quando a regra envolve horário comercial (`business_minutes()`, `dentro_janela`).
- **Arquivos referenciados** usam notação `path/file.ts:123` para linhas específicas.
- **Schemas** expostos via PostgREST: `public`, `gold`, `config`, `bronze` (configurado em `pgrst.db_schemas`).
