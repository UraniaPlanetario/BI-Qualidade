# BI Urânia — Business Intelligence Kommo CRM

## Visão geral

Plataforma de Business Intelligence que integra a API do Kommo CRM com uma arquitetura medallion em Supabase, expondo **8 dashboards** em React para gestão comercial, financeira, de onboarding e de qualidade da Urânia Planetário.

> **📚 Documentação completa em [`docs/`](docs/README.md)** — data model, business rules e um doc por dashboard (schema, hooks, SQL, fórmulas).

Repositório atual: `BI-Qualidade` (em processo de rename para `urania-analytics`, GitHub Org: `UraniaPlanetario`).

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + Vite + TypeScript + SWC |
| UI/Styling | Tailwind CSS + shadcn/ui (Radix UI) + Lucide Icons |
| Routing | React Router v6 |
| Data Fetching | TanStack React Query 5 + @supabase/supabase-js |
| Forms | React Hook Form + Zod |
| Gráficos | Recharts |
| Backend | Supabase (PostgreSQL + Edge Functions + RLS + Auth) |
| Deploy | Vercel (auto-deploy via GitHub) |

## Supabase

- **Projeto:** `wkunbifgxntzbufjkize` (nome interno `bi-analysis`, região `us-east-1`)
- **URL:** `https://wkunbifgxntzbufjkize.supabase.co`
- **Schemas expostos via PostgREST:** `public`, `gold`, `config`, `bronze`
- Cliente: [`src/lib/supabase.ts`](src/lib/supabase.ts)

### Arquitetura medallion

```
Kommo API → Edge Functions → bronze (raw) → refresh_*() RPCs → gold (curado)
                                                ↓
                                   config (metas editáveis)
```

Sync diário orquestrado por `pg_cron` disparando edge functions via `pg_net`. Ver [docs/data-model.md#cron-jobs](docs/data-model.md#cron-jobs) para horários.

## Dashboards entregues

| Rota | Nome | Status | Doc |
|---|---|---|---|
| `/comercial/qualidade` | Qualidade de Atendimento | ✅ produção | [qualidade.md](docs/dashboards/qualidade.md) |
| `/comercial/leads-fechados` | Leads Fechados | ✅ produção | [leads-fechados.md](docs/dashboards/leads-fechados.md) |
| `/comercial/campanhas` | Campanhas Semanais | ✅ produção | [campanhas-semanais.md](docs/dashboards/campanhas-semanais.md) |
| `/financeiro/faturamento` | Faturamento | ✅ produção | [faturamento.md](docs/dashboards/faturamento.md) |
| `/comercial/desempenho-sdr` | Desempenho SDR (MPA + Comissão) | ✅ produção | [desempenho-sdr.md](docs/dashboards/desempenho-sdr.md) |
| `/comercial/desempenho-vendedor` | Desempenho Vendedor | ✅ produção | [desempenho-vendedor.md](docs/dashboards/desempenho-vendedor.md) |
| `/comercial/monitoramento` | Monitoramento de Usuários | ✅ produção | [monitoramento-usuarios.md](docs/dashboards/monitoramento-usuarios.md) |
| `/onboarding/calendario-astronomos` | Calendário Astrônomos | ✅ produção | [calendario-astronomos.md](docs/dashboards/calendario-astronomos.md) |

Abas específicas de destaque dentro do Monitoramento: **Consistência CRM** (score ações/lead com classificação fixa) e **Ranking por Percentil** (P25/P50/P75 do time).

## Integrações

### Kommo CRM API
- **Subdomain:** `uraniaplanetario.kommo.com`
- **Account ID:** `30633731`
- **Auth:** long-lived token em `KOMMO_ACCESS_TOKEN` (secrets do Supabase)
- **Rate limit:** 7 req/s — respeitado com `await sleep(150ms)` entre páginas
- **Endpoints usados:** `/api/v4/events`, `/api/v4/leads`, `/api/v4/leads/pipelines`, `/api/v4/users`, `/api/v4/tasks`

### RBAC / Auth
- Supabase Auth com trigger `handle_new_user` criando entrada em `user_profiles`
- `ProtectedRoute` consulta perfis (`admin`, `gestor`, `comercial`, `financeiro`, `onboarding`, `tecnologia`) e libera cada rota conforme permissões
- Admins editam perfis em `/admin/usuarios`

## Projetos irmãos no ecossistema Urânia

| Projeto | Propósito | Supabase |
|---------|-----------|----------|
| **urania-hub** | Gestão interna (usuários, tickets, agentes IA, notificações) | `poxolucfvuutvcfpjznt` |
| **bi-urania-tracking-leads-meta** | BI tracking Meta Ads + CAPI | `mziylzfqhnxmxcvshtpv` |
| **BI-Qualidade** (este) | BI Kommo CRM — 7 dashboards | `wkunbifgxntzbufjkize` |
| **crm-urania-labs** | CRM IA-first substituindo Kommo (futuro) | a criar |

## Padrões obrigatórios

- RLS habilitado em **todas** as tabelas (event trigger `public.rls_auto_enable` garante)
- React Query: `staleTime: 5min`, `gcTime: 10min`
- shadcn/ui — **NUNCA** editar `src/components/ui/` manualmente
- Path alias `@/` → `./src/*`
- Código em **inglês**, UI em **português**
- Datas: `dd/mm/aaaa` com `toLocaleDateString('pt-BR')`
- `AlertDialog` shadcn (NUNCA `window.confirm()`)
- Imports Supabase sempre de [`@/lib/supabase`](src/lib/supabase.ts)
- Janela de horário comercial: seg-sex, 7h-19h BRT (`public.business_minutes()`)

## 📚 Documentação viva — obrigatório

**Toda mudança em regra de negócio, fórmula, filtro, coluna de tabela ou visual de dashboard exige atualização imediata da documentação em [`docs/`](docs/) no mesmo commit que aplica a mudança.** Não é opcional nem "depois".

- **Alterou campo derivado, RPC, view, refresh, whitelist, constante de fórmula?** → atualiza [`docs/data-model.md`](docs/data-model.md)
- **Alterou definição de "venda fechada", "leads no período", classificação, exclusões, thresholds, pesos?** → atualiza [`docs/business-rules.md`](docs/business-rules.md)
- **Alterou um visual, hook, filtro aplicado ou adicionou coluna numa tabela?** → atualiza o `.md` correspondente em [`docs/dashboards/`](docs/dashboards/)
- **Mudou arquitetura, stack, Supabase project ou padrões do ecossistema?** → atualiza este `CLAUDE.md`

Antes de commitar mudança em código que afete métricas/regras, verifique se o doc ainda reflete o comportamento. Se não, edite o doc no mesmo commit. Um dashboard cujo número diverge da doc é bug de documentação, não só de código.

## Estrutura do projeto

```
.
├── .claude/skills/              # 8 skills Claude Code instaladas
├── docs/                        # 📚 documentação técnica
│   ├── README.md
│   ├── data-model.md
│   ├── business-rules.md
│   └── dashboards/*.md
├── src/
│   ├── areas/                   # Dashboards organizados por área de negócio
│   │   ├── comercial/
│   │   │   ├── qualidade/
│   │   │   ├── leads-fechados/
│   │   │   ├── campanhas/
│   │   │   ├── desempenho-sdr/
│   │   │   ├── desempenho-vendedor/
│   │   │   └── monitoramento/
│   │   ├── financeiro/
│   │   └── onboarding/
│   │       └── calendario-astronomos/
│   ├── components/
│   │   ├── ui/                  # shadcn/ui (gerado — não editar)
│   │   └── layout/              # GlobalSidebar, AppShell, ProtectedRoute
│   ├── pages/                   # AppShell, AdminUsuarios
│   ├── hooks/                   # custom hooks compartilhados
│   ├── lib/
│   │   ├── supabase.ts
│   │   └── permissions.ts
│   └── main.tsx
├── supabase/
│   ├── functions/               # sync-kommo-events, sync-kommo-leads, sync-kommo-tasks, etc
│   └── migrations/
├── CLAUDE.md                    # este arquivo
└── package.json
```

## Convenções de desenvolvimento

### Componentização de dashboards

Cada área tem o padrão:
```
areas/<area>/<feature>/
├── pages/Dashboard.tsx          # página + filtros + tabs
├── hooks/use<Feature>.ts        # queries/RPCs
├── types.ts                     # interfaces, constantes, helpers de cálculo
└── components/
    ├── <Bloco1>.tsx             # cada aba/seção é um componente
    ├── <Bloco2>.tsx
    └── ...
```

Separação: **cálculos em `types.ts` e hooks**; **renderização em `components/`**.

### Fórmulas versionadas

Cálculos de domínio (MPA, notaTempo, classifyConsistencia, etc.) ficam em `types.ts` do dashboard correspondente e estão documentados em [docs/business-rules.md](docs/business-rules.md).

### Campos automatizados excluídos

6 `campo_id` em `gold.cubo_alteracao_campos_eventos` são atualizados por bots (não ações humanas): `851177, 850685, 850687, 853875, 849769, 586018`. Todos os hooks de SDR/Vendedor os excluem via `.not('campo_id','in','(...)')`. A RPC `gold.campos_alterados_filtrados_por_user()` faz o mesmo.

### Cron + Edge Functions

Toda sync é orquestrada via `pg_cron` disparando edge function pelo endpoint REST (via `pg_net`). Para adicionar novo sync:
1. Criar edge function em `supabase/functions/<nome>/`
2. `supabase functions deploy <nome>`
3. `SELECT cron.schedule(...)` para agendar
4. Documentar em [docs/data-model.md](docs/data-model.md)

## Comandos úteis

```bash
# Dev server
npm run dev

# Build (produção)
npm run build

# Type check
npx tsc --noEmit

# Deploy edge function
supabase functions deploy <name>

# Query direta no Supabase
# → use o MCP claude_ai_Supabase ou SQL Editor no Dashboard
```

## Pontos de atenção

- **`gold.user_activities_daily`** NÃO filtra os 6 campos bot — use a RPC `campos_alterados_filtrados_por_user` quando precisar de número "limpo".
- **`leads_atribuidos_por_user`** leva ~8s para rodar; precisou de `SECURITY DEFINER` + `statement_timeout=60s` para passar pelo limite de 3s do role `anon`.
- **Ticket médio** é sempre `receita / total_diarias`, nunca `receita / leads`.
- **Faturamento** filtra por `data_e_hora_do_agendamento`, não `data_de_fechamento`.
- **`Shopping Fechados`** (`tipo_lead='Shoppings'`) é excluído das principais métricas de vendedor/faturamento.
- **"Leads no Período"** usa dupla contagem (se um lead passou por 2 vendedores, conta pra ambos) — decisão de negócio documentada em [business-rules.md](docs/business-rules.md#definição-de-leads-no-período-atribuição-temporal).

## Como navegar quando aparecer uma dúvida

1. **"O que essa métrica significa?"** → [docs/business-rules.md](docs/business-rules.md)
2. **"De onde vem esse dado?"** → [docs/data-model.md](docs/data-model.md)
3. **"Como esse visual é montado?"** → `docs/dashboards/<nome>.md`
4. **"Onde está o código X?"** → busque pelo nome do hook ou componente (sempre em `src/areas/<area>/<feature>/`)
