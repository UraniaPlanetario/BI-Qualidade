import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { SDR, MetaSDR, MultiplicadorComissao, MensagemSDR, AlteracaoSDR, MovimentoLead } from '../types';

export function useSDRs() {
  return useQuery<SDR[]>({
    queryKey: ['sdrs_dim'],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('config')
        .from('dim_sdrs')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data || [];
    },
    staleTime: 30 * 60 * 1000,
  });
}

export function useMetasSDR() {
  return useQuery<MetaSDR[]>({
    queryKey: ['sdrs_metas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('config')
        .from('metas_sdr')
        .select('*');
      if (error) throw error;
      return data || [];
    },
    staleTime: 30 * 60 * 1000,
  });
}

export function useMultiplicadores() {
  return useQuery<MultiplicadorComissao[]>({
    queryKey: ['sdrs_multiplicadores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('config')
        .from('multiplicadores_comissao')
        .select('*')
        .order('mpa_min');
      if (error) throw error;
      return data || [];
    },
    staleTime: 30 * 60 * 1000,
  });
}

async function fetchAllPaginated<T>(table: string, schema: 'gold' | 'config', select: string, filters: any): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    let q: any = supabase.schema(schema).from(table).select(select);
    for (const [k, v] of Object.entries(filters)) {
      if (v && typeof v === 'object' && 'op' in (v as any)) {
        const op = (v as any).op;
        const val = (v as any).val;
        q = q[op](k, val);
      }
    }
    const { data, error } = await q.range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data as T[]);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

export function useMensagensSDR(dateFrom: string | null, dateTo: string | null) {
  return useQuery<MensagemSDR[]>({
    queryKey: ['sdr_mensagens', dateFrom, dateTo],
    queryFn: async () => {
      const all: MensagemSDR[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        let q = supabase
          .schema('gold')
          .from('tempo_resposta_mensagens')
          .select('responder_user_id, responder_user_name, received_at, responded_at, response_minutes, faixa, lead_id')
          .eq('recebida_dentro_janela', true);
        if (dateFrom) q = q.gte('received_at', dateFrom);
        if (dateTo) q = q.lte('received_at', dateTo + 'T23:59:59');
        const { data, error } = await q.range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useAlteracoesSDR(dateFrom: string | null, dateTo: string | null) {
  return useQuery<AlteracaoSDR[]>({
    queryKey: ['sdr_alteracoes', dateFrom, dateTo],
    queryFn: async () => {
      const all: AlteracaoSDR[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        let q = supabase
          .schema('gold')
          .from('alteracoes_humanas')
          .select('lead_id, criado_por_id, criado_por, data_criacao, dentro_janela, campo_id')
          .eq('dentro_janela', true);
        if (dateFrom) q = q.gte('data_criacao', dateFrom);
        if (dateTo) q = q.lte('data_criacao', dateTo + 'T23:59:59');
        const { data, error } = await q.range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================================================
// RPCs agregadas (Fase 2 de performance) — substituem queries paginadas pesadas
// ============================================================================

export interface AlteracaoResumoRow {
  user_id: number;
  user_name: string | null;
  total: number;
  dias_com_alt: number;
  leads_distintos: number;
}

export function useAlteracoesResumo(dateFrom: string | null, dateTo: string | null) {
  return useQuery<AlteracaoResumoRow[]>({
    queryKey: ['alteracoes_resumo_por_user', dateFrom, dateTo],
    queryFn: async () => {
      const from = dateFrom ? dateFrom + 'T00:00:00Z' : '1970-01-01T00:00:00Z';
      const to = dateTo ? dateTo + 'T23:59:59Z' : '2999-12-31T23:59:59Z';
      const { data, error } = await supabase
        .schema('gold')
        .rpc('alteracoes_resumo_por_user', { p_from: from, p_to: to });
      if (error) throw error;
      return ((data || []) as any[]).map((r) => ({
        user_id: Number(r.user_id),
        user_name: r.user_name,
        total: Number(r.total),
        dias_com_alt: Number(r.dias_com_alt),
        leads_distintos: Number(r.leads_distintos),
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
}

export interface AlteracaoMensalRow {
  user_id: number;
  user_name: string | null;
  mes_key: string; // 'YYYY-MM'
  total: number;
}

export function useAlteracoesMensal(dateFrom: string | null, dateTo: string | null) {
  return useQuery<AlteracaoMensalRow[]>({
    queryKey: ['alteracoes_mensal_por_user', dateFrom, dateTo],
    queryFn: async () => {
      const from = dateFrom ? dateFrom + 'T00:00:00Z' : '1970-01-01T00:00:00Z';
      const to = dateTo ? dateTo + 'T23:59:59Z' : '2999-12-31T23:59:59Z';
      const { data, error } = await supabase
        .schema('gold')
        .rpc('alteracoes_mensal_por_user', { p_from: from, p_to: to });
      if (error) throw error;
      return ((data || []) as any[]).map((r) => ({
        user_id: Number(r.user_id),
        user_name: r.user_name,
        mes_key: r.mes_key,
        total: Number(r.total),
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
}

export interface AlteracaoDiariaRow {
  user_id: number;
  user_name: string | null;
  dia: string; // YYYY-MM-DD
  total: number;
}

export function useAlteracoesDiaria(dateFrom: string | null, dateTo: string | null) {
  return useQuery<AlteracaoDiariaRow[]>({
    queryKey: ['alteracoes_diaria_por_user', dateFrom, dateTo],
    queryFn: async () => {
      const from = dateFrom ? dateFrom + 'T00:00:00Z' : '1970-01-01T00:00:00Z';
      const to = dateTo ? dateTo + 'T23:59:59Z' : '2999-12-31T23:59:59Z';
      const { data, error } = await supabase
        .schema('gold')
        .rpc('alteracoes_diaria_por_user', { p_from: from, p_to: to });
      if (error) throw error;
      return ((data || []) as any[]).map((r) => ({
        user_id: Number(r.user_id),
        user_name: r.user_name,
        dia: r.dia,
        total: Number(r.total),
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
}

export interface TempoRespostaFaixaRow {
  user_id: number;
  user_name: string | null;
  faixa: string;
  count: number;
}

export function useTempoRespostaFaixa(dateFrom: string | null, dateTo: string | null) {
  return useQuery<TempoRespostaFaixaRow[]>({
    queryKey: ['tempo_resposta_por_user_faixa', dateFrom, dateTo],
    queryFn: async () => {
      const from = dateFrom ? dateFrom + 'T00:00:00Z' : '1970-01-01T00:00:00Z';
      const to = dateTo ? dateTo + 'T23:59:59Z' : '2999-12-31T23:59:59Z';
      const { data, error } = await supabase
        .schema('gold')
        .rpc('tempo_resposta_por_user_faixa', { p_from: from, p_to: to });
      if (error) throw error;
      return ((data || []) as any[]).map((r) => ({
        user_id: Number(r.user_id),
        user_name: r.user_name,
        faixa: r.faixa,
        count: Number(r.count),
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
}

export interface MovQualifRow {
  kind: 'recebidos_time' | 'qualificados_user';
  user_id: number | null;
  user_name: string | null;
  leads: number;
}

export function useMovimentosQualificacao(dateFrom: string | null, dateTo: string | null) {
  return useQuery<MovQualifRow[]>({
    queryKey: ['movimentos_qualificacao_resumo', dateFrom, dateTo],
    queryFn: async () => {
      const from = dateFrom ? dateFrom + 'T00:00:00Z' : '1970-01-01T00:00:00Z';
      const to = dateTo ? dateTo + 'T23:59:59Z' : '2999-12-31T23:59:59Z';
      const { data, error } = await supabase
        .schema('gold')
        .rpc('movimentos_qualificacao_resumo', { p_from: from, p_to: to });
      if (error) throw error;
      return ((data || []) as any[]).map((r) => ({
        kind: r.kind,
        user_id: r.user_id != null ? Number(r.user_id) : null,
        user_name: r.user_name,
        leads: Number(r.leads),
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Mapa lead_id → SDR (custom field). Usado pra atribuir qualificações ao SDR correto. */
export function useLeadsSDRMap() {
  return useQuery<Map<number, string>>({
    queryKey: ['leads_sdr_map'],
    queryFn: async () => {
      const map = new Map<number, string>();
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .schema('gold')
          .from('cubo_leads_consolidado')
          .select('id_lead, sdr')
          .not('sdr', 'is', null)
          .neq('sdr', '')
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        for (const r of data as { id_lead: number; sdr: string | null }[]) {
          if (r.sdr) map.set(r.id_lead, r.sdr.trim());
        }
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return map;
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useMovimentosSDR(dateFrom: string | null, dateTo: string | null) {
  return useQuery<MovimentoLead[]>({
    queryKey: ['sdr_movimentos', dateFrom, dateTo],
    queryFn: async () => {
      const all: MovimentoLead[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        let q = supabase
          .schema('gold')
          .from('leads_movements')
          .select('lead_id, pipeline_from, pipeline_to, status_to, status_to_id, moved_by, moved_by_id, moved_at');
        if (dateFrom) q = q.gte('moved_at', dateFrom);
        if (dateTo) q = q.lte('moved_at', dateTo + 'T23:59:59');
        const { data, error } = await q.range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data as MovimentoLead[]);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Movimentos de leads CRIADOS no período — filtra por `lead_created_at` (não `moved_at`).
 *  Útil para métricas de funil onde a base é "leads que nasceram no canal X no período". */
export function useMovimentosLeadsCriados(dateFrom: string | null, dateTo: string | null) {
  return useQuery<MovimentoLead[]>({
    queryKey: ['sdr_movimentos_leads_criados', dateFrom, dateTo],
    queryFn: async () => {
      const all: MovimentoLead[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        let q = supabase
          .schema('gold')
          .from('leads_movements')
          .select('lead_id, pipeline_from, pipeline_to, status_to, status_to_id, moved_by, moved_by_id, moved_at, lead_created_at');
        if (dateFrom) q = q.gte('lead_created_at', dateFrom);
        if (dateTo) q = q.lte('lead_created_at', dateTo + 'T23:59:59');
        const { data, error } = await q.range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data as MovimentoLead[]);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
    staleTime: 5 * 60 * 1000,
  });
}
