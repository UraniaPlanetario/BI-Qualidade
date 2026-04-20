import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { LeadVendedor, formatCurrency } from '../types';

const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: 'hsl(240, 10%, 10%)', border: 'none', borderRadius: 8 },
  itemStyle: { color: '#fff' },
};

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function formatCurrencyShort(value: number): string {
  if (value >= 1_000_000) {
    return 'R$ ' + (value / 1_000_000).toFixed(1).replace('.', ',') + 'M';
  }
  if (value >= 1_000) {
    return 'R$ ' + (value / 1_000).toFixed(1).replace('.', ',') + 'K';
  }
  return 'R$ ' + value.toFixed(0);
}

interface Props {
  leads: LeadVendedor[];
  dateFrom: Date | null;
  dateTo: Date | null;
}

function inRange(dateStr: string | null, from: Date | null, to: Date | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  if (from && d < from) return false;
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    if (d > end) return false;
  }
  return true;
}

export function BlocoFaturamento({ leads, dateFrom, dateTo }: Props) {
  // VIEW A — Valor Vendido: filter by data_de_fechamento
  const viewALeads = useMemo(() => {
    return leads.filter((l) =>
      l.vendedor != null &&
      l.data_de_fechamento != null &&
      inRange(l.data_de_fechamento, dateFrom, dateTo)
    );
  }, [leads, dateFrom, dateTo]);

  const viewATotal = useMemo(
    () => viewALeads.reduce((s, l) => s + (l.valor_total || 0), 0),
    [viewALeads]
  );

  const viewAByVendedor = useMemo(() => {
    const map: Record<string, number> = {};
    for (const l of viewALeads) {
      const v = l.vendedor || 'Não atribuído';
      map[v] = (map[v] || 0) + (l.valor_total || 0);
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [viewALeads]);

  // VIEW B — Faturamento Geral: filter by data_e_hora_do_agendamento
  const viewBLeads = useMemo(() => {
    return leads.filter((l) =>
      l.data_e_hora_do_agendamento != null &&
      inRange(l.data_e_hora_do_agendamento, dateFrom, dateTo)
    );
  }, [leads, dateFrom, dateTo]);

  const viewBTotal = useMemo(
    () => viewBLeads.reduce((s, l) => s + (l.valor_total || 0), 0),
    [viewBLeads]
  );

  const viewBByMonth = useMemo(() => {
    const map: Record<string, number> = {};
    for (const l of viewBLeads) {
      const d = l.data_e_hora_do_agendamento ? new Date(l.data_e_hora_do_agendamento) : null;
      if (!d || isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
      map[key] = (map[key] || 0) + (l.valor_total || 0);
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => {
        const [year, month] = key.split('-');
        return {
          name: `${MONTH_LABELS[Number(month)]}/${year.slice(2)}`,
          value,
        };
      });
  }, [viewBLeads]);

  return (
    <div className="space-y-8">
      {/* VIEW A */}
      <div>
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-foreground">Valor Vendido</h2>
          <p className="text-xs text-muted-foreground">
            Soma do <strong>valor_total</strong> de leads com <strong>data de fechamento</strong> no período selecionado.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="card-glass p-4 rounded-xl text-center">
            <p className="text-sm text-muted-foreground">Valor Vendido no Período</p>
            <p className="text-3xl font-bold text-foreground">{formatCurrency(viewATotal)}</p>
            <p className="text-xs text-muted-foreground mt-1">Filtro: data de fechamento</p>
          </div>
          <div className="card-glass p-4 rounded-xl text-center">
            <p className="text-sm text-muted-foreground">Leads Fechados</p>
            <p className="text-3xl font-bold text-foreground">{viewALeads.length.toLocaleString('pt-BR')}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Ticket médio: {viewALeads.length > 0 ? formatCurrency(viewATotal / viewALeads.length) : 'R$ 0,00'}
            </p>
          </div>
        </div>

        <div className="card-glass p-4 rounded-xl">
          <h3 className="text-base font-semibold text-foreground mb-4">Valor Vendido por Vendedor</h3>
          <ResponsiveContainer width="100%" height={Math.max(250, viewAByVendedor.length * 36)}>
            <BarChart data={viewAByVendedor} layout="vertical" margin={{ left: 140, right: 80 }}>
              <XAxis type="number" stroke="hsl(240, 5%, 65%)" tick={{ fill: 'hsl(240, 5%, 65%)', fontSize: 12 }}
                tickFormatter={formatCurrencyShort} />
              <YAxis type="category" dataKey="name" stroke="hsl(240, 5%, 65%)" width={135} tick={{ fill: 'hsl(240, 5%, 65%)', fontSize: 12 }} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(value: number) => [formatCurrency(value), 'Valor']} />
              <Bar dataKey="value" fill="hsl(142, 60%, 50%)" radius={[0, 4, 4, 0]}>
                <LabelList dataKey="value" position="right" fill="hsl(240, 5%, 65%)" fontSize={11} fontWeight={600}
                  formatter={(v: number) => formatCurrencyShort(v)} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* VIEW B */}
      <div>
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-foreground">Faturamento Geral</h2>
          <p className="text-xs text-muted-foreground">
            Soma do <strong>valor_total</strong> de leads com <strong>data do agendamento</strong> no período selecionado.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="card-glass p-4 rounded-xl text-center">
            <p className="text-sm text-muted-foreground">Faturamento no Período</p>
            <p className="text-3xl font-bold text-foreground">{formatCurrency(viewBTotal)}</p>
            <p className="text-xs text-muted-foreground mt-1">Filtro: data do agendamento</p>
          </div>
          <div className="card-glass p-4 rounded-xl text-center">
            <p className="text-sm text-muted-foreground">Leads com Agendamento</p>
            <p className="text-3xl font-bold text-foreground">{viewBLeads.length.toLocaleString('pt-BR')}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Ticket médio: {viewBLeads.length > 0 ? formatCurrency(viewBTotal / viewBLeads.length) : 'R$ 0,00'}
            </p>
          </div>
        </div>

        <div className="card-glass p-4 rounded-xl">
          <h3 className="text-base font-semibold text-foreground mb-4">Faturamento Mensal (por Agendamento)</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={viewBByMonth} margin={{ left: 10, right: 10, top: 20 }}>
              <XAxis dataKey="name" stroke="hsl(240, 5%, 65%)" tick={{ fill: 'hsl(240, 5%, 65%)', fontSize: 12 }} />
              <YAxis stroke="hsl(240, 5%, 65%)" tick={{ fill: 'hsl(240, 5%, 65%)', fontSize: 12 }}
                tickFormatter={formatCurrencyShort} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(value: number) => [formatCurrency(value), 'Faturamento']} />
              <Bar dataKey="value" fill="hsl(263, 70%, 58%)" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="value" position="top" fill="hsl(240, 5%, 65%)" fontSize={11}
                  formatter={(v: number) => formatCurrencyShort(v)} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default BlocoFaturamento;
