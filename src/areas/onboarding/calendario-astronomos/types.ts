export type StatusTarefa = 'completa' | 'atrasada' | 'aberta';

export type TipoTarefa = 'PRÉ' | 'VISITA' | 'RESERVA' | 'Ñ MARCAR';

export const TIPOS_TAREFA: TipoTarefa[] = ['PRÉ', 'VISITA', 'RESERVA', 'Ñ MARCAR'];

export interface Agendamento {
  task_id: number;
  lead_id: number | null;

  nome_tarefa: string | null;
  status_tarefa: StatusTarefa;
  data_criacao: string;
  data_conclusao: string | null;
  is_completed: boolean;

  task_type_id: number | null;
  tipo_tarefa: string | null;        // nome completo do tipo, ex "PROCÓPIO VISITA"
  desc_tarefa: TipoTarefa | null;    // 'VISITA' | 'PRÉ' | 'RESERVA' | 'Ñ MARCAR'
  astronomo: string | null;
  criado_por_id: number | null;

  nome_escola: string | null;
  valor_venda: number | null;
  produtos: string | null;
  numero_alunos: string | null;
  data_agendamento: string | null;
  local_instalacao: string | null;
  turno: string | null;
  conteudo_apresentacao: string | null;
  responsavel_evento: string | null;
  astronomo_card: string | null;       // custom field "Astrônomo" do lead
  numero_diarias: string | null;
  cupula: string | null;
  segmento: string | null;
  cidade: string | null;
  uf: string | null;
  cidade_estado: string | null;
  endereco: string | null;
  coordenada: string | null;
  latitude: number | null;
  longitude: number | null;
  telefone_responsavel: string | null;

  nota_nps: string | null;
  nps: string | null;
  avaliacao_geral: string | null;
  avaliacao_astronomo: string | null;
  brinde: string | null;
}

/** Cor por astrônomo — paleta fixa pra distinguir no calendário/mapa.
 *  As chaves seguem o nome usado no custom field "Astrônomo" do lead. */
export const ASTRONOMO_COLORS: Record<string, string> = {
  'Aline':              '#ef4444',
  'Bruno':              '#f97316',
  'Cristian':           '#f59e0b',
  'Emerson':            '#eab308',
  'Marlon':             '#84cc16',
  'Matheus Magalhães':  '#22c55e',
  'Matheus Nascimento': '#10b981',
  'Milenko':            '#14b8a6',
  'Nathalia':           '#06b6d4',
  'Olivia':             '#0ea5e9',
  'Paulo':              '#3b82f6',
  'Priscilla':          '#6366f1',
  'Procópio':           '#8b5cf6',
  'Roberto':            '#a855f7',
  'Rogério':            '#d946ef',
  'Samantha':           '#ec4899',
  'Sione':              '#f43f5e',
  'Thales':             '#78716c',
  'Thiago':             '#0891b2',
};

export function colorForAstronomo(nome: string | null | undefined): string {
  if (!nome) return '#6b7280';
  return ASTRONOMO_COLORS[nome] ?? '#6b7280';
}

/** Os nomes em `bronze.kommo_task_types.astronomo` já vêm formatados ("Procópio",
 *  "Matheus Magalhães") pra bater com o custom field "Astrônomo" do lead. Mantemos
 *  esse helper como ponto único de display caso precise customizar no futuro. */
export function astronomoDisplay(nome: string | null | undefined): string {
  return nome ?? '—';
}

export function statusLabel(s: StatusTarefa): string {
  return s === 'completa' ? 'Concluída' : s === 'atrasada' ? 'Atrasada' : 'Aberta';
}

export function statusColorClass(s: StatusTarefa): string {
  if (s === 'completa') return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30';
  if (s === 'atrasada') return 'bg-rose-500/10 text-rose-700 border-rose-500/30';
  return 'bg-sky-500/10 text-sky-700 border-sky-500/30';
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function formatCurrency(v: number | null | undefined): string {
  if (v == null) return '—';
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function kommoLeadUrl(leadId: number | null | undefined): string | null {
  if (leadId == null) return null;
  return `https://uraniaplanetario.kommo.com/leads/detail/${leadId}`;
}

export interface LeadOnboardingSemVisita {
  lead_id: number;
  pipeline_name: string;
  nome_escola: string | null;
  astronomo_card: string | null;
  cidade_estado: string | null;
  responsavel_evento: string | null;
  data_agendamento: string | null;
  created_at: string;
  tarefas_no_lead: string | null;
  lead_vazio: boolean;
  tem_agendamento_futuro: boolean;
  ja_teve_visita_completa: boolean;
}

/** Compara nome do astrônomo na TAREFA (mapping `kommo_task_types` → "MARLON")
 *  com o astrônomo informado no card do lead (custom field "Astrônomo" → "Marlon").
 *  Match permissivo: case-insensitive, sem acento, contém em ambos os sentidos. */
export function nomesBatem(astronomoTarefa: string | null, astronomoCard: string | null): boolean {
  if (!astronomoTarefa || !astronomoCard) return true; // sem dados → não acusa
  const norm = (s: string) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const e = norm(astronomoTarefa);
  const o = norm(astronomoCard);
  return o.includes(e) || e.includes(o);
}

/** Compara a data programada da tarefa (`complete_till` → `data_conclusao`)
 *  com a `data_agendamento` do lead (custom field). Considera APENAS a data
 *  (YYYY-MM-DD em America/Sao_Paulo), ignorando hora — pois a tarefa marca o
 *  dia inteiro mas a hora pode diferir do horário exato do evento. */
export function datasBatem(taskComplete: string | null, leadAgendamento: string | null): boolean {
  if (!taskComplete || !leadAgendamento) return true;
  const ymd = (iso: string) =>
    new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  return ymd(taskComplete) === ymd(leadAgendamento);
}

/** "Auditoria Tarefa": tarefas que NÃO são VISITA nem PRÉ mas estão num lead
 *  com data de agendamento preenchida (suspeita de troca de tipo após pré-visita). */
export function auditoriaTarefaSuspeita(a: Agendamento): boolean {
  if (a.desc_tarefa === 'VISITA') return false;
  if (a.desc_tarefa === 'PRÉ') return false;
  return !!a.data_agendamento;
}

export interface Filtros {
  astronomos: string[];           // [] = todos
  tiposTarefa: TipoTarefa[];      // [] = todos
  status: StatusTarefa[];         // [] = todos
  dateRange: { from: Date | null; to: Date | null };
  busca: string;                  // nome da escola ou cidade
  flagAuditoriaNome: boolean;
  flagAuditoriaData: boolean;
  flagAuditoriaTarefa: boolean;
}

export const FILTROS_DEFAULT: Filtros = {
  astronomos: [],
  tiposTarefa: [],
  status: [],
  dateRange: { from: null, to: null },
  busca: '',
  flagAuditoriaNome: false,
  flagAuditoriaData: false,
  flagAuditoriaTarefa: false,
};
