import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  PIPELINE_VENDAS_WHATS_ID, PIPELINE_VENDAS_WHATS_NAME, STATUS_CLOSED_LOST,
} from '../types';

/** Lista de responsible_user_name distintos dos leads no Vendas WhatsApp.
 *  Usado pra popular o filtro de responsáveis. */
export function useResponsaveisFunil() {
  return useQuery<string[]>({
    queryKey: ['auditoria_funil_responsaveis'],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('bronze')
        .from('kommo_leads_raw')
        .select('responsible_user_name')
        .eq('pipeline_name', PIPELINE_VENDAS_WHATS_NAME)
        .not('responsible_user_name', 'is', null)
        .not('is_deleted', 'is', true);
      if (error) throw error;
      const set = new Set<string>();
      for (const row of data ?? []) if (row.responsible_user_name) set.add(row.responsible_user_name);
      return Array.from(set).sort();
    },
    staleTime: 60 * 60 * 1000,
  });
}

/** Última atualização da bronze (synced_at mais recente). Usado no aviso
 *  "última atualização" do dashboard. */
export function useUltimoSync() {
  return useQuery<string | null>({
    queryKey: ['auditoria_funil_ultimo_sync'],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('bronze')
        .from('kommo_leads_raw')
        .select('synced_at')
        .order('synced_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.synced_at ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Linha da view gold.funil_whats_leads_atual — 1 por lead atualmente no
 *  pipeline Vendas WhatsApp. */
export interface LeadAtual {
  lead_id: number;
  lead_name: string | null;
  responsible_user_id: number | null;
  responsible_user_name: string | null;
  vendedor_consultor: string | null;
  pipeline_id: number;
  pipeline_name: string;
  status_id: number;
  status_name: string | null;
  lead_created_at: string;
  entrada_funil_at: string;
  entrada_etapa_atual_at: string;
  dias_no_funil: number;
  dias_na_etapa_atual: number;
  tarefa_id: number | null;
  tarefa_text: string | null;
  tarefa_complete_till: string | null;
  tarefa_responsible_user_id: number | null;
  tarefa_responsible_user_name: string | null;
  dias_tarefa_vencida: number | null;
  ultima_msg_enviada_at: string | null;
  dias_sem_interacao: number | null;
}

/** Snapshot atual de todos os leads no Vendas WhatsApp (44k leads — paginado
 *  em batches de 1000 pra contornar o limite do PostgREST). */
export function useLeadsAtuaisFunil() {
  return useQuery<LeadAtual[]>({
    queryKey: ['funil_whats_leads_atual'],
    queryFn: async () => {
      const all: LeadAtual[] = [];
      const pageSize = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .schema('gold')
          .from('funil_whats_leads_atual')
          .select('*')
          .order('dias_no_funil', { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...(data as LeadAtual[]));
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export interface EntradasHoje {
  criados: number;
  perdidos: number;
}

/** KPIs do dia atual: leads criados (criação direta no Vendas Whats OU
 *  movimentação vinda de outro pipeline pra cá) e perdidos (movidos pra
 *  Closed-lost dentro do Vendas Whats). */
export function useEntradasHoje() {
  return useQuery<EntradasHoje>({
    queryKey: ['funil_whats_entradas_hoje'],
    queryFn: async () => {
      const today = new Date();
      const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const startIso = `${ymd}T00:00:00Z`;
      const endIso = `${ymd}T23:59:59Z`;

      // Criados HOJE direto no Vendas Whats
      const criadosDireto = await supabase
        .schema('bronze')
        .from('kommo_leads_raw')
        .select('id', { count: 'exact', head: true })
        .eq('pipeline_id', PIPELINE_VENDAS_WHATS_ID)
        .gte('created_at', startIso)
        .lte('created_at', endIso)
        .not('is_deleted', 'is', true);
      if (criadosDireto.error) throw criadosDireto.error;

      // Movidos pra Vendas Whats vindo de OUTRO pipeline hoje
      const movidos = await supabase
        .schema('gold')
        .from('leads_movements')
        .select('lead_id', { count: 'exact', head: true })
        .eq('pipeline_to_id', PIPELINE_VENDAS_WHATS_ID)
        .neq('pipeline_from_id', PIPELINE_VENDAS_WHATS_ID)
        .gte('moved_at', startIso)
        .lte('moved_at', endIso);
      if (movidos.error) throw movidos.error;

      // Perdidos hoje: mov pra status 143 dentro do Vendas Whats
      const perdidos = await supabase
        .schema('gold')
        .from('leads_movements')
        .select('lead_id', { count: 'exact', head: true })
        .eq('pipeline_to_id', PIPELINE_VENDAS_WHATS_ID)
        .eq('status_to_id', STATUS_CLOSED_LOST)
        .gte('moved_at', startIso)
        .lte('moved_at', endIso);
      if (perdidos.error) throw perdidos.error;

      return {
        criados: (criadosDireto.count ?? 0) + (movidos.count ?? 0),
        perdidos: perdidos.count ?? 0,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}
