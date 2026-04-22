import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface ActiveUser {
  id: number;
  name: string;
  group_name: string | null;
}

export interface OpenLead {
  id_lead: number;
  vendedor: string | null;
  funil_atual: string | null;
  estagio_atual: string | null;
}

export interface ClosedLeadPeriodo {
  vendedor: string | null;
  data_de_fechamento: string | null;
  numero_de_diarias: string | null;
}

export interface OpenTask {
  id: number;
  entity_id: number | null;
  responsible_user_id: number | null;
  is_completed: boolean | null;
  complete_till: string | null;
}

export function useActiveConsultores() {
  return useQuery<ActiveUser[]>({
    queryKey: ['consistencia_active_consultores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('bronze')
        .from('kommo_users')
        .select('id, name, group_name')
        .eq('is_active', true)
        .eq('group_name', 'Consultores Inbound')
        .order('name');
      if (error) throw error;
      return (data || []) as ActiveUser[];
    },
    staleTime: 30 * 60 * 1000,
  });
}

export function useOpenLeads() {
  return useQuery<OpenLead[]>({
    queryKey: ['consistencia_open_leads'],
    queryFn: async () => {
      const all: OpenLead[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .schema('gold')
          .from('cubo_leads_consolidado')
          .select('id_lead, vendedor, funil_atual, estagio_atual')
          .eq('status_lead', 'Em andamento')
          .eq('funil_atual', 'Vendas WhatsApp')
          .not('vendedor', 'is', null)
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...(data as OpenLead[]));
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useClosedLeadsPeriodo(dateFrom: string | null, dateTo: string | null) {
  return useQuery<ClosedLeadPeriodo[]>({
    queryKey: ['consistencia_closed_leads', dateFrom, dateTo],
    queryFn: async () => {
      const all: ClosedLeadPeriodo[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        let q = supabase
          .schema('gold')
          .from('cubo_leads_consolidado')
          .select('vendedor, data_de_fechamento, numero_de_diarias')
          .eq('status_lead', 'Venda Fechada')
          .not('vendedor', 'is', null)
          .not('data_de_fechamento', 'is', null);
        if (dateFrom) q = q.gte('data_de_fechamento', dateFrom);
        if (dateTo) q = q.lte('data_de_fechamento', dateTo + 'T23:59:59');
        const { data, error } = await q.range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...(data as ClosedLeadPeriodo[]));
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export interface ActivitySummary {
  user_id: number;
  user_name: string;
  role_name: string | null;
  category: string;
  event_type: string;
  total: number;
  dias_com_atividade: number;
}

export function useActivitiesSummary(dateFrom: string | null, dateTo: string | null) {
  return useQuery<ActivitySummary[]>({
    queryKey: ['monitoramento_activities_summary', dateFrom, dateTo],
    queryFn: async () => {
      const from = dateFrom ? dateFrom + 'T00:00:00Z' : '1970-01-01T00:00:00Z';
      const to = dateTo ? dateTo + 'T23:59:59Z' : '2999-12-31T23:59:59Z';
      const { data, error } = await supabase
        .schema('gold')
        .rpc('activities_summary_periodo', { p_from: from, p_to: to });
      if (error) throw error;
      return ((data || []) as any[]).map((r) => ({
        user_id: Number(r.user_id),
        user_name: r.user_name,
        role_name: r.role_name,
        category: r.category,
        event_type: r.event_type,
        total: Number(r.total),
        dias_com_atividade: Number(r.dias_com_atividade),
      }));
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export interface MensagensPorLeadRow {
  user_id: number;
  total_msgs: number;
  leads_distintos: number;
}

export function useMensagensPorLead(dateFrom: string | null, dateTo: string | null) {
  return useQuery<MensagensPorLeadRow[]>({
    queryKey: ['monitoramento_msgs_por_lead', dateFrom, dateTo],
    queryFn: async () => {
      const from = dateFrom ? dateFrom + 'T00:00:00Z' : '1970-01-01T00:00:00Z';
      const to = dateTo ? dateTo + 'T23:59:59Z' : '2999-12-31T23:59:59Z';
      const { data, error } = await supabase
        .schema('gold')
        .rpc('mensagens_por_user_lead', { p_from: from, p_to: to });
      if (error) throw error;
      return ((data || []) as any[]).map((r) => ({
        user_id: Number(r.user_id),
        total_msgs: Number(r.total_msgs),
        leads_distintos: Number(r.leads_distintos),
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
}

export interface TopCampoRow {
  campo_nome: string;
  total: number;
}

export function useTopCamposAlterados(dateFrom: string | null, dateTo: string | null, limit = 20) {
  return useQuery<TopCampoRow[]>({
    queryKey: ['monitoramento_top_campos', dateFrom, dateTo, limit],
    queryFn: async () => {
      const from = dateFrom ? dateFrom + 'T00:00:00Z' : '1970-01-01T00:00:00Z';
      const to = dateTo ? dateTo + 'T23:59:59Z' : '2999-12-31T23:59:59Z';
      const { data, error } = await supabase
        .schema('gold')
        .rpc('top_campos_alterados_periodo', { p_from: from, p_to: to, p_limit: limit });
      if (error) throw error;
      return ((data || []) as any[]).map((r) => ({
        campo_nome: r.campo_nome,
        total: Number(r.total),
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useLeadsAtribuidosPeriodo(dateFrom: string | null, dateTo: string | null) {
  return useQuery<Record<number, number>>({
    queryKey: ['consistencia_leads_atribuidos', dateFrom, dateTo],
    queryFn: async () => {
      const from = dateFrom ? dateFrom + 'T00:00:00Z' : '1970-01-01T00:00:00Z';
      const to = dateTo ? dateTo + 'T23:59:59Z' : '2999-12-31T23:59:59Z';
      const { data, error } = await supabase
        .schema('gold')
        .rpc('leads_atribuidos_por_user', { p_from: from, p_to: to });
      if (error) throw error;
      const counts: Record<number, number> = {};
      for (const row of (data || []) as { user_id: number; leads: number }[]) {
        counts[row.user_id] = Number(row.leads);
      }
      return counts;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCamposAlteradosFiltered(dateFrom: string | null, dateTo: string | null) {
  return useQuery<Record<number, number>>({
    queryKey: ['consistencia_campos_filtered', dateFrom, dateTo],
    queryFn: async () => {
      const from = dateFrom ? dateFrom + 'T00:00:00Z' : '1970-01-01T00:00:00Z';
      const to = dateTo ? dateTo + 'T23:59:59Z' : '2999-12-31T23:59:59Z';
      const { data, error } = await supabase
        .schema('gold')
        .rpc('campos_alterados_filtrados_por_user', { p_from: from, p_to: to });
      if (error) throw error;
      const counts: Record<number, number> = {};
      for (const row of (data || []) as { user_id: number; total: number }[]) {
        counts[row.user_id] = Number(row.total);
      }
      return counts;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useOpenTasks() {
  return useQuery<OpenTask[]>({
    queryKey: ['consistencia_open_tasks'],
    queryFn: async () => {
      const all: OpenTask[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .schema('bronze')
          .from('kommo_tasks')
          .select('id, entity_id, responsible_user_id, is_completed, complete_till')
          .eq('is_completed', false)
          .eq('entity_type', 'leads')
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...(data as OpenTask[]));
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
    staleTime: 5 * 60 * 1000,
  });
}
