import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList, CartesianGrid, Legend,
} from 'recharts';
import { Loader2, ExternalLink } from 'lucide-react';
import { useLeadsAtuaisFunil, useEntradasHoje, type LeadAtual } from '../hooks/useFunilWhatsapp';
import {
  ETAPAS_FUNIL, STATUS_CLOSED_WON, STATUS_CLOSED_LOST,
  kommoLeadUrl, type Filtros,
} from '../types';

interface Props {
  filtros: Filtros;
}

const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: 'hsl(240, 10%, 10%)', border: 'none', borderRadius: 8 },
  itemStyle: { color: '#fff' },
};

function fmtDays(d: number | null | undefined): string {
  if (d == null) return '—';
  return d < 1 ? '<1d' : `${Math.floor(d)}d`;
}

export function HojeBlock({ filtros }: Props) {
  const { data: leads = [], isLoading } = useLeadsAtuaisFunil();
  const { data: entradasHoje } = useEntradasHoje();

  /** Leads ativos (excluindo Closed-won/Closed-lost), com filtros aplicados.
   *  Aba Hoje sempre exclui leads em Closed-lost — são "venda perdida", não
   *  estão ativos no funil. Closed-won na prática nunca aparece (vai pra
   *  Onboarding), mas excluímos por garantia. */
  const ativos = useMemo<LeadAtual[]>(() => {
    return leads.filter((l) => {
      if (l.status_id === STATUS_CLOSED_WON || l.status_id === STATUS_CLOSED_LOST) return false;
      if (filtros.etapas.length > 0 && !filtros.etapas.includes(l.status_id)) return false;
      if (filtros.responsaveis.length > 0 && !filtros.responsaveis.includes(l.responsible_user_name ?? '')) return false;
      return true;
    });
  }, [leads, filtros]);

  // Ranking por responsável (todos, ordenado desc)
  const porResponsavel = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of ativos) {
      const r = l.responsible_user_name ?? '(sem responsável)';
      map.set(r, (map.get(r) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([responsavel, qtd]) => ({ responsavel, qtd }))
      .sort((a, b) => b.qtd - a.qtd);
  }, [ativos]);

  // Por etapa do funil (ordem do funil)
  const porEtapa = useMemo(() => {
    const counts = new Map<number, number>();
    for (const l of ativos) counts.set(l.status_id, (counts.get(l.status_id) ?? 0) + 1);
    return ETAPAS_FUNIL
      .filter((e) => e.status_id !== STATUS_CLOSED_WON && e.status_id !== STATUS_CLOSED_LOST)
      .map((e) => ({ etapa: e.status_name, qtd: counts.get(e.status_id) ?? 0 }))
      .filter((r) => r.qtd > 0);
  }, [ativos]);

  // Por etapa × responsável (top 8 responsáveis × etapas com leads)
  const porEtapaResponsavel = useMemo(() => {
    const topResp = porResponsavel.slice(0, 8).map((r) => r.responsavel);
    const respSet = new Set(topResp);
    const matrix = new Map<string, Record<string, number>>();
    for (const l of ativos) {
      const etapaName = ETAPAS_FUNIL.find((e) => e.status_id === l.status_id)?.status_name ?? '?';
      const resp = l.responsible_user_name ?? '(sem)';
      const key = respSet.has(resp) ? resp : 'Outros';
      const row = matrix.get(etapaName) ?? {};
      row[key] = (row[key] ?? 0) + 1;
      matrix.set(etapaName, row);
    }
    const responsaveis = [...topResp, 'Outros'];
    const data = ETAPAS_FUNIL
      .filter((e) => e.status_id !== STATUS_CLOSED_WON && e.status_id !== STATUS_CLOSED_LOST)
      .map((e) => {
        const row = matrix.get(e.status_name);
        if (!row) return null;
        return { etapa: e.status_name, ...row };
      })
      .filter(Boolean) as Array<{ etapa: string; [resp: string]: number | string }>;
    return { data, responsaveis };
  }, [ativos, porResponsavel]);

  // Tabela tempo total no funil (top 50 mais antigos)
  const tabelaTempo = useMemo(() => {
    return [...ativos].sort((a, b) => b.dias_no_funil - a.dias_no_funil).slice(0, 50);
  }, [ativos]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="animate-spin mr-2" size={18} /> Carregando snapshot do funil...
      </div>
    );
  }

  const palette = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#a855f7', '#ef4444', '#6b7280'];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card-glass p-4 rounded-xl">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Criados hoje</p>
          <p className="text-3xl font-bold mt-1">{entradasHoje?.criados ?? '—'}</p>
          <p className="text-[10px] text-muted-foreground/70 mt-1">Criação direta + entrada vinda de outro pipeline</p>
        </div>
        <div className="card-glass p-4 rounded-xl">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Perdidos hoje</p>
          <p className="text-3xl font-bold mt-1 text-rose-500">{entradasHoje?.perdidos ?? '—'}</p>
          <p className="text-[10px] text-muted-foreground/70 mt-1">Movidos pra Closed - lost</p>
        </div>
        <div className="card-glass p-4 rounded-xl">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Ativos no funil</p>
          <p className="text-3xl font-bold mt-1 text-primary">{ativos.length.toLocaleString('pt-BR')}</p>
          <p className="text-[10px] text-muted-foreground/70 mt-1">Filtros aplicados, exclui won/lost</p>
        </div>
        <div className="card-glass p-4 rounded-xl">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Responsáveis distintos</p>
          <p className="text-3xl font-bold mt-1">{porResponsavel.length}</p>
          <p className="text-[10px] text-muted-foreground/70 mt-1">Com pelo menos 1 lead ativo</p>
        </div>
      </div>

      {/* Leads por responsável */}
      <div className="card-glass p-4 rounded-xl">
        <p className="text-sm font-semibold mb-3">Leads ativos por responsável</p>
        <ResponsiveContainer width="100%" height={Math.max(280, porResponsavel.length * 26)}>
          <BarChart data={porResponsavel} layout="vertical" margin={{ left: 100, right: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="responsavel" tick={{ fontSize: 11 }} width={140} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Bar dataKey="qtd" fill="#3b82f6">
              <LabelList dataKey="qtd" position="right" fill="hsl(var(--foreground))" fontSize={11} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Leads por etapa */}
      <div className="card-glass p-4 rounded-xl">
        <p className="text-sm font-semibold mb-3">Leads ativos por etapa do funil</p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={porEtapa} margin={{ bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="etapa" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} height={60} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Bar dataKey="qtd">
              <LabelList dataKey="qtd" position="top" fill="hsl(var(--foreground))" fontSize={11} />
              {porEtapa.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Etapa × Responsável (empilhado, top 8 + Outros) */}
      <div className="card-glass p-4 rounded-xl">
        <p className="text-sm font-semibold mb-1">Leads por etapa × responsável</p>
        <p className="text-xs text-muted-foreground mb-3">
          Top 8 responsáveis com mais leads ativos; o resto agrupado em "Outros".
        </p>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={porEtapaResponsavel.data} margin={{ bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="etapa" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} height={60} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {porEtapaResponsavel.responsaveis.map((resp, i) => (
              <Bar key={resp} dataKey={resp} stackId="a" fill={palette[i % palette.length]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tabela: tempo total no funil */}
      <div className="card-glass rounded-xl overflow-hidden">
        <div className="px-4 pt-4 pb-2">
          <p className="text-sm font-semibold">Tempo total no funil — top 50 mais antigos</p>
          <p className="text-xs text-muted-foreground mt-1">
            Leads ativos ordenados pelo tempo desde que entraram no Vendas WhatsApp. Útil pra identificar leads esquecidos.
          </p>
        </div>
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card border-b z-10">
              <tr>
                <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Lead</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Responsável</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Etapa atual</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">No funil</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Na etapa</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {tabelaTempo.map((l) => (
                <tr key={l.lead_id} className="border-b border-border/40 hover:bg-accent/40">
                  <td className="py-1.5 px-3 truncate max-w-[260px]" title={l.lead_name ?? ''}>
                    {l.lead_name ?? `Lead #${l.lead_id}`}
                  </td>
                  <td className="py-1.5 px-3 text-muted-foreground">{l.responsible_user_name ?? '—'}</td>
                  <td className="py-1.5 px-3 text-muted-foreground">{l.status_name ?? '—'}</td>
                  <td className="py-1.5 px-3 text-right tabular-nums font-medium">{fmtDays(l.dias_no_funil)}</td>
                  <td className="py-1.5 px-3 text-right tabular-nums text-muted-foreground">{fmtDays(l.dias_na_etapa_atual)}</td>
                  <td className="py-1.5 px-3 text-right">
                    <a
                      href={kommoLeadUrl(l.lead_id) ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                      title="Abrir no Kommo"
                    >
                      <ExternalLink size={12} />
                    </a>
                  </td>
                </tr>
              ))}
              {tabelaTempo.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    Nenhum lead ativo no recorte atual.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
