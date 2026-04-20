import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { LeadVendedor, MensagemTempo, AlteracaoCampo, VendedorFilters } from '../types';
import { useMemo } from 'react';

const FUNIS_FECHADOS = ['Onboarding Escolas', 'Onboarding SME', 'Financeiro', 'Clientes - CS', 'Shopping Fechados'];

async function fetchAllPaginated<T>(builder: any): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await builder.range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

export function useLeadsVendedor() {
  return useQuery<LeadVendedor[]>({
    queryKey: ['vendedor_leads'],
    queryFn: async () => {
      const all: LeadVendedor[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .schema('gold')
          .from('cubo_leads_consolidado')
          .select('id_lead, nome_lead, valor_total, vendedor, funil_atual, estagio_atual, data_de_fechamento, data_e_hora_do_agendamento, data_cancelamento, data_criacao, numero_de_diarias, tipo_lead, status_lead, cancelado')
          .not('vendedor', 'is', null)
          .neq('tipo_lead', 'Shoppings')
          .range(from, from + pageSize - 1);
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

export function useTempoResposta(dateFrom: string | null, dateTo: string | null) {
  return useQuery<MensagemTempo[]>({
    queryKey: ['vendedor_tempo_resposta', dateFrom, dateTo],
    queryFn: async () => {
      const all: MensagemTempo[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        let query = supabase
          .schema('gold')
          .from('tempo_resposta_mensagens')
          .select('responder_user_id, responder_user_name, received_at, responded_at, response_minutes, faixa, recebida_dentro_janela')
          .eq('recebida_dentro_janela', true);
        if (dateFrom) query = query.gte('received_at', dateFrom);
        if (dateTo) query = query.lte('received_at', dateTo + 'T23:59:59');
        const { data, error } = await query.range(from, from + pageSize - 1);
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

export function useAlteracoesCampos(dateFrom: string | null, dateTo: string | null) {
  return useQuery<AlteracaoCampo[]>({
    queryKey: ['vendedor_alteracoes', dateFrom, dateTo],
    queryFn: async () => {
      const all: AlteracaoCampo[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        let query = supabase
          .schema('gold')
          .from('cubo_alteracao_campos_eventos')
          .select('lead_id, criado_por_id, criado_por, data_criacao, dentro_janela')
          .eq('dentro_janela', true)
          // Excluir campo "Etapa do funil" (851177) - atualizado automaticamente pelo CRM
          .neq('campo_id', 851177);
        if (dateFrom) query = query.gte('data_criacao', dateFrom);
        if (dateTo) query = query.lte('data_criacao', dateTo + 'T23:59:59');
        const { data, error } = await query.range(from, from + pageSize - 1);
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

export { FUNIS_FECHADOS };
