import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, LabelList } from 'recharts';
import { LeadClosed } from '../types';

const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: 'hsl(240, 10%, 10%)', border: 'none', borderRadius: 8 },
  itemStyle: { color: '#fff' },
};

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

interface AstronomoStats {
  astronomo: string;
  leads: number;
  diarias: number;
  receita: number;
  ticketMedio: number;
}

/** Recebe `ativos` = leads não-cancelados com data de fechamento no período.
 *  KPIs e tabela ignoram cancelados por design — a aba é sobre fechamentos. */
export function AstronomoBlock({ ativos }: { ativos: LeadClosed[] }) {
  const astronomoData = useMemo(() => {
    const map: Record<string, AstronomoStats> = {};
    for (const l of ativos) {
      const key = l.astronomo || 'Não atribuído';
      if (!map[key]) {
        map[key] = { astronomo: key, leads: 0, diarias: 0, receita: 0, ticketMedio: 0 };
      }
      map[key].leads += 1;
      const parsed = parseInt(l.n_diarias || '0', 10);
      map[key].diarias += isNaN(parsed) ? 0 : parsed;
      map[key].receita += l.lead_price || 0;
    }
    return Object.values(map)
      .map((v) => ({ ...v, ticketMedio: v.diarias > 0 ? v.receita / v.diarias : 0 }))
      .sort((a, b) => b.diarias - a.diarias);
  }, [ativos]);

  const chartData = useMemo(() => {
    return astronomoData.map((v) => ({ name: v.astronomo, value: v.diarias }));
  }, [astronomoData]);

  const avgDiarias = useMemo(() => {
    if (astronomoData.length === 0) return 0;
    return astronomoData.reduce((s, v) => s + v.diarias, 0) / astronomoData.length;
  }, [astronomoData]);

  return (
    <div className="space-y-6">
      {/* Chart */}
      <div className="card-glass p-4 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-foreground">Diárias Fechadas por Astrônomo</h3>
          <p className="text-xs text-muted-foreground">Linha tracejada = média ({Math.round(avgDiarias)} diárias)</p>
        </div>
        <ResponsiveContainer width="100%" height={Math.max(250, chartData.length * 40)}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 140, right: 50 }}>
            <XAxis type="number" stroke="hsl(240, 5%, 65%)" tick={{ fill: 'hsl(240, 5%, 65%)', fontSize: 12 }} />
            <YAxis type="category" dataKey="name" stroke="hsl(240, 5%, 65%)" width={135} tick={{ fill: 'hsl(240, 5%, 65%)', fontSize: 12 }} />
            <Tooltip {...TOOLTIP_STYLE} formatter={(value: number) => [value.toLocaleString('pt-BR'), 'Diárias']} />
            <ReferenceLine x={avgDiarias} stroke="hsl(45, 80%, 55%)" strokeDasharray="4 4" />
            <Bar dataKey="value" fill="hsl(263, 70%, 58%)" radius={[0, 4, 4, 0]}>
              <LabelList dataKey="value" position="right" fill="hsl(240, 5%, 65%)" fontSize={11} fontWeight={600} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="card-glass p-4 rounded-xl overflow-x-auto">
        <h3 className="text-base font-semibold text-foreground mb-4">Detalhamento por Astrônomo</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-3 text-muted-foreground font-medium">Astrônomo</th>
              <th className="text-right py-2 px-3 text-muted-foreground font-medium">Leads Fechados</th>
              <th className="text-right py-2 px-3 text-muted-foreground font-medium">Diárias Fechadas</th>
              <th className="text-right py-2 px-3 text-muted-foreground font-medium">Receita (R$)</th>
              <th className="text-right py-2 px-3 text-muted-foreground font-medium">Ticket Médio (R$)</th>
            </tr>
          </thead>
          <tbody>
            {astronomoData.map((v) => (
              <tr key={v.astronomo} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                <td className="py-2 px-3 text-foreground font-medium">{v.astronomo}</td>
                <td className="py-2 px-3 text-right text-foreground">{v.leads}</td>
                <td className="py-2 px-3 text-right text-foreground">{v.diarias}</td>
                <td className="py-2 px-3 text-right text-foreground">R$ {formatCurrency(v.receita)}</td>
                <td className="py-2 px-3 text-right text-foreground">R$ {formatCurrency(v.ticketMedio)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
