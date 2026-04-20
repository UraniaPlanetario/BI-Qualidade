export interface LeadVendedor {
  id_lead: number;
  nome_lead: string | null;
  valor_total: number | null;
  vendedor: string | null;
  funil_atual: string | null;
  estagio_atual: string | null;
  data_de_fechamento: string | null;
  data_e_hora_do_agendamento: string | null;
  data_cancelamento: string | null;
  data_criacao: string | null;
  numero_de_diarias: string | null;
  tipo_lead: string | null;
  status_lead: string | null;
  cancelado: boolean;
}

export interface MensagemTempo {
  responder_user_id: number;
  responder_user_name: string | null;
  received_at: string;
  responded_at: string;
  response_minutes: number;
  faixa: string;
  recebida_dentro_janela: boolean;
}

export interface AlteracaoCampo {
  lead_id: number | null;
  criado_por_id: number | null;
  criado_por: string | null;
  data_criacao: string;
  dentro_janela: boolean;
}

export interface VendedorFilters {
  vendedores: string[];
  dateRange: { from: Date | null; to: Date | null };
}

const NAME_MAP: Record<string, string> = {
  'Cintia': 'Cintia Santos',
  'Aurélio De Franco': 'Aurélio',
  'Daiana Léia': 'Daiana Leia',
  'Isis Rodrigues': 'Isis',
  'Matheus Amaral': 'Matheus',
  'Priscila Rocha': 'Priscila',
  'Vanessa Anhalt': 'Vanessa',
  'Wilson Lopes': 'Wilson',
  'Patricia Guidini': 'Patrícia Guidini',
};

export function normalizeUserName(name: string | null): string {
  if (!name) return 'Não atribuído';
  return NAME_MAP[name] || name;
}

export function formatCurrency(v: number): string {
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatNumber(v: number): string {
  return v.toLocaleString('pt-BR');
}

export function formatPct(v: number, decimals = 1): string {
  return v.toFixed(decimals).replace('.', ',') + '%';
}

export const FAIXAS_TEMPO = ['< 5 min', '< 10 min', '< 15 min', '< 30 min', '> 30 min'];
export const PESOS_FAIXA: Record<string, number> = {
  '< 5 min': 1.0,
  '< 10 min': 0.25,
  '< 15 min': -0.5,
  '< 30 min': -1.25,
  '> 30 min': -2.0,
};

// Calcula nota de tempo de resposta: ((score + 2) / 3)^2
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
