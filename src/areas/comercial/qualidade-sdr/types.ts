/** Cadência de SDR — qualidade da atuação avaliada por etapa via custom fields do Kommo. */

export type Etapa = 'C1' | 'C2' | 'C3' | 'C4' | 'C5';
export const ETAPAS: Etapa[] = ['C1', 'C2', 'C3', 'C4', 'C5'];

/** Peso de cada etapa na nota geral (soma 100%). */
export const PESO_ETAPA: Record<Etapa, number> = {
  C1: 0.20, C2: 0.20, C3: 0.15, C4: 0.20, C5: 0.25,
};

export const COR_ETAPA: Record<Etapa, string> = {
  C1: '#3b82f6', C2: '#8b5cf6', C3: '#ec4899', C4: '#f59e0b', C5: '#10b981',
};

export type ValorCriterio = 'Bom' | 'Parcial' | 'Não' | 'Não se aplica' | null;

/** Linha bruta da view gold.qualidade_sdr (1 lead). */
export interface QualidadeSDRRow {
  lead_id: number;
  lead_name: string | null;
  pipeline_name: string | null;
  status_name: string | null;
  lead_created_at: string | null;
  lead_updated_at: string | null;
  data_fechamento_fmt: string | null;
  /** Data usada pelo filtro de período: data_fechamento_fmt se fechado, senão
   *  updated_at do lead (preenchimento do C1-C5 atualiza updated_at). */
  data_referencia: string | null;
  canal_entrada: string | null;
  vendedor: string | null;
  sdr: string | null;

  c1_tempo: ValorCriterio;       c1_ligacao: ValorCriterio;     c1_registro: ValorCriterio;
  c1_clareza: ValorCriterio;     c1_proxima: ValorCriterio;
  c2_sla: ValorCriterio;         c2_cobertura: ValorCriterio;   c2_tentativas: ValorCriterio;
  c2_canais: ValorCriterio;      c2_sinais: ValorCriterio;
  c3_sla: ValorCriterio;         c3_personalizacao: ValorCriterio; c3_cadencia: ValorCriterio;
  c3_evolucao: ValorCriterio;    c3_registro: ValorCriterio;
  c4_sla: ValorCriterio;         c4_intensidade: ValorCriterio;  c4_mudanca: ValorCriterio;
  c4_persistencia: ValorCriterio; c4_criterio: ValorCriterio;
  c5_sla: ValorCriterio;         c5_execucao: ValorCriterio;     c5_clareza: ValorCriterio;
  c5_resgate: ValorCriterio;     c5_organizacao: ValorCriterio;

  nota_c1: number | null;
  nota_c2: number | null;
  nota_c3: number | null;
  nota_c4: number | null;
  nota_c5: number | null;

  /** Avaliação qualitativa preenchida pela líder de qualidade (mesma fonte
   *  da aba Qualitativo da Qualidade de Fechamento). */
  score_qualidade: string | null;
  observacoes_gerais: string | null;
  ponto_critico: string | null;
}

/** Cores por faixa de score (espelha o mapping da Qualidade de Fechamento). */
export const SCORE_COLORS: Record<string, string> = {
  '90–100 → Excelente': 'hsl(142, 71%, 30%)',
  '75–89 → Bom':        'hsl(142, 60%, 50%)',
  '60–74 → Regular':    'hsl(45, 93%, 47%)',
  '<60 → Crítico':      'hsl(0, 72%, 51%)',
};

/** Crítérios de cada etapa (chave da row, label, peso). Usado na visualização de distribuição. */
export const CRITERIOS: Record<Etapa, { key: keyof QualidadeSDRRow; label: string; peso: number }[]> = {
  C1: [
    { key: 'c1_tempo',    label: 'Tempo de primeira ação',           peso: 30 },
    { key: 'c1_ligacao',  label: 'Tentativa de ligação inicial',     peso: 25 },
    { key: 'c1_registro', label: 'Registro correto no CRM',          peso: 20 },
    { key: 'c1_clareza',  label: 'Clareza na primeira abordagem',    peso: 15 },
    { key: 'c1_proxima',  label: 'Definição de próxima ação',        peso: 10 },
  ],
  C2: [
    { key: 'c2_sla',        label: 'Cumprimento do SLA (48h)',           peso: 30 },
    { key: 'c2_cobertura',  label: 'Cobertura de contato',                peso: 25 },
    { key: 'c2_tentativas', label: 'Quantidade adequada de tentativas',   peso: 15 },
    { key: 'c2_canais',     label: 'Uso equilibrado de canais',           peso: 15 },
    { key: 'c2_sinais',     label: 'Identificação de sinais do lead',     peso: 15 },
  ],
  C3: [
    { key: 'c3_sla',             label: 'Cumprimento do SLA (72h)',         peso: 25 },
    { key: 'c3_personalizacao',  label: 'Personalização da abordagem',     peso: 25 },
    { key: 'c3_cadencia',        label: 'Cadência bem distribuída',        peso: 20 },
    { key: 'c3_evolucao',        label: 'Tentativa de evolução da conversa', peso: 15 },
    { key: 'c3_registro',        label: 'Registro das interações no CRM',  peso: 15 },
  ],
  C4: [
    { key: 'c4_sla',          label: 'Cumprimento do SLA (48h)',     peso: 25 },
    { key: 'c4_intensidade',  label: 'Intensidade adequada de contato', peso: 25 },
    { key: 'c4_mudanca',      label: 'Mudança de abordagem',         peso: 20 },
    { key: 'c4_persistencia', label: 'Persistência com equilíbrio',  peso: 15 },
    { key: 'c4_criterio',     label: 'Critério na decisão',          peso: 15 },
  ],
  C5: [
    { key: 'c5_sla',         label: 'Cumprimento do SLA (24h)',           peso: 25 },
    { key: 'c5_execucao',    label: 'Execução de tentativa final',         peso: 25 },
    { key: 'c5_clareza',     label: 'Clareza na abordagem de encerramento', peso: 20 },
    { key: 'c5_resgate',     label: 'Critério para envio ao resgate',     peso: 15 },
    { key: 'c5_organizacao', label: 'Organização final do lead no CRM',   peso: 15 },
  ],
};

/** Calcula nota geral ponderada de um SDR (com fallback se etapa for NULL). */
export function notaGeralRow(r: Pick<QualidadeSDRRow, 'nota_c1' | 'nota_c2' | 'nota_c3' | 'nota_c4' | 'nota_c5'>): number | null {
  const notas: { etapa: Etapa; valor: number }[] = [];
  for (const e of ETAPAS) {
    const v = r[`nota_${e.toLowerCase()}` as keyof typeof r] as number | null;
    if (v != null) notas.push({ etapa: e, valor: v });
  }
  if (notas.length === 0) return null;
  // Normaliza pesos quando alguma etapa está NULL
  const pesoTotal = notas.reduce((s, n) => s + PESO_ETAPA[n.etapa], 0);
  const soma = notas.reduce((s, n) => s + n.valor * PESO_ETAPA[n.etapa], 0);
  return Math.round((soma / pesoTotal) * 10) / 10;
}

/** Filtros aplicados localmente no dashboard. */
export interface QualidadeSDRFilters {
  sdrs: string[];
  dateRange: { from: Date | null; to: Date | null };
}

export const FILTROS_DEFAULT: QualidadeSDRFilters = {
  sdrs: [],
  dateRange: { from: null, to: null },
};

export function notaToColor(nota: number | null): string {
  if (nota == null) return '#6b7280';
  if (nota >= 85) return '#10b981';   // verde
  if (nota >= 70) return '#84cc16';   // verde claro
  if (nota >= 50) return '#f59e0b';   // âmbar
  return '#ef4444';                    // vermelho
}
