import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { MetaFaturamento, LeadFechado } from '../types';

const CURRENT_YEAR = new Date().getFullYear();

export function useMetas() {
  return useQuery<MetaFaturamento[]>({
    queryKey: ['metas_faturamento', CURRENT_YEAR],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('config')
        .from('metas_faturamento')
        .select('*')
        .eq('ano', CURRENT_YEAR)
        .order('mes');
      if (error) throw error;
      return data || [];
    },
    staleTime: 30 * 60 * 1000,
  });
}

export function useLeadsFechados() {
  return useQuery<LeadFechado[]>({
    queryKey: ['leads_faturamento', CURRENT_YEAR],
    queryFn: async () => {
      const allData: LeadFechado[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .schema('gold')
          .from('cubo_leads_consolidado')
          .select('id_lead, valor_total, data_de_fechamento, data_e_hora_do_agendamento, vendedor')
          .eq('status_lead', 'Venda Fechada')
          .not('nome_lead', 'is', null)
          .not('data_de_fechamento', 'is', null)
          .gte('data_de_fechamento', `${CURRENT_YEAR}-01-01`)
          .lte('data_de_fechamento', `${CURRENT_YEAR}-12-31`)
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }

      // Dedup: manter passagem com data_de_fechamento mais recente por id_lead
      const latest = new Map<number, LeadFechado>();
      for (const l of allData) {
        const existing = latest.get(l.id_lead);
        if (!existing || (l.data_de_fechamento || '') > (existing.data_de_fechamento || '')) {
          latest.set(l.id_lead, l);
        }
      }
      return Array.from(latest.values());
    },
    staleTime: 5 * 60 * 1000,
  });
}
