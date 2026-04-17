import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { LeadClosed, parseTimestamp } from '../types';

const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: 'hsl(240, 10%, 10%)', border: 'none', borderRadius: 8 },
  itemStyle: { color: '#fff' },
};

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function OverviewBlock({ leads }: { leads: LeadClosed[] }) {
  const stats = useMemo(() => {
    const total = leads.length;
    const receita = leads.reduce((s, l) => s + (l.lead_price || 0), 0);
    const ticketMedio = total > 0 ? receita / total : 0;
    const cancelados = leads.filter((l) => l.cancelado).length;
    const canceladosPct = total > 0 ? ((cancelados / total) * 100).toFixed(1) : '0.0';
    return { total, receita, ticketMedio, cancelados, canceladosPct };
  }, [leads]);

  const byMonth = useMemo(() => {
    const map: Record<string, number> = {};
    for (const l of leads) {
      const d = l.data_fechamento_fmt ? new Date(l.data_fechamento_fmt) : new Date(l.entrada_onboarding_at);
      if (isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
      map[key] = (map[key] || 0) + 1;
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => {
        const [year, month] = key.split('-');
        const label = `${MONTH_LABELS[Number(month)]}/${year.slice(2)}`;
        return { name: label, value };
      });
  }, [leads]);

  const byTipoCliente = useMemo(() => {
    const map: Record<string, number> = {};
    for (const l of leads) {
      const key = l.tipo_cliente || 'Não informado';
      map[key] = (map[key] || 0) + 1;
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [leads]);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card-glass p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Total Fechados</p>
          <p className="text-3xl font-bold text-foreground">{stats.total.toLocaleString('pt-BR')}</p>
        </div>
        <div className="card-glass p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Receita Total</p>
          <p className="text-xl font-bold text-foreground">{formatCurrency(stats.receita)}</p>
        </div>
        <div className="card-glass p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Ticket Médio</p>
          <p className="text-xl font-bold text-foreground">{formatCurrency(stats.ticketMedio)}</p>
        </div>
        <div className="card-glass p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Cancelados</p>
          <p className="text-3xl font-bold text-foreground">{stats.cancelados}</p>
          <p className="text-xs text-muted-foreground">{stats.canceladosPct}% do total</p>
        </div>
      </div>

      {/* Fechamentos por Mês */}
      <div className="card-glass p-4 rounded-xl">
        <h3 className="text-base font-semibold text-foreground mb-4">Fechamentos por Mês</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={byMonth} margin={{ left: 10, right: 10, top: 20 }}>
            <XAxis dataKey="name" stroke="hsl(240, 5%, 65%)" tick={{ fill: 'hsl(240, 5%, 65%)', fontSize: 12 }} />
            <YAxis stroke="hsl(240, 5%, 65%)" tick={{ fill: 'hsl(240, 5%, 65%)', fontSize: 12 }} />
            <Tooltip {...TOOLTIP_STYLE} formatter={(value: number) => [value.toLocaleString('pt-BR'), 'Fechamentos']} />
            <Bar dataKey="value" fill="hsl(263, 70%, 58%)" radius={[4, 4, 0, 0]}>
              <LabelList dataKey="value" position="top" fill="hsl(240, 5%, 65%)" fontSize={11} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Por Tipo de Cliente */}
      <div className="card-glass p-4 rounded-xl">
        <h3 className="text-base font-semibold text-foreground mb-4">Por Tipo de Cliente</h3>
        <ResponsiveContainer width="100%" height={Math.max(200, byTipoCliente.length * 40)}>
          <BarChart data={byTipoCliente} layout="vertical" margin={{ left: 140 }}>
            <XAxis type="number" stroke="hsl(240, 5%, 65%)" tick={{ fill: 'hsl(240, 5%, 65%)', fontSize: 12 }} />
            <YAxis type="category" dataKey="name" stroke="hsl(240, 5%, 65%)" width={135} tick={{ fill: 'hsl(240, 5%, 65%)', fontSize: 12 }} />
            <Tooltip {...TOOLTIP_STYLE} formatter={(value: number) => [value.toLocaleString('pt-BR'), 'Leads']} />
            <Bar dataKey="value" fill="hsl(45, 80%, 55%)" radius={[0, 4, 4, 0]}>
              <LabelList dataKey="value" position="right" fill="hsl(240, 5%, 65%)" fontSize={11} fontWeight={600} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
