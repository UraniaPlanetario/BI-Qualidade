import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList, CartesianGrid,
} from 'recharts';
import { Loader2, ExternalLink } from 'lucide-react';
import { useMeusLeadsFunil } from '../hooks/useMeuVendedor';
import {
  ETAPAS_FUNIL, STATUS_CLOSED_WON, STATUS_CLOSED_LOST, kommoLeadUrl,
} from '@/areas/comercial/auditoria-funil-vendas/types';
import type { LeadAtual } from '@/areas/comercial/auditoria-funil-vendas/hooks/useFunilWhatsapp';

interface Props {
  kommoUserId: number;
}

const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: 'hsl(240, 10%, 10%)', border: 'none', borderRadius: 8 },
  itemStyle: { color: '#fff' },
};

const PALETTE = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
  '#06b6d4', '#a855f7', '#ef4444', '#84cc16', '#f97316',
  '#14b8a6', '#0ea5e9', '#d946ef', '#22c55e', '#eab308',
  '#6366f1', '#facc15', '#94a3b8', '#dc2626', '#65a30d',
];

function fmtDays(d: number | null | undefined): string {
  if (d == null) return '—';
  return d < 1 ? '<1d' : `${Math.floor(d)}d`;
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  });
}

export function AuditoriaBlock({ kommoUserId: _k }: Props) {
  const { data: leads = [], isLoading } = useMeusLeadsFunil();

  // Só leads ativos (exclui Closed-won/lost)
  const ativos = useMemo<LeadAtual[]>(() => {
    return leads.filter((l) => l.status_id !== STATUS_CLOSED_WON && l.status_id !== STATUS_CLOSED_LOST);
  }, [leads]);

  const tarefasVencidas = useMemo(
    () => ativos.filter((l) => (l.dias_tarefa_vencida ?? 0) > 0),
    [ativos],
  );
  const semTarefa = useMemo(
    () => ativos.filter((l) => l.tarefa_id == null),
    [ativos],
  );

  // Distribuição por etapa do funil (ordem do funil)
  const porEtapa = useMemo(() => {
    const counts = new Map<number, number>();
    for (const l of ativos) counts.set(l.status_id, (counts.get(l.status_id) ?? 0) + 1);
    return ETAPAS_FUNIL
      .filter((e) => e.status_id !== STATUS_CLOSED_WON && e.status_id !== STATUS_CLOSED_LOST)
      .map((e) => ({ etapa: e.status_name, qtd: counts.get(e.status_id) ?? 0 }))
      .filter((r) => r.qtd > 0);
  }, [ativos]);

  // Tabelas (ordem desc pelo critério de cada uma)
  const tabelaVencidas = useMemo(
    () => [...tarefasVencidas].sort((a, b) => (b.dias_tarefa_vencida ?? 0) - (a.dias_tarefa_vencida ?? 0)),
    [tarefasVencidas],
  );
  const tabelaSemTarefa = useMemo(
    () => [...semTarefa]
      .filter((l) => (l.dias_sem_tarefa ?? 0) > 0)
      .sort((a, b) => (b.dias_sem_tarefa ?? 0) - (a.dias_sem_tarefa ?? 0)),
    [semTarefa],
  );
  const tabelaSemInteracao = useMemo(
    () => [...ativos]
      .filter((l) => l.ultima_msg_enviada_at != null)
      .sort((a, b) => (b.dias_sem_interacao ?? 0) - (a.dias_sem_interacao ?? 0)),
    [ativos],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="animate-spin mr-2" size={18} /> Carregando seus leads no funil...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          Seus leads ativos no pipeline <strong>Vendas WhatsApp</strong> (cruzamento por <code className="text-xs">responsible_user_id</code>).
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="card-glass p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Leads ativos no funil</p>
          <p className="text-3xl font-bold text-foreground">{ativos.length.toLocaleString('pt-BR')}</p>
          <p className="text-[10px] text-muted-foreground/70 mt-1">Onde você é responsável</p>
        </div>
        <div className="card-glass p-4 rounded-xl text-center border border-rose-500/30">
          <p className="text-sm text-muted-foreground">Tarefas vencidas</p>
          <p className="text-3xl font-bold text-rose-500">{tarefasVencidas.length.toLocaleString('pt-BR')}</p>
        </div>
        <div className="card-glass p-4 rounded-xl text-center border border-amber-500/30">
          <p className="text-sm text-muted-foreground">Leads sem tarefa</p>
          <p className="text-3xl font-bold text-amber-500">{semTarefa.length.toLocaleString('pt-BR')}</p>
        </div>
      </div>

      {/* Gráfico por etapa */}
      <div className="card-glass p-4 rounded-xl">
        <p className="text-sm font-semibold mb-3">Seus leads por etapa do funil</p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={porEtapa} margin={{ bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="etapa" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} height={60} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Bar dataKey="qtd">
              <LabelList dataKey="qtd" position="top" fill="hsl(var(--foreground))" fontSize={11} />
              {porEtapa.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {porEtapa.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-6">
            Você não tem leads ativos no Vendas WhatsApp neste momento.
          </p>
        )}
      </div>

      {/* Tabela: Tarefas vencidas */}
      <div className="card-glass rounded-xl overflow-hidden">
        <div className="px-4 pt-4 pb-2">
          <p className="text-sm font-semibold">Tarefas vencidas — mais antigas primeiro</p>
        </div>
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card border-b z-10">
              <tr>
                <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Lead</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Etapa atual</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Prazo</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Vencida há</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {tabelaVencidas.map((l) => (
                <tr key={l.lead_id} className="border-b border-border/40 hover:bg-accent/40">
                  <td className="py-1.5 px-3 truncate max-w-[260px]" title={l.lead_name ?? ''}>
                    {l.lead_name ?? `Lead #${l.lead_id}`}
                  </td>
                  <td className="py-1.5 px-3 text-muted-foreground">{l.status_name ?? '—'}</td>
                  <td className="py-1.5 px-3 text-muted-foreground tabular-nums">
                    {fmtDateTime(l.tarefa_complete_till)}
                  </td>
                  <td className="py-1.5 px-3 text-right tabular-nums font-medium text-rose-500">
                    {fmtDays(l.dias_tarefa_vencida)}
                  </td>
                  <td className="py-1.5 px-3 text-right">
                    <a href={kommoLeadUrl(l.lead_id)!} target="_blank" rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1" title="Abrir no Kommo">
                      <ExternalLink size={12} />
                    </a>
                  </td>
                </tr>
              ))}
              {tabelaVencidas.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Nenhuma tarefa vencida. ✅</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabela: Leads sem tarefa */}
      <div className="card-glass rounded-xl overflow-hidden">
        <div className="px-4 pt-4 pb-2">
          <p className="text-sm font-semibold">Leads sem tarefa — mais esquecidos primeiro</p>
          <p className="text-xs text-muted-foreground mt-1">
            "Sem tarefa há" usa <code className="text-xs">lead.updated_at</code> como proxy.
          </p>
        </div>
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card border-b z-10">
              <tr>
                <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Lead</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Etapa atual</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Sem tarefa há</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {tabelaSemTarefa.map((l) => (
                <tr key={l.lead_id} className="border-b border-border/40 hover:bg-accent/40">
                  <td className="py-1.5 px-3 truncate max-w-[260px]" title={l.lead_name ?? ''}>
                    {l.lead_name ?? `Lead #${l.lead_id}`}
                  </td>
                  <td className="py-1.5 px-3 text-muted-foreground">{l.status_name ?? '—'}</td>
                  <td className="py-1.5 px-3 text-right tabular-nums font-medium text-amber-500">
                    {fmtDays(l.dias_sem_tarefa)}
                  </td>
                  <td className="py-1.5 px-3 text-right">
                    <a href={kommoLeadUrl(l.lead_id)!} target="_blank" rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1" title="Abrir no Kommo">
                      <ExternalLink size={12} />
                    </a>
                  </td>
                </tr>
              ))}
              {tabelaSemTarefa.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">Nenhum lead sem tarefa. ✅</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabela: Tempo sem interação */}
      <div className="card-glass rounded-xl overflow-hidden">
        <div className="px-4 pt-4 pb-2">
          <p className="text-sm font-semibold">Tempo sem interação — mais antigos primeiro</p>
          <p className="text-xs text-muted-foreground mt-1">
            Última mensagem ENVIADA pra cada lead (qualquer remetente, bot ou humano).
          </p>
        </div>
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card border-b z-10">
              <tr>
                <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Lead</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Última msg enviada</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Etapa</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Sem interação há</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {tabelaSemInteracao.map((l) => (
                <tr key={l.lead_id} className="border-b border-border/40 hover:bg-accent/40">
                  <td className="py-1.5 px-3 truncate max-w-[240px]" title={l.lead_name ?? ''}>
                    {l.lead_name ?? `Lead #${l.lead_id}`}
                  </td>
                  <td className="py-1.5 px-3 text-muted-foreground tabular-nums">{fmtDateTime(l.ultima_msg_enviada_at)}</td>
                  <td className="py-1.5 px-3 text-muted-foreground">{l.status_name ?? '—'}</td>
                  <td className="py-1.5 px-3 text-right tabular-nums font-medium text-rose-500">
                    {fmtDays(l.dias_sem_interacao)}
                  </td>
                  <td className="py-1.5 px-3 text-right">
                    <a href={kommoLeadUrl(l.lead_id)!} target="_blank" rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1" title="Abrir no Kommo">
                      <ExternalLink size={12} />
                    </a>
                  </td>
                </tr>
              ))}
              {tabelaSemInteracao.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Sem dados de mensagens.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
