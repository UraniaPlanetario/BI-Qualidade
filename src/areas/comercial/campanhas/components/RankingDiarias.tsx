import { useMemo } from 'react';
import { LeadCampanha, normalizeVendedor, formatCurrency, podiumEmoji } from '../types';

interface Props {
  leads: LeadCampanha[];
}

interface VendedorRow {
  vendedor: string;
  diarias: number;
  premio: number;
  rank: number;
}

function denseRank(values: number[]): number[] {
  const sorted = [...new Set(values)].sort((a, b) => b - a);
  return values.map((v) => sorted.indexOf(v) + 1);
}

export function RankingDiarias({ leads }: Props) {
  const rows = useMemo(() => {
    const grouped = new Map<string, number>();

    for (const l of leads) {
      const vendedor = normalizeVendedor(l.vendedor);
      const diarias = parseInt(l.numero_de_diarias || '0', 10) || 0;
      grouped.set(vendedor, (grouped.get(vendedor) || 0) + diarias);
    }

    const items: Omit<VendedorRow, 'rank' | 'premio'>[] = [];
    for (const [vendedor, diarias] of grouped) {
      items.push({ vendedor, diarias });
    }

    items.sort((a, b) => b.diarias - a.diarias);
    const ranks = denseRank(items.map((i) => i.diarias));

    // Count how many share 1st place
    const firstPlaceTies = ranks.filter((r) => r === 1).length;
    const premioPerFirst = 300 / firstPlaceTies;

    return items.map((item, i) => ({
      ...item,
      rank: ranks[i],
      premio: ranks[i] === 1 ? premioPerFirst : 0,
    }));
  }, [leads]);

  if (rows.length === 0) {
    return (
      <div className="card-glass p-4 rounded-xl">
        <h3 className="text-sm font-semibold text-foreground mb-3">Diarias Fechadas</h3>
        <p className="text-sm text-muted-foreground text-center py-4">Sem dados no periodo</p>
      </div>
    );
  }

  return (
    <div className="card-glass p-4 rounded-xl">
      <h3 className="text-sm font-semibold text-foreground mb-3">Diarias Fechadas</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-center w-16 py-2 text-muted-foreground font-medium">Ranking</th>
            <th className="text-left py-2 text-muted-foreground font-medium">Vendedor/Consultor</th>
            <th className="text-right py-2 text-muted-foreground font-medium">Diarias Fechadas</th>
            <th className="text-right py-2 text-muted-foreground font-medium">Premiacao</th>
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
              <td className="text-right py-2">{r.diarias.toLocaleString('pt-BR')}</td>
              <td className="text-right py-2">{formatCurrency(r.premio)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
