# Dashboard — Calendário Astrônomos

**Rota:** `/onboarding/calendario-astronomos`
**Área:** Onboarding
**Pasta:** [`src/areas/onboarding/calendario-astronomos/`](../../src/areas/onboarding/calendario-astronomos/)
**Doc relacionado:** [data-model.md#gold-agendamentos-astronomos](../data-model.md#gold-agendamentos-astronomos)

## Objetivo

Painel operacional do time de astrônomos: visualizar agenda de visitas (PRÉ, VISITA, RESERVA, Ñ MARCAR), distribuição geográfica das escolas, status de tarefas (abertas / atrasadas / concluídas) e auditar divergências entre o que está na tarefa Kommo e os custom fields do lead vinculado.

## Fonte

- **Tabela única:** [`gold.agendamentos_astronomos`](../data-model.md#gold-agendamentos-astronomos) — uma linha por tarefa do funil "Astrônomos", já enriquecida com `astronomo` + `tipo_tarefa` (de `bronze.kommo_task_types`) e os ~20 custom fields do lead (escola, valor da venda, data agendada, coordenada lat/long, etc).
- **Refresh:** `gold.refresh_agendamentos_astronomos()` — repopula a tabela a partir de `bronze.kommo_tasks` filtrando `responsible_user_name='Astrônomos'`.

## Estrutura de arquivos

```
src/areas/onboarding/calendario-astronomos/
├── pages/Dashboard.tsx              # orquestração + filtros + tabs
├── hooks/useAgendamentos.ts         # useAgendamentos, useAstronomos, calcStats
├── types.ts                         # interfaces, helpers, regras de auditoria
└── components/
    ├── KPIs.tsx                     # 4 cards principais + 4 cards por tipo
    ├── FilterBar.tsx                # filtros (busca, datas, tipos, status, astrônomos, flags)
    ├── CalendarioAgendamentos.tsx   # react-big-calendar mês/semana/dia/agenda
    ├── MapaAgendamentos.tsx         # react-leaflet com markers por astrônomo
    ├── ListaAgendamentos.tsx        # lista clicável (usada nas 3 tabs)
    ├── AgendamentoModal.tsx         # detalhes completos da tarefa+lead
    ├── AgendaTab.tsx                # calendário + mapa + lista
    ├── ConcluidasTab.tsx            # visitas concluídas + valor + por astrônomo
    └── AuditoriaTab.tsx             # 3 grupos de flags + listas
```

## KPIs (no topo)

| Card | Cálculo | Notas |
|---|---|---|
| Total | `filtrados.length` | Após aplicar filtros |
| Abertas | `status_tarefa = 'aberta'` | Tarefa pendente cujo `complete_till > now()` |
| Atrasadas | `status_tarefa = 'atrasada'` | `is_completed=false` e `complete_till < now()` |
| Concluídas | `status_tarefa = 'completa'` | `is_completed=true` (atualmente sempre 0 — ver "Pontos de atenção") |

E mais 4 cards por tipo de tarefa: VISITA / PRÉ / RESERVA / Ñ MARCAR.

## Filtros

- **Busca livre** — escola, cidade, UF, endereço (normalizado sem acento, case-insensitive)
- **Período** — `data_conclusao` (programada para a tarefa) entre `from` e `to`
- **Tipo de tarefa** — multi-seleção (PRÉ / VISITA / RESERVA / Ñ MARCAR)
- **Status** — multi-seleção (Aberta / Atrasada / Concluída) — oculto na tab Concluídas
- **Astrônomo** — multi-seleção (chip colorido por astrônomo, mesma cor usada no calendário e mapa)
- **Flags de auditoria** (só na aba Auditoria): aplica filtro só nos itens com a flag

## Tabs

### 1. Agenda

- **Calendário** (lib `react-big-calendar`, locale pt-BR): cada evento usa o `data_conclusao` da tarefa como horário; cor de fundo = cor do astrônomo. Click no evento abre modal.
- **Mapa** (lib `react-leaflet` + `leaflet`): markers circulares com cor do astrônomo nas coordenadas `(latitude, longitude)` do lead. Faz `fitBounds` automático nos pontos visíveis. Cantinho mostra contagem com/sem coordenada.
- **Lista** abaixo: lista de todos os agendamentos filtrados.

### 2. Concluídas

- 3 KPIs: total concluídas, valor total atendido, astrônomos ativos
- Bar chart: concluídas por astrônomo
- Lista: tarefas com `status_tarefa = 'completa'`

### 3. Auditoria

A aba **desconsidera tarefas concluídas por padrão** (auditoria só faz sentido em pendentes). 6 cards-resumo + 4 seções com listas:

- **Auditoria Nome** — `astronomo_card` (custom field "Astrônomo" do lead, ex: "Marlon") ≠ `astronomo` (derivado de `task_type_id`, ex: "Marlon"). Match permissivo (case-insensitive, sem acento, contém substring).
- **Auditoria Data** — `data_conclusao` (data programada da tarefa) ≠ `data_agendamento` (custom field do lead). Compara só dia BRT, ignorando hora.
- **Auditoria Tarefa** — Lead com `data_agendamento` preenchida mas `desc_tarefa` não é VISITA nem PRÉ (provável erro de classificação).
- **Onboarding s/ VISITA** — leads ativos em "Onboarding Escolas" / "Onboarding SME" sem tarefa VISITA aberta. Vem da view [`gold.leads_onboarding_sem_visita`](../data-model.md#gold-leads-onboarding-sem-visita-view) e separa em 3 grupos: críticos (com agendamento futuro), VISITA já completa (administrativo), e leads vazios (movidos por engano). Conta no card-resumo só os críticos.
- **Sem coordenada** (apenas card-resumo) — leads sem `latitude/longitude` não aparecem no mapa.
- **Sem lead vinculado** (apenas card-resumo) — tarefas órfãs.

Cada lista mostra chip âmbar nas próprias linhas indicando quais flags acendem para aquele item.

## Hooks

| Hook | Retorno | Cache |
|---|---|---|
| `useAgendamentos()` | `Agendamento[]` (paginado de 1000 em 1000) | 5 min |
| `useAstronomos()` | `string[]` distinto da `bronze.kommo_task_types` | 60 min |
| `calcStats(items)` | `AgendamentoStats` (KPIs derivados) | — (puro) |

## Helpers (em `types.ts`)

- `colorForAstronomo(nome)` — paleta fixa de 19 cores, uma por astrônomo
- `nomesBatem(esperado, observado)` — normaliza e checa contém (`includes` em ambos os sentidos)
- `datasBatem(taskComplete, leadAgendamento)` — compara YYYY-MM-DD em America/Sao_Paulo
- `auditoriaTarefaSuspeita(a)` — true se tipo ≠ VISITA/PRÉ e `data_agendamento` preenchida
- `formatCurrency`, `formatDate`, `formatDateTime`, `statusLabel`, `statusColorClass`

## Pontos de atenção

- **Concluídas = 0**: o sync `sync-kommo-tasks` por padrão filtra `filter[is_completed]=0` (só tarefas abertas), então atualmente *nenhuma* tarefa concluída chega ao bronze. A aba "Concluídas" exibe um aviso explicando o motivo. Para popular histórico, rodar a function uma vez com `?onlyOpen=false`.
- **Mapeamento `task_type_id` → `astronomo`**: vive em `bronze.kommo_task_types` (seed manual via [migration 026](../../supabase/migrations/026_seed_kommo_task_types_astronomos.sql)). Quando entrar/sair astrônomo, atualizar a tabela manualmente e rodar `gold.refresh_agendamentos_astronomos()`.
- **Coordenadas**: ~50% dos leads têm coordenadas preenchidas no custom field `coordenada` (formato `"lat;lng"`). Os demais aparecem na lista mas não no mapa.
