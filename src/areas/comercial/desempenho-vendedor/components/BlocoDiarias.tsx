import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, Legend } from 'recharts';
import { LeadVendedor, formatNumber } from '../types';
import { filterLeadsFechados } from './BlocoFechamentos';

const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: 'hsl(240, 10%, 10%)', border: 'none', borderRadius: 8 },
  itemStyle: { color: '#fff' },
};

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const COLORS = [
  'hsl(263, 70%, 58%)',
  'hsl(270, 50%, 70%)',
  'hsl(45, 80%, 55%)',
  'hsl(142, 60%, 50%)',
  'hsl(0, 72%, 51%)',
  'hsl(200, 70%, 55%)',
  'hsl(330, 65%, 60%)',
  'hsl(30, 80%, 55%)',
];

function parseDiarias(v: string | null): number {
  if (!v) return 0;
  const n = parseInt(v, 10);
  return isNaN(n) ? 0 : n;
}

export function BlocoDiarias({ leads }: { leads: LeadVendedor[] }) {
  const valid = useMemo(() => filterLeadsFechados(leads), [leads]);

  const totalDiarias = useMemo(() => valid.reduce((s, l) => s + parseDiarias(l.numero_de_diarias), 0), [valid]);
  const totalLeads = valid.length;
  const mediaPorLead = totalLeads > 0 ? totalDiarias / totalLeads : 0;

  const vendedoresOrdenados = useMemo(() => {
    const map: Record<string, { diarias: number; leads: number }> = {};
    for (const l of valid) {
      const v = l.vendedor || 'Não atribuído';
      if (!map[v]) map[v] = { diarias: 0, leads: 0 };
      map[v].diarias += parseDiarias(l.numero_de_diarias);
      map[v].leads += 1;
    }
    return Object.entries(map)
      .map(([name, v]) => ({
        name,
        diarias: v.diarias,
        leads: v.leads,
        media: v.leads > 0 ? v.diarias / v.leads : 0,
      }))
      .sort((a, b) => b.diarias - a.diarias);
  }, [valid]);

  const topVendedores = useMemo(() => vendedoresOrdenados.slice(0, 8).map((v) => v.name), [vendedoresOrdenados]);

  const monthlyData = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const l of valid) {
      const v = l.vendedor || 'Não atribuído';
      if (!topVendedores.includes(v)) continue;
      const d = l.data_de_fechamento ? new Date(l.data_de_fechamento) : null;
      if (!d || isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
      if (!map[key]) map[key] = {};
      map[key][v] = (map[key][v] || 0) + parseDiarias(l.numero_de_diarias);
    }
    const monthKeys = Object.keys(map).sort();
    return monthKeys.map((key) => {
      const [year, month] = key.split('-');
      const row: Record<string, number | string> = {
        name: `${MONTH_LABELS[Number(month)]}/${year.slice(2)}`,
      };
      for (const v of topVendedores) {
        row[v] = map[key][v] || 0;
      }
      return row;
    });
  }, [valid, topVendedores]);

  const totalByVendedor = useMemo(
    () => vendedoresOrdenados.map((v) => ({ name: v.name, value: v.diarias })),
    [vendedoresOrdenados]
  );

  const mediaByVendedor = useMemo(
    () =>
      [...vendedoresOrdenados]
        .sort((a, b) => b.media - a.media)
        .map((v) => ({ name: v.name, value: Number(v.media.toFixed(2)) })),
    [vendedoresOrdenados]
  );

  return (
    <div className="space-y-6">
      {/* 4.1 + 4.4 KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card-glass p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Total de Diárias</p>
          <p className="text-4xl font-bold text-foreground">{formatNumber(totalDiarias)}</p>
          <p className="text-xs text-muted-foreground mt-1">Diárias em leads fechados</p>
        </div>
        <div className="card-glass p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Média de Diárias por Lead</p>
          <p className="text-4xl font-bold text-foreground">{mediaPorLead.toFixed(2).replace('.', ',')}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatNumber(totalDiarias)} diárias / {formatNumber(totalLeads)} leads
          </p>
        </div>
      </div>

      {/* 4.2 Bar chart vertical mensal por vendedor */}
      <div className="card-glass p-4 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-foreground">Diárias Mensais por Vendedor</h3>
          <p className="text-xs text-muted-foreground">Top 8 vendedores</p>
        </div>
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={monthlyData} margin={{ left: 10, right: 10, top: 20 }}>
            <XAxis dataKey="name" stroke="hsl(240, 5%, 65%)" tick={{ fill: 'hsl(240, 5%, 65%)', fontSize: 12 }} />
            <YAxis stroke="hsl(240, 5%, 65%)" tick={{ fill: 'hsl(240, 5%, 65%)', fontSize: 12 }} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 12, color: 'hsl(240, 5%, 65%)' }} />
            {topVendedores.map((v, i) => (
              <Bar key={v} dataKey={v} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 4.3 Bar chart horizontal total diárias por vendedor */}
      <div className="card-glass p-4 rounded-xl">
        <h3 className="text-base font-semibold text-foreground mb-4">Total de Diárias por Vendedor</h3>
        <ResponsiveContainer width="100%" height={Math.max(250, totalByVendedor.length * 36)}>
          <BarChart data={totalByVendedor} layout="vertical" margin={{ left: 140, right: 50 }}>
            <XAxis type="number" stroke="hsl(240, 5%, 65%)" tick={{ fill: 'hsl(240, 5%, 65%)', fontSize: 12 }} />
            <YAxis type="category" dataKey="name" stroke="hsl(240, 5%, 65%)" width={135} tick={{ fill: 'hsl(240, 5%, 65%)', fontSize: 12 }} />
            <Tooltip {...TOOLTIP_STYLE} formatter={(value: number) => [formatNumber(value), 'Diárias']} />
            <Bar dataKey="value" fill="hsl(263, 70%, 58%)" radius={[0, 4, 4, 0]}>
              <LabelList dataKey="value" position="right" fill="hsl(240, 5%, 65%)" fontSize={11} fontWeight={600} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 4.5 Bar chart horizontal média de diárias por vendedor */}
      <div className="card-glass p-4 rounded-xl">
        <h3 className="text-base font-semibold text-foreground mb-4">Média de Diárias por Lead (por Vendedor)</h3>
        <ResponsiveContainer width="100%" height={Math.max(250, mediaByVendedor.length * 36)}>
          <BarChart data={mediaByVendedor} layout="vertical" margin={{ left: 140, right: 50 }}>
            <XAxis type="number" stroke="hsl(240, 5%, 65%)" tick={{ fill: 'hsl(240, 5%, 65%)', fontSize: 12 }} />
            <YAxis type="category" dataKey="name" stroke="hsl(240, 5%, 65%)" width={135} tick={{ fill: 'hsl(240, 5%, 65%)', fontSize: 12 }} />
            <Tooltip {...TOOLTIP_STYLE} formatter={(value: number) => [value.toFixed(2).replace('.', ','), 'Média']} />
            <Bar dataKey="value" fill="hsl(45, 80%, 55%)" radius={[0, 4, 4, 0]}>
              <LabelList dataKey="value" position="right" fill="hsl(240, 5%, 65%)" fontSize={11} fontWeight={600}
                formatter={(v: number) => v.toFixed(2).replace('.', ',')} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default BlocoDiarias;
