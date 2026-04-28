import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, LabelList, CartesianGrid,
} from 'recharts';
import { Loader2, Info } from 'lucide-react';
import { useLeadsOrigem } from '../hooks/useClosedLeads';
import {
  LeadClosedOrigem, CaminhoOrigem, CAMINHO_COLORS, CAMINHO_DESCRIPTIONS,
  ClosedFilters, normalizeCanal,
} from '../types';

interface Props {
  filters: ClosedFilters;
}

const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: 'hsl(240, 10%, 10%)', border: 'none', borderRadius: 8 },
  itemStyle: { color: '#fff' },
};

function formatCurrency(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

/** Ticket médio do projeto = receita / total de diárias (NÃO receita / qtd de leads).
 *  Veja docs/business-rules.md e CLAUDE.md. */
function diariasOf(l: LeadClosedOrigem): number {
  const n = parseInt(l.n_diarias || '0', 10);
  return isNaN(n) ? 0 : n;
}

const CAMINHOS_ORDER: CaminhoOrigem[] = ['Direto', 'Reativada', 'Resgate', 'Recorrente'];

export function OrigemBlock({ filters }: Props) {
  const { data: leadsRaw = [], isLoading } = useLeadsOrigem();

  // Mesma lógica de filtro do useFilteredClosed, adaptada pro tipo enriquecido
  const leads = useMemo(() => {
    return leadsRaw.filter((l) => {
      if (filters.vendedores.length > 0 && !filters.vendedores.includes(l.vendedor || '')) return false;
      if (filters.astronomos.length > 0 && !filters.astronomos.includes(l.astronomo || '')) return false;
      if (filters.cancelado === 'sim' && !l.cancelado) return false;
      if (filters.cancelado === 'nao' && l.cancelado) return false;
      const refDateStr = l.cancelado ? l.data_cancelamento_fmt : l.data_fechamento_fmt;
      if (!refDateStr) return false;
      const ref = refDateStr.slice(0, 10);
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
  }, [leadsRaw, filters]);

  const stats = useMemo(() => {
    const ativos = leads;
    const total = ativos.length;
    const receita = ativos.reduce((s, l) => s + (l.lead_price || 0), 0);
    const totalDiarias = ativos.reduce((s, l) => s + diariasOf(l), 0);
    const ticketMedio = totalDiarias > 0 ? receita / totalDiarias : 0;
    // KPI geral usa o tempo bruto: criação → fechamento (mesmo cálculo pra todos
    // os caminhos, comparável). Os cards por caminho usam o tempo "canônico"
    // (tempo_dias_caminho), que difere apenas pra Recorrente.
    const temposValidos = ativos.filter((l) => l.tempo_dias_total != null);
    const tempoMedio = temposValidos.length > 0
      ? temposValidos.reduce((s, l) => s + (l.tempo_dias_total ?? 0), 0) / temposValidos.length
      : 0;
    return { total, totalDiarias, receita, ticketMedio, tempoMedio };
  }, [leads]);

  const porCaminho = useMemo(() => {
    const ativos = leads;
    return CAMINHOS_ORDER.map((caminho) => {
      const items = ativos.filter((l) => l.caminho_origem === caminho);
      const qtd = items.length;
      const receita = items.reduce((s, l) => s + (l.lead_price || 0), 0);
      const diarias = items.reduce((s, l) => s + diariasOf(l), 0);
      const ticket = diarias > 0 ? receita / diarias : 0;
      const tempos = items.filter((l) => l.tempo_dias_caminho != null);
      const tempoMedio = tempos.length > 0
        ? tempos.reduce((s, l) => s + (l.tempo_dias_caminho ?? 0), 0) / tempos.length
        : 0;
      return { caminho, qtd, receita, diarias, ticket, tempoMedio };
    });
  }, [leads]);

  const porCanal = useMemo(() => {
    const ativos = leads;
    const map = new Map<string, { canal: string; qtd: number; receita: number; diarias: number }>();
    for (const l of ativos) {
      const canal = normalizeCanal(l.canal_entrada);
      if (!map.has(canal)) map.set(canal, { canal, qtd: 0, receita: 0, diarias: 0 });
      const r = map.get(canal)!;
      r.qtd++;
      r.receita += l.lead_price || 0;
      r.diarias += diariasOf(l);
    }
    return Array.from(map.values())
      .map((r) => ({ ...r, ticket: r.diarias > 0 ? r.receita / r.diarias : 0 }))
      .sort((a, b) => b.qtd - a.qtd);
  }, [leads]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="animate-spin mr-2" size={18} /> Carregando análise de origem…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs gerais */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="card-glass p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Total Fechados</p>
          <p className="text-3xl font-bold text-foreground">{stats.total.toLocaleString('pt-BR')}</p>
        </div>
        <div className="card-glass p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Total de Diárias</p>
          <p className="text-3xl font-bold text-foreground">{stats.totalDiarias.toLocaleString('pt-BR')}</p>
        </div>
        <div className="card-glass p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Receita</p>
          <p className="text-3xl font-bold text-foreground">{formatCurrency(stats.receita)}</p>
        </div>
        <div className="card-glass p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground" title="Receita / total de diárias">Ticket Médio</p>
          <p className="text-3xl font-bold text-foreground">{formatCurrency(stats.ticketMedio)}</p>
        </div>
        <div className="card-glass p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Tempo Médio</p>
          <p className="text-3xl font-bold text-foreground">{stats.tempoMedio.toFixed(1)} <span className="text-lg font-normal text-muted-foreground">dias</span></p>
          <p className="text-[10px] text-muted-foreground/70 mt-1">Da criação do lead ao fechamento</p>
        </div>
      </div>

      {/* Caminho no CRM */}
      <section>
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-foreground">Caminho no CRM</h2>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <Info size={12} />
            Hierarquia de classificação por ocorrência: Recorrente &gt; Reativada &gt; Resgate &gt; Direto. O tempo médio de cada caminho usa o marco temporal correto (não a data de criação para recorrentes).
          </p>
        </div>

        {/* Cards por caminho */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {porCaminho.map((c) => (
            <div
              key={c.caminho}
              className="card-glass p-4 rounded-xl border-l-4"
              style={{ borderLeftColor: CAMINHO_COLORS[c.caminho] }}
            >
              <p className="text-xs uppercase font-semibold tracking-wide" style={{ color: CAMINHO_COLORS[c.caminho] }}>
                {c.caminho}
              </p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {c.qtd}
                <span className="text-xs font-normal text-muted-foreground ml-1">leads · {c.diarias} diárias</span>
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Ticket {formatCurrency(c.ticket)}<br/>
                {c.tempoMedio.toFixed(1)} dias médios
              </p>
              <p className="text-[10px] text-muted-foreground/70 mt-2 leading-tight">
                {CAMINHO_DESCRIPTIONS[c.caminho]}
              </p>
            </div>
          ))}
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card-glass p-4 rounded-xl">
            <p className="text-sm font-semibold mb-3 text-foreground">Quantidade por caminho</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={porCaminho} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="caminho" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="qtd">
                  <LabelList dataKey="qtd" position="top" fill="hsl(var(--foreground))" fontSize={11} />
                  {porCaminho.map((d) => (
                    <Cell key={d.caminho} fill={CAMINHO_COLORS[d.caminho]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card-glass p-4 rounded-xl">
            <p className="text-sm font-semibold mb-3 text-foreground">Tempo médio até fechar (dias)</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={porCaminho} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="caminho" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  {...TOOLTIP_STYLE}
                  formatter={(v: any) => [`${Number(v).toFixed(1)} dias`, 'Tempo médio']}
                />
                <Bar dataKey="tempoMedio">
                  <LabelList
                    dataKey="tempoMedio"
                    position="top"
                    fill="hsl(var(--foreground))"
                    fontSize={11}
                    formatter={(v: any) => `${Number(v).toFixed(1)}d`}
                  />
                  {porCaminho.map((d) => (
                    <Cell key={d.caminho} fill={CAMINHO_COLORS[d.caminho]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Canal de entrada */}
      <section>
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-foreground">Canal de entrada</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Origem direta dos leads conforme custom field "Canal de entrada" do Kommo (independente do caminho percorrido depois).
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card-glass p-4 rounded-xl">
            <p className="text-sm font-semibold mb-3 text-foreground">Quantidade por canal</p>
            <ResponsiveContainer width="100%" height={Math.max(280, porCanal.length * 28)}>
              <BarChart data={porCanal} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="canal" tick={{ fontSize: 11 }} width={140} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="qtd" fill="#3b82f6">
                  <LabelList dataKey="qtd" position="right" fill="hsl(var(--foreground))" fontSize={11} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card-glass p-4 rounded-xl">
            <p className="text-sm font-semibold mb-3 text-foreground">Tabela detalhada</p>
            <div className="overflow-x-auto max-h-[420px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card border-b">
                  <tr>
                    <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Canal</th>
                    <th className="text-right py-2 px-2 text-xs font-semibold text-muted-foreground">Leads</th>
                    <th className="text-right py-2 px-2 text-xs font-semibold text-muted-foreground">Diárias</th>
                    <th className="text-right py-2 px-2 text-xs font-semibold text-muted-foreground" title="Receita / diárias">Ticket</th>
                    <th className="text-right py-2 px-2 text-xs font-semibold text-muted-foreground">Receita</th>
                  </tr>
                </thead>
                <tbody>
                  {porCanal.map((c) => (
                    <tr key={c.canal} className="border-b border-border/40 hover:bg-accent/40">
                      <td className="py-1.5 px-2 truncate max-w-[200px]">{c.canal}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">{c.qtd}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">{c.diarias}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">{formatCurrency(c.ticket)}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">{formatCurrency(c.receita)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Cruzamento Canal × Caminho */}
      <section>
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-foreground">Canal × Caminho</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Quantos fechamentos por canal de entrada × caminho no CRM.
          </p>
        </div>
        <CrossTable leads={leads.filter((l) => !l.cancelado)} />
      </section>
    </div>
  );
}

function CrossTable({ leads }: { leads: LeadClosedOrigem[] }) {
  const matrix = useMemo(() => {
    const counts = new Map<string, Record<CaminhoOrigem, number> & { canal: string; total: number }>();
    for (const l of leads) {
      const canal = normalizeCanal(l.canal_entrada);
      if (!counts.has(canal)) {
        counts.set(canal, {
          canal,
          Direto: 0, Reativada: 0, Resgate: 0, Recorrente: 0,
          total: 0,
        });
      }
      const row = counts.get(canal)!;
      row[l.caminho_origem]++;
      row.total++;
    }
    return Array.from(counts.values()).sort((a, b) => b.total - a.total);
  }, [leads]);

  if (matrix.length === 0) {
    return (
      <div className="card-glass p-8 rounded-xl text-center text-sm text-muted-foreground">
        Sem dados no período.
      </div>
    );
  }

  return (
    <div className="card-glass p-4 rounded-xl overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Canal</th>
            {CAMINHOS_ORDER.map((c) => (
              <th
                key={c}
                className="text-right py-2 px-2 text-xs font-semibold"
                style={{ color: CAMINHO_COLORS[c] }}
              >
                {c}
              </th>
            ))}
            <th className="text-right py-2 px-2 text-xs font-semibold text-muted-foreground">Total</th>
          </tr>
        </thead>
        <tbody>
          {matrix.map((row) => (
            <tr key={row.canal} className="border-b border-border/40 hover:bg-accent/40">
              <td className="py-1.5 px-2 truncate max-w-[200px]">{row.canal}</td>
              {CAMINHOS_ORDER.map((c) => (
                <td key={c} className="py-1.5 px-2 text-right tabular-nums">
                  {row[c] > 0 ? row[c] : <span className="text-muted-foreground/40">—</span>}
                </td>
              ))}
              <td className="py-1.5 px-2 text-right tabular-nums font-semibold">{row.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
