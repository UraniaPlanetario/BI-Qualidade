import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, Legend } from 'recharts';
import { LeadVendedor, formatNumber } from '../types';
import { FUNIS_FECHADOS } from '../hooks/useDesempenhoVendedor';

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

export function filterLeadsFechados(leads: LeadVendedor[]): LeadVendedor[] {
  const valid = leads.filter((l) =>
    l.funil_atual != null &&
    FUNIS_FECHADOS.includes(l.funil_atual) &&
    l.status_lead === 'Venda Fechada' &&
    l.nome_lead != null &&
    l.data_de_fechamento != null &&
    l.vendedor != null
  );
  // dedup by id_lead, keep most recent data_de_fechamento
  const map: Record<number, LeadVendedor> = {};
  for (const l of valid) {
    const current = map[l.id_lead];
    if (!current) {
      map[l.id_lead] = l;
    } else {
      const a = new Date(l.data_de_fechamento!).getTime();
      const b = new Date(current.data_de_fechamento!).getTime();
      if (a > b) map[l.id_lead] = l;
    }
  }
  return Object.values(map);
}

export function BlocoFechamentos({ leads }: { leads: LeadVendedor[] }) {
  const valid = useMemo(() => filterLeadsFechados(leads), [leads]);

  const total = valid.length;

  const vendedoresOrdenados = useMemo(() => {
    const map: Record<string, number> = {};
    for (const l of valid) {
      const v = l.vendedor || 'Não atribuído';
      map[v] = (map[v] || 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [valid]);

  const topVendedores = useMemo(() => vendedoresOrdenados.slice(0, 8).map((e) => e[0]), [vendedoresOrdenados]);

  const monthlyData = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const l of valid) {
      const v = l.vendedor || 'Não atribuído';
      if (!topVendedores.includes(v)) continue;
      const d = l.data_de_fechamento ? new Date(l.data_de_fechamento + 'T00:00:00') : null;
      if (!d || isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
      if (!map[key]) map[key] = {};
      map[key][v] = (map[key][v] || 0) + 1;
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

  const totalPorVendedor = useMemo(() => {
    return vendedoresOrdenados.map(([name, value]) => ({ name, value }));
  }, [vendedoresOrdenados]);

  return (
    <div className="space-y-6">
      {/* 3.1 KPI */}
      <p className="text-[11px] text-muted-foreground italic">
        Leads cancelados (<code className="font-mono text-[10px]">Cancelado (Onboarding) = Sim</code>) são excluídos dos totais de fechamentos e diárias.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card-glass p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Total de Leads Fechados</p>
          <p className="text-4xl font-bold text-foreground">{formatNumber(total)}</p>
          <p className="text-xs text-muted-foreground mt-1">Leads únicos no período</p>
        </div>
        <div className="card-glass p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Vendedores com Fechamentos</p>
          <p className="text-4xl font-bold text-foreground">{formatNumber(vendedoresOrdenados.length)}</p>
          <p className="text-xs text-muted-foreground mt-1">Top {Math.min(8, vendedoresOrdenados.length)} no gráfico</p>
        </div>
      </div>

      {/* 3.2 Bar chart vertical mensal */}
      <div className="card-glass p-4 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-foreground">Fechamentos Mensais por Vendedor</h3>
          <p className="text-xs text-muted-foreground">Top 8 vendedores</p>
        </div>
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={monthlyData} margin={{ left: 10, right: 10, top: 20 }}>
            <XAxis dataKey="name" stroke="hsl(240, 5%, 65%)" tick={{ fill: 'hsl(240, 5%, 65%)', fontSize: 12 }} />
            <YAxis stroke="hsl(240, 5%, 65%)" tick={{ fill: 'hsl(240, 5%, 65%)', fontSize: 12 }} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 12, color: 'hsl(240, 5%, 65%)' }} />
            {topVendedores.map((v, i) => (
              <Bar key={v} dataKey={v} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]}>
                <LabelList dataKey={v} position="top" fill="hsl(240, 5%, 75%)" fontSize={10} fontWeight={600}
                  formatter={(val: number) => val > 0 ? val : ''} />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 3.3 Bar chart horizontal total por vendedor */}
      <div className="card-glass p-4 rounded-xl">
        <h3 className="text-base font-semibold text-foreground mb-4">Total de Fechamentos por Vendedor</h3>
        <ResponsiveContainer width="100%" height={Math.max(250, totalPorVendedor.length * 36)}>
          <BarChart data={totalPorVendedor} layout="vertical" margin={{ left: 140, right: 50 }}>
            <XAxis type="number" stroke="hsl(240, 5%, 65%)" tick={{ fill: 'hsl(240, 5%, 65%)', fontSize: 12 }} />
            <YAxis type="category" dataKey="name" stroke="hsl(240, 5%, 65%)" width={135} tick={{ fill: 'hsl(240, 5%, 65%)', fontSize: 12 }} />
            <Tooltip {...TOOLTIP_STYLE} formatter={(value: number) => [formatNumber(value), 'Fechamentos']} />
            <Bar dataKey="value" fill="hsl(263, 70%, 58%)" radius={[0, 4, 4, 0]}>
              <LabelList dataKey="value" position="right" fill="hsl(240, 5%, 65%)" fontSize={11} fontWeight={600} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default BlocoFechamentos;
