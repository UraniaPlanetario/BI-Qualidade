export interface MetaFaturamento {
  id: number;
  ano: number;
  mes: number;
  meta_70: number;
  meta_80: number;
  meta_90: number;
  meta_100: number;
}

export interface LeadFechado {
  id_lead: number;
  valor_total: number | null;
  data_de_fechamento: string | null;
  data_e_hora_do_agendamento: string | null;
  vendedor: string | null;
}

export const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function formatCurrency(value: number): string {
  return 'R$ ' + value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatCurrencyShort(value: number): string {
  if (value >= 1_000_000) return 'R$ ' + (value / 1_000_000).toFixed(2).replace('.', ',') + 'M';
  if (value >= 1_000) return 'R$ ' + (value / 1_000).toFixed(1).replace('.', ',') + 'K';
  return 'R$ ' + value.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}
