import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { LeadClosed } from '../types';

const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: 'hsl(240, 10%, 10%)', border: 'none', borderRadius: 8 },
  itemStyle: { color: '#fff' },
};

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

interface VendedorStats {
  vendedor: string;
  leads: number;
  receita: number;
  ticketMedio: number;
  cancelados: number;
  recorrentes: number;
}

export function VendedorBlock({ leads }: { leads: LeadClosed[] }) {
  const vendedorData = useMemo(() => {
    const map: Record<string, VendedorStats> = {};
    for (const l of leads) {
      const key = l.vendedor || 'Não atribuído';
      if (!map[key]) {
        map[key] = { vendedor: key, leads: 0, receita: 0, ticketMedio: 0, cancelados: 0, recorrentes: 0 };
      }
      map[key].leads += 1;
      map[key].receita += l.lead_price || 0;
      if (l.cancelado) map[key].cancelados += 1;
      if (l.occurrence > 1) map[key].recorrentes += 1;
    }
    return Object.values(map)
      .map((v) => ({ ...v, ticketMedio: v.leads > 0 ? v.receita / v.leads : 0 }))
      .sort((a, b) => b.leads - a.leads);
  }, [leads]);

  const chartData = useMemo(() => {
    return vendedorData.map((v) => ({ name: v.vendedor, value: v.leads }));
  }, [vendedorData]);

  const avgLeads = useMemo(() => {
    if (vendedorData.length === 0) return 0;
    return vendedorData.reduce((s, v) => s + v.leads, 0) / vendedorData.length;
  }, [vendedorData]);

  return (
    <div className="space-y-6">
      {/* Chart */}
      <div className="card-glass p-4 rounded-xl">
        <h3 className="text-base font-semibold text-foreground mb-4">Leads Fechados por Vendedor</h3>
        <ResponsiveContainer width="100%" height={Math.max(250, chartData.length * 40)}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 140 }}>
            <XAxis type="number" stroke="hsl(240, 5%, 65%)" tick={{ fill: 'hsl(240, 5%, 65%)', fontSize: 12 }} />
            <YAxis type="category" dataKey="name" stroke="hsl(240, 5%, 65%)" width={135} tick={{ fill: 'hsl(240, 5%, 65%)', fontSize: 12 }} />
            <Tooltip {...TOOLTIP_STYLE} formatter={(value: number) => [value.toLocaleString('pt-BR'), 'Leads']} />
            <ReferenceLine x={avgLeads} stroke="hsl(0, 0%, 50%)" strokeDasharray="3 3" label={{ value: 'Média', fill: 'hsl(240, 5%, 65%)', fontSize: 11, position: 'top' }} />
            <Bar dataKey="value" fill="hsl(263, 70%, 58%)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="card-glass p-4 rounded-xl overflow-x-auto">
        <h3 className="text-base font-semibold text-foreground mb-4">Detalhamento por Vendedor</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-3 text-muted-foreground font-medium">Vendedor</th>
              <th className="text-right py-2 px-3 text-muted-foreground font-medium">Leads Fechados</th>
              <th className="text-right py-2 px-3 text-muted-foreground font-medium">Receita (R$)</th>
              <th className="text-right py-2 px-3 text-muted-foreground font-medium">Ticket Médio (R$)</th>
              <th className="text-right py-2 px-3 text-muted-foreground font-medium">Cancelados</th>
              <th className="text-right py-2 px-3 text-muted-foreground font-medium">Recorrentes</th>
            </tr>
          </thead>
          <tbody>
            {vendedorData.map((v) => (
              <tr key={v.vendedor} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                <td className="py-2 px-3 text-foreground font-medium">{v.vendedor}</td>
                <td className="py-2 px-3 text-right text-foreground">{v.leads}</td>
                <td className="py-2 px-3 text-right text-foreground">R$ {formatCurrency(v.receita)}</td>
                <td className="py-2 px-3 text-right text-foreground">R$ {formatCurrency(v.ticketMedio)}</td>
                <td className="py-2 px-3 text-right text-foreground">{v.cancelados}</td>
                <td className="py-2 px-3 text-right text-foreground">{v.recorrentes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
