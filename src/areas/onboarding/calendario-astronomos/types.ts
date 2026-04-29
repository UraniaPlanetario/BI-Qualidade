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
  produtos_contratados: string | null;
  cliente_desde: string | null;
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

/** Formata telefone BR pra "+55 (DD) NNNNN-NNNN". Aceita variações (com/sem DDI,
 *  fixo/celular). Retorna o valor original se não casar com nenhum padrão. */
export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return '—';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('55')) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 12 && digits.startsWith('55')) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  if (digits.length === 11) {
    return `+55 (${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `+55 (${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return raw;
}

/** Formata data REAL da visita: pega o DIA da tarefa (`data_conclusao`) e a
 *  HORA do agendamento (`data_agendamento`). O time costuma marcar a tarefa
 *  com 23:59 pra não vencer ao longo do dia, então a hora real da visita
 *  vem do custom field "Data e Hora do Agendamento" do lead.
 *
 *  Quando não há `data_agendamento`, retorna só o dia. */
export function formatDataVisita(
  a: Pick<Agendamento, 'data_conclusao' | 'data_agendamento'>,
): string {
  if (!a.data_conclusao) return '—';
  const dia = new Date(a.data_conclusao).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
  if (!a.data_agendamento) return dia;
  const hora = new Date(a.data_agendamento).toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit',
  });
  return `${dia} · ${hora}`;
}

/** Gera URL do Google Maps pro agendamento. Prioriza coordenadas precisas;
 *  cai pra busca por endereço/cidade quando não há lat/long. */
export function googleMapsUrl(a: Pick<Agendamento, 'latitude' | 'longitude' | 'endereco' | 'cidade_estado' | 'nome_escola'>): string | null {
  if (a.latitude != null && a.longitude != null) {
    return `https://www.google.com/maps/search/?api=1&query=${a.latitude},${a.longitude}`;
  }
  const parts = [a.endereco, a.cidade_estado].filter(Boolean).join(', ');
  if (parts) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts)}`;
  if (a.nome_escola) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.nome_escola)}`;
  return null;
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

export interface AuditFlags {
  nome: boolean;
  data: boolean;
  tarefa: boolean;
}

const FLAGS_VAZIO: AuditFlags = { nome: false, data: false, tarefa: false };

/** Computa flags de auditoria considerando o contexto do lead.
 *
 *  Regra especial pra **auditoria de data com múltiplas diárias**:
 *  no card do lead só cabe 1 data de agendamento, mas a operação cria N tarefas
 *  VISITA (1 por dia da diária). Se o lead tem `numero_diarias = N` e o BI
 *  encontra exatamente N tarefas VISITA, e a primeira (data mais antiga) bate
 *  com `data_agendamento`, então as outras N-1 tarefas (em dias subsequentes)
 *  são esperadas e NÃO devem acender flag de data.
 *
 *  Quando essa condição não bate (qtd de visitas ≠ diárias, ou primeira data
 *  diverge), volta pra comparação individual tarefa-a-tarefa. */
export function computeAuditFlags(items: Agendamento[]): Map<number, AuditFlags> {
  const result = new Map<number, AuditFlags>();

  // Agrupa por lead pra avaliar a regra de série de visitas
  const byLead = new Map<number, Agendamento[]>();
  for (const a of items) {
    if (a.lead_id == null) continue;
    const arr = byLead.get(a.lead_id) ?? [];
    arr.push(a);
    byLead.set(a.lead_id, arr);
  }

  // Conjunto de leads onde a série de visitas está em ordem (primeira bate
  // com data_agendamento e qtd === numero_diarias) — todas as visitas OK.
  const leadsComSerieOk = new Set<number>();
  for (const [leadId, arr] of byLead) {
    const ref = arr[0];
    if (!ref?.data_agendamento) continue;
    const numDias = Math.max(1, Number(ref.numero_diarias) || 1);
    if (numDias < 2) continue; // 1 diária cai na regra individual
    const visitas = arr
      .filter((x) => x.desc_tarefa === 'VISITA' && x.data_conclusao)
      .sort((x, y) =>
        new Date(x.data_conclusao!).getTime() - new Date(y.data_conclusao!).getTime(),
      );
    if (visitas.length !== numDias) continue;
    if (datasBatem(visitas[0].data_conclusao, ref.data_agendamento)) {
      leadsComSerieOk.add(leadId);
    }
  }

  for (const a of items) {
    let flagData = !datasBatem(a.data_conclusao, a.data_agendamento);
    if (
      flagData &&
      a.lead_id != null &&
      a.desc_tarefa === 'VISITA' &&
      leadsComSerieOk.has(a.lead_id)
    ) {
      flagData = false;
    }
    result.set(a.task_id, {
      nome: !nomesBatem(a.astronomo, a.astronomo_card),
      data: flagData,
      tarefa: auditoriaTarefaSuspeita(a),
    });
  }
  return result;
}

export function getFlags(map: Map<number, AuditFlags> | undefined, taskId: number): AuditFlags {
  return map?.get(taskId) ?? FLAGS_VAZIO;
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
