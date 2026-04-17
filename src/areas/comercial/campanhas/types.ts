export interface LeadCampanha {
  id_lead: number;
  nome_lead: string | null;
  valor_total: number | null;
  vendedor: string | null;
  data_de_fechamento: string | null;
  data_e_hora_do_agendamento: string | null;
  funil_atual: string | null;
  estagio_atual: string | null;
  numero_de_diarias: string | null;
  tipo_lead: string | null;
  produtos: string | null;
  conteudo_apresentacao: string | null;
}

export interface CampanhaFilters {
  dateRange: { from: Date | null; to: Date | null };
}

// Normalização de nomes
const NAME_MAP: Record<string, string> = {
  'Perla': 'Perla Nogueira',
  'Juliana': 'Juliana Rodrigues',
};

export function normalizeVendedor(name: string | null): string {
  if (!name) return 'Não atribuído';
  for (const [key, val] of Object.entries(NAME_MAP)) {
    if (name.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return name;
}

export function formatCurrency(value: number): string {
  return 'R$ ' + value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Emojis de pódio
export function podiumEmoji(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `${rank}º`;
}

// Funis válidos para campanhas
export const FUNIS_VALIDOS = ['Onboarding Escolas', 'Onboarding SME', 'Financeiro', 'Clientes - CS'];
