import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { LeadAtual } from '@/areas/comercial/auditoria-funil-vendas/hooks/useFunilWhatsapp';

/** Vendedor mapeado pro user logado (texto exato do custom field
 *  "Vendedor/Consultor" no Kommo). NULL se admin não preencheu o campo
 *  `users.vendedor_consultor` no perfil. */
export function useMeuVendedor() {
  return useQuery<string | null>({
    queryKey: ['meu_vendedor_consultor'],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('gold')
        .rpc('get_meu_vendedor_consultor');
      if (error) throw error;
      return (data as string | null) ?? null;
    },
    staleTime: 60 * 60 * 1000,
  });
}

/** kommo_user_id do user logado — usado pra filtrar a Auditoria por
 *  responsible_user_id do lead. NULL se admin/sync não preencheu. */
export function useMeuKommoUserId() {
  return useQuery<number | null>({
    queryKey: ['meu_kommo_user_id'],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('gold')
        .rpc('get_meu_kommo_user_id');
      if (error) throw error;
      return (data as number | null) ?? null;
    },
    staleTime: 60 * 60 * 1000,
  });
}

export interface MeuLeadFechado {
  lead_id: number;
  lead_name: string | null;
  vendedor: string | null;
  data_fechamento_fmt: string | null;
  data_agendamento_fmt: string | null;
  data_cancelamento_fmt: string | null;
  cancelado: boolean;
  pipeline_onboarding: string | null;
  pipeline_atual: string | null;
  status_atual: string | null;
  lead_price: number | null;
  n_diarias: string | null;
  occurrence: number;
  lead_created_at: string | null;
}

/** Leads do vendedor logado em gold.funil_whats_leads_atual (pipeline Vendas
 *  WhatsApp). Cruza por lead.responsible_user_id = users.kommo_user_id. */
export function useMeusLeadsFunil() {
  return useQuery<LeadAtual[]>({
    queryKey: ['meus_leads_funil'],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('gold')
        .rpc('get_meus_leads_funil');
      if (error) throw error;
      return (data ?? []) as LeadAtual[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Leads fechados (gold.leads_closed) do vendedor logado, com pipeline/status
 *  atuais (do bronze). Filtragem feita no banco via SECURITY DEFINER. */
export function useMeusLeadsFechados() {
  return useQuery<MeuLeadFechado[]>({
    queryKey: ['meus_leads_fechados'],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema('gold')
        .rpc('get_meus_leads_fechados');
      if (error) throw error;
      return (data ?? []) as MeuLeadFechado[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
