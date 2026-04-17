import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { LeadCampanha, CampanhaFilters, FUNIS_VALIDOS, normalizeVendedor } from '../types';
import { useMemo } from 'react';

export function useCampanhaLeads() {
  return useQuery<LeadCampanha[]>({
    queryKey: ['campanhas_leads'],
    queryFn: async () => {
      const allData: LeadCampanha[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .schema('gold')
          .from('cubo_leads_consolidado')
          .select('id_lead, nome_lead, valor_total, vendedor, data_de_fechamento, data_e_hora_do_agendamento, funil_atual, estagio_atual, numero_de_diarias, tipo_lead, produtos, conteudo_apresentacao')
          .eq('status_lead', 'Venda Fechada')
          .not('nome_lead', 'is', null)
          .not('data_de_fechamento', 'is', null)
          .in('funil_atual', FUNIS_VALIDOS)
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
  });
}

export function useFilteredCampanha(leads: LeadCampanha[], filters: CampanhaFilters) {
  return useMemo(() => {
    // Filtrar regras globais
    let filtered = leads.filter((l) => {
      // Tipo lead não Shoppings
      if (l.tipo_lead === 'Shoppings') return false;
      // Estágio atual não contém Pré Reserva nem Geladeira
      if (l.estagio_atual?.includes('Pré Reserva') || l.estagio_atual?.includes('Geladeira')) return false;
      // Vendedor preenchido e não Daiana Léia
      const v = normalizeVendedor(l.vendedor);
      if (v === 'Não atribuído' || v === 'Daiana Leia' || v === 'Daiana Léia') return false;
      // Data agendamento > data fechamento
      if (l.data_e_hora_do_agendamento && l.data_de_fechamento) {
        if (l.data_e_hora_do_agendamento <= l.data_de_fechamento) return false;
      }
      // Filtro de período
      if (filters.dateRange.from && l.data_de_fechamento) {
        const y = filters.dateRange.from.getFullYear();
        const m = String(filters.dateRange.from.getMonth() + 1).padStart(2, '0');
        const d = String(filters.dateRange.from.getDate()).padStart(2, '0');
        if (l.data_de_fechamento < `${y}-${m}-${d}`) return false;
      }
      if (filters.dateRange.to && l.data_de_fechamento) {
        const y = filters.dateRange.to.getFullYear();
        const m = String(filters.dateRange.to.getMonth() + 1).padStart(2, '0');
        const d = String(filters.dateRange.to.getDate()).padStart(2, '0');
        if (l.data_de_fechamento > `${y}-${m}-${d}`) return false;
      }
      return true;
    });

    // Deduplicar: manter passagem com data_de_fechamento mais recente por id_lead
    const latest = new Map<number, LeadCampanha>();
    for (const l of filtered) {
      const existing = latest.get(l.id_lead);
      if (!existing || (l.data_de_fechamento || '') > (existing.data_de_fechamento || '')) {
        latest.set(l.id_lead, l);
      }
    }
    return Array.from(latest.values());
  }, [leads, filters]);
}
