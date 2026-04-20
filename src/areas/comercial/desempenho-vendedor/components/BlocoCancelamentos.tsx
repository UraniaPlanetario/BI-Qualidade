import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, Legend } from 'recharts';
import { LeadVendedor, formatNumber, formatPct } from '../types';
import { filterLeadsFechados } from './BlocoFechamentos';

const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: 'hsl(240, 10%, 10%)', border: 'none', borderRadius: 8 },
  itemStyle: { color: '#fff' },
};

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const COLORS = [
  'hsl(0, 72%, 51%)',
  'hsl(263, 70%, 58%)',
  'hsl(270, 50%, 70%)',
  'hsl(45, 80%, 55%)',
  'hsl(142, 60%, 50%)',
  'hsl(200, 70%, 55%)',
  'hsl(330, 65%, 60%)',
  'hsl(30, 80%, 55%)',
];

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

export function BlocoCancelamentos({ leads, dateFrom, dateTo }: Props) {
  // Cancelamentos no período (filtrados por data_cancelamento)
  const cancelados = useMemo(() => {
    return leads.filter((l) =>
      l.data_cancelamento != null &&
      (dateFrom || dateTo ? inRange(l.data_cancelamento, dateFrom, dateTo) : true)
    );
  }, [leads, dateFrom, dateTo]);

  // Dedup by id_lead (keep first occurrence)
  const canceladosUnique = useMemo(() => {
    const seen = new Set<number>();
    const out: LeadVendedor[] = [];
    for (const l of cancelados) {
      if (seen.has(l.id_lead)) continue;
      seen.add(l.id_lead);
      out.push(l);
    }
    return out;
  }, [cancelados]);

  const totalCancelamentos = canceladosUnique.length;

  const vendedoresOrdenados = useMemo(() => {
    const map: Record<string, number> = {};
    for (const l of canceladosUnique) {
      const v = l.vendedor || 'Não atribuído';
      map[v] = (map[v] || 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [canceladosUnique]);

  const topVendedores = useMemo(() => vendedoresOrdenados.slice(0, 8).map((e) => e[0]), [vendedoresOrdenados]);

  const monthlyData = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const l of canceladosUnique) {
      const v = l.vendedor || 'Não atribuído';
      if (!topVendedores.includes(v)) continue;
      const d = l.data_cancelamento ? new Date(l.data_cancelamento) : null;
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
  }, [canceladosUnique, topVendedores]);

  const totalByVendedor = useMemo(
    () => vendedoresOrdenados.map(([name, value]) => ({ name, value })),
    [vendedoresOrdenados]
  );

  // Taxa de churn: total cancelamentos / total fechamentos nos meses originais dos leads cancelados
  const allFechados = useMemo(() => filterLeadsFechados(leads), [leads]);

  const churnData = useMemo(() => {
    // Build set of months in which cancelled leads were originally closed
    const monthsOfCancelled = new Set<string>();
    const fechadoById: Record<number, LeadVendedor> = {};
    for (const l of allFechados) fechadoById[l.id_lead] = l;

    for (const c of canceladosUnique) {
      const origem = fechadoById[c.id_lead];
      if (!origem || !origem.data_de_fechamento) continue;
      const d = new Date(origem.data_de_fechamento);
      if (isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
      monthsOfCancelled.add(key);
    }

    // Count fechamentos nos meses relevantes (denominador)
    const fechamentosNoMesOrigem: Record<string, number> = {}; // por vendedor
    let totalFechamentosDenom = 0;
    for (const l of allFechados) {
      if (!l.data_de_fechamento) continue;
      const d = new Date(l.data_de_fechamento);
      if (isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
      if (!monthsOfCancelled.has(key)) continue;
      const v = l.vendedor || 'Não atribuído';
      fechamentosNoMesOrigem[v] = (fechamentosNoMesOrigem[v] || 0) + 1;
      totalFechamentosDenom += 1;
    }

    // Cancelamentos por vendedor (numerador)
    const cancelamentosVend: Record<string, number> = {};
    for (const c of canceladosUnique) {
      const v = c.vendedor || 'Não atribuído';
      cancelamentosVend[v] = (cancelamentosVend[v] || 0) + 1;
    }

    const taxaGeral = totalFechamentosDenom > 0 ? (totalCancelamentos / totalFechamentosDenom) * 100 : 0;

    const porVendedor = Object.entries(cancelamentosVend)
      .map(([name, cancelamentos]) => {
        const fechamentos = fechamentosNoMesOrigem[name] || 0;
        const taxa = fechamentos > 0 ? (cancelamentos / fechamentos) * 100 : 0;
        return { name, cancelamentos, fechamentos, taxa: Number(taxa.toFixed(2)) };
      })
      .sort((a, b) => b.taxa - a.taxa);

    return { taxaGeral, porVendedor, totalFechamentosDenom };
  }, [allFechados, canceladosUnique, totalCancelamentos]);

  return (
    <div className="space-y-6">
      {/* 6.1 KPI Total cancelamentos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card-glass p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Total de Cancelamentos no Período</p>
          <p className="text-4xl font-bold text-foreground">{formatNumber(totalCancelamentos)}</p>
          <p className="text-xs text-muted-foreground mt-1">Leads únicos cancelados</p>
        </div>
        <div className="card-glass p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Taxa de Churn</p>
          <p className="text-4xl font-bold text-foreground">{formatPct(churnData.taxaGeral)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatNumber(totalCancelamentos)} / {formatNumber(churnData.totalFechamentosDenom)} fechamentos (meses originais)
          </p>
        </div>
      </div>

      {/* 6.2 Bar chart mensal por vendedor */}
      <div className="card-glass p-4 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-foreground">Cancelamentos Mensais por Vendedor</h3>
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

      {/* 6.3 Bar chart horizontal total por vendedor */}
      <div className="card-glass p-4 rounded-xl">
        <h3 className="text-base font-semibold text-foreground mb-4">Total de Cancelamentos por Vendedor</h3>
        <ResponsiveContainer width="100%" height={Math.max(250, totalByVendedor.length * 36)}>
          <BarChart data={totalByVendedor} layout="vertical" margin={{ left: 140, right: 50 }}>
            <XAxis type="number" stroke="hsl(240, 5%, 65%)" tick={{ fill: 'hsl(240, 5%, 65%)', fontSize: 12 }} />
            <YAxis type="category" dataKey="name" stroke="hsl(240, 5%, 65%)" width={135} tick={{ fill: 'hsl(240, 5%, 65%)', fontSize: 12 }} />
            <Tooltip {...TOOLTIP_STYLE} formatter={(value: number) => [formatNumber(value), 'Cancelamentos']} />
            <Bar dataKey="value" fill="hsl(0, 72%, 51%)" radius={[0, 4, 4, 0]}>
              <LabelList dataKey="value" position="right" fill="hsl(240, 5%, 65%)" fontSize={11} fontWeight={600} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 6.5 Bar chart horizontal taxa churn por vendedor */}
      <div className="card-glass p-4 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-foreground">Taxa de Churn por Vendedor</h3>
          <p className="text-xs text-muted-foreground">% = cancelamentos / fechamentos nos meses de origem</p>
        </div>
        <ResponsiveContainer width="100%" height={Math.max(250, churnData.porVendedor.length * 36)}>
          <BarChart data={churnData.porVendedor} layout="vertical" margin={{ left: 140, right: 70 }}>
            <XAxis type="number" stroke="hsl(240, 5%, 65%)" tick={{ fill: 'hsl(240, 5%, 65%)', fontSize: 12 }}
              tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
            <YAxis type="category" dataKey="name" stroke="hsl(240, 5%, 65%)" width={135} tick={{ fill: 'hsl(240, 5%, 65%)', fontSize: 12 }} />
            <Tooltip {...TOOLTIP_STYLE} formatter={(value: number, _n, props: any) => {
              const row = props?.payload;
              return [
                `${formatPct(value)} (${row?.cancelamentos || 0}/${row?.fechamentos || 0})`,
                'Churn',
              ];
            }} />
            <Bar dataKey="taxa" fill="hsl(0, 72%, 51%)" radius={[0, 4, 4, 0]}>
              <LabelList dataKey="taxa" position="right" fill="hsl(240, 5%, 65%)" fontSize={11} fontWeight={600}
                formatter={(v: number) => formatPct(v)} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default BlocoCancelamentos;
