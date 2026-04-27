import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Agendamento, TipoTarefa, LeadOnboardingSemVisita } from '../types';

const PAGE_SIZE = 1000;

/** Busca todos os agendamentos da gold.agendamentos_astronomos.
 *  Datasets pequenos (~600-2000 linhas), então uma query única é suficiente. */
export function useAgendamentos() {
  return useQuery<Agendamento[]>({
    queryKey: ['agendamentos_astronomos'],
    queryFn: async () => {
      const all: Agendamento[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .schema('gold')
          .from('agendamentos_astronomos')
          .select('*')
          .order('data_conclusao', { ascending: true, nullsFirst: false })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...(data as Agendamento[]));
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      return all;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Lista de astrônomos do mapping (`bronze.kommo_task_types`). */
export function useAstronomos() {
  return useQuery<string[]>({
    queryKey: ['astronomos_lista'],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('bronze')
        .from('kommo_task_types')
        .select('astronomo')
        .not('astronomo', 'is', null);
      if (error) throw error;
      const set = new Set<string>();
      for (const row of data ?? []) if (row.astronomo) set.add(row.astronomo);
      return Array.from(set).sort();
    },
    staleTime: 60 * 60 * 1000,
  });
}

/** Auditoria: leads ativos no funil de onboarding sem tarefa de VISITA aberta. */
export function useOnboardingSemVisita() {
  return useQuery<LeadOnboardingSemVisita[]>({
    queryKey: ['leads_onboarding_sem_visita'],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('gold')
        .from('leads_onboarding_sem_visita')
        .select('*')
        .order('data_agendamento', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as LeadOnboardingSemVisita[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export interface AgendamentoStats {
  total: number;
  abertas: number;
  atrasadas: number;
  completas: number;
  porTipo: Record<TipoTarefa, number>;
}

export function calcStats(items: Agendamento[]): AgendamentoStats {
  const stats: AgendamentoStats = {
    total: items.length, abertas: 0, atrasadas: 0, completas: 0,
    porTipo: { 'PRÉ': 0, 'VISITA': 0, 'RESERVA': 0, 'Ñ MARCAR': 0 },
  };
  for (const a of items) {
    if (a.status_tarefa === 'aberta') stats.abertas++;
    else if (a.status_tarefa === 'atrasada') stats.atrasadas++;
    else if (a.status_tarefa === 'completa') stats.completas++;
    if (a.desc_tarefa && a.desc_tarefa in stats.porTipo) stats.porTipo[a.desc_tarefa]++;
  }
  return stats;
}
