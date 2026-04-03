# Prompt para Lovable — BI Qualidade Urânia

## Contexto
Criar um dashboard de Business Intelligence para análise de qualidade de atendimento comercial. Os dados vêm de uma tabela `leads_quality` no Supabase.

## Conexão Supabase
- **Project URL:** https://wkunbifgxntzbufjkize.supabase.co
- **Tabela:** `leads_quality` (RLS habilitado, leitura pública)

## Design Visual
- **Tema:** Dark mode obrigatório, com tons de roxo/lilás como cor primária (estilo da marca Urânia)
- **Background:** Escuro (#0f0a1a ou similar), com cards em tons de #1a1230
- **Cores de destaque:** Roxo (#8b5cf6), lilás, dourado para destaques
- **Sidebar:** Fixa à esquerda com logo "Urânia" no topo e menu de navegação
- **Tipografia:** Clean, moderna, sem serifa
- **Cards:** Bordas arredondadas, fundo semi-transparente com leve gradiente
- **Gráficos:** Cores vibrantes sobre fundo escuro (roxo, verde, amarelo, vermelho para status)

## Autenticação
- Login com email/senha via Supabase Auth
- Tela de login com visual dark matching o dashboard

## Estrutura — Dashboard em página única com 6 blocos

### Barra de Filtros (topo, sticky)
Filtros que afetam todos os blocos:
- **Vendedor/Consultor** (`vendedor_consultor`) — select/multiselect
- **Data de criação do lead** (`created_at_kommo`) — date range picker
- **Data de fechamento** (`data_fechamento`) — date range picker
- **Score de Qualidade** (`score_qualidade`) — multiselect: "90–100 → Excelente", "75–89 → Bom", "60–74 → Regular", "<60 → Crítico"

### Bloco 1: Avaliação de Qualidade
KPIs/cards no topo:
- Score médio geral (calcular a partir de `score_qualidade`)
- Total de leads avaliados (count)
- % Abordagem "Boa" (de `qualidade_abordagem_inicial`)
- % Próximo passo definido "Sim"

Gráficos:
- **Distribuição do Score de Qualidade** — bar chart horizontal ordenado: Excelente → Bom → Regular → Crítico (cores: verde, azul, amarelo, vermelho)
- **Avaliação por critério** — cada campo com ≤3 opções usa pie/donut chart individual:
  - `qualidade_abordagem_inicial` — donut (Boa/Média/Ruim)
  - `personalizacao_atendimento` — donut (Sim/Parcial/Não)
  - `clareza_comunicacao` — donut (Sim/Não)
  - `conectou_solucao_necessidade` — donut (Sim/Parcial/Não)
  - `explicou_beneficios` — donut (Sim/Parcial/Não)
  - `personalizou_argumentacao` — donut (Sim/Parcial/Não)
  - `proximo_passo_definido` — donut (Sim/Não)
- **Desconto** — grupo de 3 donut charts:
  - `houve_desconto` — donut (Sim/Não)
  - `desconto_justificado` — donut (Sim/Não/Não se aplica)
  - `quebrou_preco_sem_necessidade` — donut (Sim/Não/Não se aplica)

### Bloco 2: Performance por Vendedor
- **Tabela/ranking de vendedores** com colunas:
  - Vendedor
  - Qtd leads avaliados
  - Score médio (mapear: Excelente=95, Bom=82, Regular=67, Crítico=40)
  - % Abordagem Boa
  - % Clareza Sim
  - % Desconto justificado
- **Bar chart:** Score médio por vendedor (horizontal, ordenado do melhor pro pior)
- **Scatter/bubble:** Volume de atendimentos vs Score médio por vendedor

### Bloco 3: Diagnóstico (Ofensores)
- **Ranking de falhas** — bar chart horizontal mostrando % de "Não" ou "Ruim" por critério, ordenado do mais grave pro menos
- **Heatmap/tabela:** Cruzamento vendedor × critério mostrando % de conformidade (verde=bom, vermelho=ruim)
- **Destaque:** Top 3 critérios que mais puxam o score pra baixo

### Bloco 4: Contexto
- **Quem atendeu primeiro** (`quem_atendeu_primeiro`) — bar chart horizontal ordenado por volume (IA, SDR, Consultor/Vendedor, CS, Onboarding). Tem 5 opções, NÃO usar donut.
- **Tempo da primeira resposta** (`tempo_primeira_resposta`) — bar chart ordenado na sequência natural: "1 > 5", "5 > 10", "10+", "20+", "30+"
- **Distribuição por dia da semana** (`dia_semana_criacao`) — bar chart na ordem fixa: Segunda, Terça, Quarta, Quinta, Sexta, Sábado, Domingo
- **Distribuição por faixa de horário** (`faixa_horario_criacao`) — bar chart na ordem cronológica das faixas (06:00-07:00 ... Pós 24:00)
- **Tipo de dia** (`tipo_de_dia`) — donut (Semana, Final de Semana, Feriado) — 3 opções, ok pra donut
- **Tipo de cliente** (`tipo_cliente`) — bar chart horizontal ordenado por volume (tem 5+ categorias, NÃO usar donut)
- **Retorno de etapa do funil** (`retorno_etapa_funil`) — donut (Sim/Não)
- **Retorno de resgate** (`retorno_resgate`) — donut (Sim/Não)

### Bloco 5: Comercial (Venda)
- **Dias até fechar** (`dias_ate_fechar`) — bar chart na ordem natural das faixas: "1 > 5", "5 > 10", "10+", "20+", "30+", "40+", "50+", "60+"
- **Pediu data** (`pediu_data`) — donut (Sim/Não) — 2 opções, ok pra donut
- **Ligações feitas** (`ligacoes_feitas`) — bar chart na ordem: Não, 01, 02, 03, 04, 05+
- **Produtos** (`produtos`) — bar chart horizontal ordenado por volume dos produtos mais vendidos
- **Timeline de fechamentos** — line chart por mês usando `data_fechamento`

### Bloco 6: Qualitativo (Leitura)
- **Tabela com busca** mostrando por lead:
  - Lead name
  - Vendedor
  - Score
  - Observações gerais (`observacoes_gerais`)
  - Ponto positivo (`ponto_positivo`)
  - Ponto crítico (`ponto_critico`)
  - Conhecia Urânia (`conhecia_urania`)
- Expansível (clica na linha pra ver os textos completos)
- Busca textual nos campos de observação

## Schema da tabela `leads_quality`

```sql
id BIGSERIAL PRIMARY KEY,
kommo_lead_id BIGINT NOT NULL UNIQUE,
lead_name TEXT,
lead_price NUMERIC,
pipeline_name TEXT,
status_name TEXT,
responsible_user TEXT,
created_at_kommo TIMESTAMPTZ,

-- Qualidade (26 campos)
dia_semana_criacao TEXT,
tipo_de_dia TEXT,
faixa_horario_criacao TEXT,
quem_atendeu_primeiro TEXT,
qualidade_abordagem_inicial TEXT,
personalizacao_atendimento TEXT,
clareza_comunicacao TEXT,
conectou_solucao_necessidade TEXT,
explicou_beneficios TEXT,
personalizou_argumentacao TEXT,
houve_desconto TEXT,
desconto_justificado TEXT,
quebrou_preco_sem_necessidade TEXT,
retorno_etapa_funil TEXT,
retorno_resgate TEXT,
tempo_primeira_resposta TEXT,
pediu_data TEXT,
data_sugerida TEXT,
dias_ate_fechar TEXT,
ligacoes_feitas TEXT,
conhecia_urania TEXT,
proximo_passo_definido TEXT,
observacoes_gerais TEXT,
ponto_critico TEXT,
ponto_positivo TEXT,
score_qualidade TEXT,

-- Contexto extra
vendedor_consultor TEXT,
sdr TEXT,
cidade_estado TEXT,
etapa_funil TEXT,
tipo_cliente TEXT,
data_fechamento TIMESTAMPTZ,
data_hora_agendamento TIMESTAMPTZ,
produtos TEXT,
closed_at_kommo TIMESTAMPTZ,

synced_at TIMESTAMPTZ,
updated_at TIMESTAMPTZ
```

## Valores possíveis dos campos

- `score_qualidade`: "90–100 → Excelente", "75–89 → Bom", "60–74 → Regular", "<60 → Crítico"
- `qualidade_abordagem_inicial`: "Boa", "Média", "Ruim"
- `personalizacao_atendimento`: "Sim", "Parcial", "Não"
- `clareza_comunicacao`: "Sim", "Não"
- `conectou_solucao_necessidade`: "Sim", "Parcial", "Não"
- `explicou_beneficios`: "Sim", "Parcial", "Não"
- `personalizou_argumentacao`: "Sim", "Parcial", "Não"
- `houve_desconto`: "Sim", "Não"
- `desconto_justificado`: "Sim", "Não", "Não se aplica"
- `quebrou_preco_sem_necessidade`: "Sim", "Não", "Não se aplica"
- `proximo_passo_definido`: "Sim", "Não"
- `pediu_data`: "Sim", "Não"
- `retorno_etapa_funil`: "Sim", "Não"
- `retorno_resgate`: "Sim", "Não"
- `quem_atendeu_primeiro`: "IA", "SDR", "Consultor/Vendedor", "CS", "Onboarding"
- `tempo_primeira_resposta`: "1 > 5", "5 > 10", "10+", "20+", "30+"
- `dias_ate_fechar`: "1 > 5", "5 > 10", "10+", "20+", "30+", "40+", "50+", "60+"
- `ligacoes_feitas`: "Não", "01", "02", "03", "04", "05+"
- `dia_semana_criacao`: "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"
- `tipo_de_dia`: "Semana", "Final de Semana", "Feriado"
- `tipo_cliente`: "Escola Particular", "Escola Pública", "Secretaria de educação", "Eventos", etc.

## Mapeamento de score numérico
Para calcular médias, usar: Excelente=95, Bom=82, Regular=67, Crítico=40

## Stack
- React + TypeScript
- Tailwind CSS + shadcn/ui
- Recharts para gráficos
- Supabase client para data fetching
- TanStack React Query (staleTime: 5min, gcTime: 10min)
- UI em português brasileiro
- Datas no formato dd/mm/aaaa

## Regra de visualização por tipo de chart

**IMPORTANTE — seguir esta regra rigorosamente:**
- **Pie/donut chart:** SOMENTE para campos com **3 opções ou menos** (Sim/Não, Sim/Parcial/Não, Boa/Média/Ruim, etc.)
- **Bar chart:** Para campos com **4+ opções** (score, dia da semana, faixa horário, tipo cliente, quem atendeu, tempo resposta, dias até fechar, ligações, produtos, etc.)
- **Campos com ordem natural** devem respeitar a sequência lógica (Segunda→Domingo, 06:00→24:00, 1>5→60+), NÃO ordenar por volume
- **Campos sem ordem natural** (vendedor, tipo cliente, produtos) ordenar por volume decrescente

## Notas
- Todos os gráficos devem reagir aos filtros da barra superior
- Mobile responsive
- Os textos qualitativos (observações, pontos) devem ser expandíveis, não truncados
