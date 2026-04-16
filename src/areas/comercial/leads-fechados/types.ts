export interface LeadClosed {
  id: number;
  lead_id: number;
  lead_name: string | null;
  lead_price: number | null;
  vendedor: string | null;
  sdr: string | null;
  cidade_estado: string | null;
  tipo_cliente: string | null;
  produtos: string | null;
  data_fechamento: string | null;
  data_agendamento: string | null;
  n_diarias: string | null;
  faixa_alunos: string | null;
  n_alunos: string | null;
  pipeline_origem: string | null;
  pipeline_onboarding: string | null;
  entrada_onboarding_at: string;
  lead_created_at: string | null;
  occurrence: number;
  cancelado: boolean;
  cancelado_at: string | null;
  custom_fields: Record<string, any> | null;
}

export interface ClosedFilters {
  vendedores: string[];
  cancelado: 'all' | 'sim' | 'nao';
  dateRange: { from: Date | null; to: Date | null };
}

export function parseTimestamp(ts: string | null): Date | null {
  if (!ts) return null;
  const num = Number(ts);
  if (!isNaN(num) && num > 1000000000) return new Date(num * 1000);
  return new Date(ts);
}

export function formatDateBR(ts: string | null): string {
  const d = parseTimestamp(ts);
  if (!d || isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}
