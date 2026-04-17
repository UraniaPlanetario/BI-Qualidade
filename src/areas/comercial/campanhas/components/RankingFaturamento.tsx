import { useMemo } from 'react';
import { LeadCampanha, normalizeVendedor, formatCurrency, podiumEmoji } from '../types';

interface Props {
  leads: LeadCampanha[];
}

interface VendedorRow {
  vendedor: string;
  faturamento: number;
  rank: number;
}

function denseRank(values: number[]): number[] {
  const sorted = [...new Set(values)].sort((a, b) => b - a);
  return values.map((v) => sorted.indexOf(v) + 1);
}

export function RankingFaturamento({ leads }: Props) {
  const rows = useMemo(() => {
    const grouped = new Map<string, number>();

    for (const l of leads) {
      const vendedor = normalizeVendedor(l.vendedor);
      grouped.set(vendedor, (grouped.get(vendedor) || 0) + (l.valor_total || 0));
    }

    const items: Omit<VendedorRow, 'rank'>[] = [];
    for (const [vendedor, faturamento] of grouped) {
      items.push({ vendedor, faturamento });
    }

    items.sort((a, b) => b.faturamento - a.faturamento);
    const ranks = denseRank(items.map((i) => i.faturamento));
    return items.map((item, i) => ({ ...item, rank: ranks[i] }));
  }, [leads]);

  if (rows.length === 0) {
    return (
      <div className="card-glass p-4 rounded-xl">
        <h3 className="text-sm font-semibold text-foreground mb-3">Faturamento</h3>
        <p className="text-sm text-muted-foreground text-center py-4">Sem dados no periodo</p>
      </div>
    );
  }

  return (
    <div className="card-glass p-4 rounded-xl">
      <h3 className="text-sm font-semibold text-foreground mb-3">Faturamento</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-center w-16 py-2 text-muted-foreground font-medium">Ranking</th>
            <th className="text-left py-2 text-muted-foreground font-medium">Vendedor/Consultor</th>
            <th className="text-right py-2 text-muted-foreground font-medium">Valor Total (R$)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.vendedor}
              className={`border-b border-border/50 hover:bg-secondary/30 ${r.rank === 1 ? 'bg-yellow-500/5' : ''}`}
            >
              <td className="text-center w-16 py-2">{podiumEmoji(r.rank)}</td>
              <td className="text-left py-2">{r.vendedor}</td>
              <td className="text-right py-2">{formatCurrency(r.faturamento)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
