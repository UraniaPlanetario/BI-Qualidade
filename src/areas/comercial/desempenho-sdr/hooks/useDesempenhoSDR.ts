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
          .from('cubo_alteracao_campos_eventos')
          .select('lead_id, criado_por_id, criado_por, data_criacao, dentro_janela, campo_id')
          .eq('dentro_janela', true)
          // Excluir campo "Etapa do funil" (851177) - atualizado automaticamente pelo CRM
          .neq('campo_id', 851177);
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
          .select('lead_id, pipeline_from, pipeline_to, status_to, moved_by, moved_by_id, moved_at');
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
