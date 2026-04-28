import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { LeadClosed, LeadClosedOrigem, ClosedFilters } from '../types';
import { useMemo } from 'react';

export function useClosedLeads() {
  return useQuery<LeadClosed[]>({
    queryKey: ['leads_closed'],
    queryFn: async () => {
      const allData: LeadClosed[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .schema('gold')
          .from('leads_closed')
          .select('*')
          .order('entrada_onboarding_at', { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return allData;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/** Leads fechados enriquecidos com classificação de caminho no CRM (gold.leads_closed_origem). */
export function useLeadsOrigem() {
  return useQuery<LeadClosedOrigem[]>({
    queryKey: ['leads_closed_origem'],
    queryFn: async () => {
      const all: LeadClosedOrigem[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .schema('gold')
          .from('leads_closed_origem')
          .select('*')
          .order('data_fechamento_fmt', { ascending: false, nullsFirst: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...(data as LeadClosedOrigem[]));
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useFilteredClosed(leads: LeadClosed[], filters: ClosedFilters) {
  return useMemo(() => {
    return leads.filter((l) => {
      if (filters.vendedores.length > 0 && !filters.vendedores.includes(l.vendedor || '')) return false;
      if (filters.astronomos.length > 0 && !filters.astronomos.includes(l.astronomo || '')) return false;
      if (filters.cancelado === 'sim' && !l.cancelado) return false;
      if (filters.cancelado === 'nao' && l.cancelado) return false;
      const refDateStr = l.cancelado ? l.data_cancelamento_fmt : l.data_fechamento_fmt;
      if (!refDateStr) return false;
      const ref = refDateStr.slice(0, 10); // YYYY-MM-DD
      if (filters.dateRange.from) {
        const y = filters.dateRange.from.getFullYear();
        const m = String(filters.dateRange.from.getMonth() + 1).padStart(2, '0');
        const d = String(filters.dateRange.from.getDate()).padStart(2, '0');
        if (ref < `${y}-${m}-${d}`) return false;
      }
      if (filters.dateRange.to) {
        const y = filters.dateRange.to.getFullYear();
        const m = String(filters.dateRange.to.getMonth() + 1).padStart(2, '0');
        const d = String(filters.dateRange.to.getDate()).padStart(2, '0');
        if (ref > `${y}-${m}-${d}`) return false;
      }
      return true;
    });
  }, [leads, filters]);
}
