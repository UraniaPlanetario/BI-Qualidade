export interface SDR {
  id: number;
  nome: string;
  nivel: 'Junior 01' | 'Junior 02' | 'Pleno 01' | 'Pleno 02';
  vigencia_inicio: string;
  vigencia_fim: string | null;
  ativo: boolean;
}

export interface MetaSDR {
  nivel: string;
  meta_tempo_resposta: number;
  meta_msg_diaria: number;
  meta_campos_diarios: number;
  meta_conversao: number;
  comissao_variavel_base: number;
}

export interface MultiplicadorComissao {
  mpa_min: number;
  mpa_max: number;
  multiplicador: number;
}

export interface MensagemSDR {
  responder_user_id: number;
  responder_user_name: string | null;
  received_at: string;
  responded_at: string;
  response_minutes: number;
  faixa: string;
  lead_id: number | null;
}

export interface AlteracaoSDR {
  lead_id: number | null;
  criado_por_id: number | null;
  criado_por: string | null;
  data_criacao: string;
  dentro_janela: boolean;
}

export interface MovimentoLead {
  lead_id: number;
  pipeline_from: string | null;
  pipeline_to: string | null;
  status_to: string | null;
  status_to_id: number | null;
  moved_by: string | null;
  moved_by_id: number | null;
  moved_at: string;
  lead_created_at?: string | null;
}

/**
 * Status IDs do pipeline "Vendas WhatsApp" que representam qualificação pelo SDR.
 * Usamos IDs (não nomes) para ficar imune a rename de etapa no Kommo.
 *
 * - 100952455: "Qualificado SDR" (pode virar "Lead Pré-Qualificado (SDR)" num rename futuro)
 *
 * Se o time criar uma NOVA etapa separada em vez de renomear, adicione o novo ID aqui.
 */
export const QUALIFICADO_SDR_STATUS_IDS = new Set<number>([100952455]);

export function isQualificadoSDRById(statusId: number | null | undefined): boolean {
  if (statusId == null) return false;
  return QUALIFICADO_SDR_STATUS_IDS.has(statusId);
}

export interface SDRFilters {
  sdrs: string[];
  dateRange: { from: Date | null; to: Date | null };
}

export const FAIXAS_TEMPO = ['< 5 min', '< 10 min', '< 15 min', '< 30 min', '> 30 min'];
export const PESOS_FAIXA: Record<string, number> = {
  '< 5 min': 1.0,
  '< 10 min': 0.25,
  '< 15 min': -0.5,
  '< 30 min': -1.25,
  '> 30 min': -2.0,
};

export function calcNotaTempo(faixaCounts: Record<string, number>): number {
  const total = Object.values(faixaCounts).reduce((s, v) => s + v, 0);
  if (total === 0) return 0;
  let score = 0;
  for (const [faixa, count] of Object.entries(faixaCounts)) {
    const pct = count / total;
    score += pct * (PESOS_FAIXA[faixa] || 0);
  }
  return Math.max(0, Math.min(1, Math.pow((score + 2) / 3, 2)));
}

export function formatNumber(v: number): string {
  return v.toLocaleString('pt-BR');
}

export function formatPct(v: number, decimals = 1): string {
  return v.toFixed(decimals).replace('.', ',') + '%';
}

export function formatCurrency(v: number): string {
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Calcula multiplicador de comissão dado um MPA (0-100)
export function calcMultiplicador(mpa: number, multipliers: MultiplicadorComissao[]): number {
  // Acima de 100%: usa MPA/100
  if (mpa > 100) return mpa / 100;
  // Encontra a faixa
  const m = multipliers.find((x) => mpa >= x.mpa_min && mpa <= x.mpa_max);
  return m?.multiplicador ?? 0;
}

// Calcula MPA: 0.35×tempo + 0.20×msg + 0.20×campos + 0.25×conversão (em %)
export function calcMPA(
  exec_tempo: number,
  meta_tempo: number,
  exec_msg: number,
  meta_msg: number,
  exec_campos: number,
  meta_campos: number,
  exec_conv: number,
  meta_conv: number,
): number {
  const ratio_tempo = meta_tempo > 0 ? exec_tempo / meta_tempo : 0;
  const ratio_msg = meta_msg > 0 ? exec_msg / meta_msg : 0;
  const ratio_campos = meta_campos > 0 ? exec_campos / meta_campos : 0;
  const ratio_conv = meta_conv > 0 ? exec_conv / meta_conv : 0;
  const mpa = 0.35 * ratio_tempo + 0.20 * ratio_msg + 0.20 * ratio_campos + 0.25 * ratio_conv;
  return mpa * 100; // retorna em percentual
}
