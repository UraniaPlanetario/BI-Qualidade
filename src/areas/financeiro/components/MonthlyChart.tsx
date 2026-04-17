import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from 'recharts';
import { MetaFaturamento, LeadFechado, MONTH_LABELS, formatCurrencyShort, formatCurrency } from '../types';

interface MonthlyChartProps {
  leads: LeadFechado[];
  metas: MetaFaturamento[];
}

const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: 'hsl(240, 10%, 10%)', border: 'none', borderRadius: 8 },
  itemStyle: { color: '#fff' },
};

export function MonthlyChart({ leads, metas }: MonthlyChartProps) {
  // Aggregate revenue by month
  const revenueByMonth = new Map<number, number>();
  for (const lead of leads) {
    if (!lead.data_de_fechamento || lead.valor_total == null) continue;
    const month = new Date(lead.data_de_fechamento).getMonth(); // 0-based
    revenueByMonth.set(month, (revenueByMonth.get(month) || 0) + lead.valor_total);
  }

  // Build meta lookup by month
  const metaByMonth = new Map<number, MetaFaturamento>();
  for (const m of metas) {
    metaByMonth.set(m.mes - 1, m); // mes is 1-based in DB
  }

  const currentMonth = new Date().getMonth();

  const data = MONTH_LABELS.map((label, i) => {
    const meta = metaByMonth.get(i);
    return {
      name: label,
      faturamento: i <= currentMonth ? (revenueByMonth.get(i) || 0) : 0,
      meta70: meta?.meta_70 ?? 0,
      meta80: meta?.meta_80 ?? 0,
      meta90: meta?.meta_90 ?? 0,
      meta100: meta?.meta_100 ?? 0,
    };
  });

  return (
    <div className="card-glass p-4 rounded-xl">
      <h3 className="text-sm font-medium text-muted-foreground mb-3">Faturamento Mensal vs Metas</h3>
      <ResponsiveContainer width="100%" height={380}>
        <ComposedChart data={data} margin={{ top: 20, right: 20, bottom: 5, left: 10 }}>
          <XAxis dataKey="name" tick={{ fill: 'hsl(240, 5%, 65%)', fontSize: 12 }} />
          <YAxis
            tickFormatter={(v: number) => formatCurrencyShort(v)}
            tick={{ fill: 'hsl(240, 5%, 65%)', fontSize: 11 }}
            width={80}
          />
          <Tooltip
            {...TOOLTIP_STYLE}
            formatter={(value: number, name: string) => {
              const labels: Record<string, string> = {
                faturamento: 'Faturamento',
                meta70: 'Meta 70%',
                meta80: 'Meta 80%',
                meta90: 'Meta 90%',
                meta100: 'Meta 100%',
              };
              return [formatCurrency(value), labels[name] || name];
            }}
          />

          <Bar dataKey="faturamento" fill="hsl(263, 70%, 58%)" radius={[4, 4, 0, 0]} barSize={32}>
            <LabelList
              dataKey="faturamento"
              position="top"
              fill="hsl(240, 5%, 65%)"
              fontSize={10}
              formatter={(v: number) => (v > 0 ? formatCurrencyShort(v) : '')}
            />
          </Bar>

          <Line
            type="monotone"
            dataKey="meta70"
            stroke="hsl(0, 72%, 51%)"
            strokeDasharray="6 3"
            strokeWidth={1.5}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="meta80"
            stroke="hsl(45, 93%, 47%)"
            strokeDasharray="6 3"
            strokeWidth={1.5}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="meta90"
            stroke="hsl(142, 60%, 50%)"
            strokeDasharray="6 3"
            strokeWidth={1.5}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="meta100"
            stroke="hsl(142, 71%, 30%)"
            strokeDasharray="6 3"
            strokeWidth={1.5}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
