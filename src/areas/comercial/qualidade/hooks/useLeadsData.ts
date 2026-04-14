import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { LeadQuality, Filters } from '../types';
import { useMemo } from 'react';

export function useLeadsData() {
  return useQuery<LeadQuality[]>({
    queryKey: ['leads_quality'],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('gold')
        .from('leads_quality')
        .select('*')
        .order('created_at_kommo', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useFilteredLeads(leads: LeadQuality[], filters: Filters) {
  return useMemo(() => {
    return leads.filter((lead) => {
      if (filters.vendedores.length > 0 && !filters.vendedores.includes(lead.vendedor_consultor || '')) return false;
      if (filters.scores.length > 0 && !filters.scores.includes(lead.score_qualidade || '')) return false;
      if (filters.dateRange.from && lead.created_at_kommo) {
        if (new Date(lead.created_at_kommo) < filters.dateRange.from) return false;
      }
      if (filters.dateRange.to && lead.created_at_kommo) {
        if (new Date(lead.created_at_kommo) > filters.dateRange.to) return false;
      }
      if (filters.closeDateRange.from && lead.data_fechamento) {
        if (new Date(lead.data_fechamento) < filters.closeDateRange.from) return false;
      }
      if (filters.closeDateRange.to && lead.data_fechamento) {
        if (new Date(lead.data_fechamento) > filters.closeDateRange.to) return false;
      }
      return true;
    });
  }, [leads, filters]);
}
