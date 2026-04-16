import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { LeadClosed, ClosedFilters, parseTimestamp } from '../types';
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

export function useFilteredClosed(leads: LeadClosed[], filters: ClosedFilters) {
  return useMemo(() => {
    return leads.filter((l) => {
      if (filters.vendedores.length > 0 && !filters.vendedores.includes(l.vendedor || '')) return false;
      if (filters.cancelado === 'sim' && !l.cancelado) return false;
      if (filters.cancelado === 'nao' && l.cancelado) return false;
      if (filters.dateRange.from) {
        const d = parseTimestamp(l.data_fechamento) ?? new Date(l.entrada_onboarding_at);
        if (d < filters.dateRange.from) return false;
      }
      if (filters.dateRange.to) {
        const d = parseTimestamp(l.data_fechamento) ?? new Date(l.entrada_onboarding_at);
        if (d > filters.dateRange.to) return false;
      }
      return true;
    });
  }, [leads, filters]);
}
