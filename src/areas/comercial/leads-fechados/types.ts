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
  data_fechamento_fmt: string | null;
  data_agendamento_fmt: string | null;
  data_cancelamento_fmt: string | null;
  n_diarias: string | null;
  faixa_alunos: string | null;
  n_alunos: string | null;
  canal_entrada: string | null;
  origem_oportunidade: string | null;
  experiencia: string | null;
  conteudo_apresentacao: string | null;
  horizonte_agendamento: string | null;
  astronomo: string | null;
  turnos_evento: string | null;
  brinde: string | null;
  pipeline_origem: string | null;
  pipeline_onboarding: string | null;
  entrada_onboarding_at: string;
  lead_created_at: string | null;
  occurrence: number;
  cancelado: boolean;
  cancelado_at: string | null;
  custom_fields: Record<string, any> | null;
}

export type CaminhoOrigem = 'Direto' | 'Recorrente' | 'Reativada' | 'Resgate';

export interface LeadClosedOrigem extends LeadClosed {
  caminho_origem: CaminhoOrigem;
  entrada_caminho_at: string | null;
  tempo_dias_caminho: number | null;
  tempo_dias_total: number | null;
}

export const CAMINHO_COLORS: Record<CaminhoOrigem, string> = {
  Direto:     '#3b82f6',
  Reativada:  '#f59e0b',
  Resgate:    '#ec4899',
  Recorrente: '#10b981',
};

export const CAMINHO_DESCRIPTIONS: Record<CaminhoOrigem, string> = {
  Direto:     'Lead chegou e fechou sem desvios — fluxo padrão. Tempo medido da criação ao fechamento.',
  Recorrente: 'Cliente que já era da base (passou por Clientes - CS) e fechou novamente. Tempo medido desde a saída do onboarding anterior (entrada em Clientes - CS) até o novo fechamento.',
  Reativada:  'Lead que passou pela etapa "Oportunidade Reativada" / "Reativação CRM" no caminho até fechar. Tempo medido da criação ao fechamento.',
  Resgate:    'Lead que passou pelo pipeline "Resgate/Nutrição Whats" antes de fechar. Tempo medido da criação ao fechamento.',
};

/** Normaliza o canal de entrada (alguns leads salvam JSON array como string). */
export function normalizeCanal(raw: string | null | undefined): string {
  if (!raw) return '(sem canal)';
  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed);
      if (Array.isArray(arr) && arr.length > 0) return String(arr[0]);
    } catch { /* ignore */ }
  }
  return trimmed;
}

export interface ClosedFilters {
  vendedores: string[];
  astronomos: string[];
  cancelado: 'all' | 'sim' | 'nao';
  dateRange: { from: Date | null; to: Date | null };
}

export function formatDateBR(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}

export function formatDateTimeBR(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
