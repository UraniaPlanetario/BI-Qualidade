import { useMemo } from 'react';
import { LeadCampanha, normalizeVendedor, formatCurrency, podiumEmoji } from '../types';

interface Props {
  leads: LeadCampanha[];
}

interface VendedorRow {
  vendedor: string;
  leads: number;
  diarias: number;
  faturamento: number;
  ticketMedio: number;
  rank: number;
}

function denseRank(values: number[]): number[] {
  const sorted = [...new Set(values)].sort((a, b) => b - a);
  return values.map((v) => sorted.indexOf(v) + 1);
}

export function RankingTicketMedio({ leads }: Props) {
  const rows = useMemo(() => {
    const grouped = new Map<string, { leadIds: Set<number>; diarias: number; faturamento: number }>();

    for (const l of leads) {
      const vendedor = normalizeVendedor(l.vendedor);
      if (!grouped.has(vendedor)) {
        grouped.set(vendedor, { leadIds: new Set(), diarias: 0, faturamento: 0 });
      }
      const g = grouped.get(vendedor)!;
      g.leadIds.add(l.id_lead);
      g.diarias += parseInt(l.numero_de_diarias || '0', 10) || 0;
      g.faturamento += l.valor_total || 0;
    }

    // Threshold: >= 10 leads
    const qualifying: Omit<VendedorRow, 'rank'>[] = [];
    for (const [vendedor, g] of grouped) {
      const leadsCount = g.leadIds.size;
      if (leadsCount < 10) continue;
      const ticketMedio = g.diarias > 0 ? g.faturamento / g.diarias : 0;
      qualifying.push({ vendedor, leads: leadsCount, diarias: g.diarias, faturamento: g.faturamento, ticketMedio });
    }

    // Sort: ticketMedio DESC -> leads DESC -> faturamento DESC
    qualifying.sort((a, b) =>
      b.ticketMedio - a.ticketMedio || b.leads - a.leads || b.faturamento - a.faturamento,
    );

    const ranks = denseRank(qualifying.map((q) => q.ticketMedio));
    return qualifying.map((q, i) => ({ ...q, rank: ranks[i] }));
  }, [leads]);

  if (rows.length === 0) {
    return (
      <div className="card-glass p-4 rounded-xl">
        <h3 className="text-sm font-semibold text-foreground mb-3">Ticket Medio</h3>
        <p className="text-sm text-muted-foreground text-center py-4">Nenhum vendedor atingiu o minimo de leads</p>
      </div>
    );
  }

  return (
    <div className="card-glass p-4 rounded-xl">
      <h3 className="text-sm font-semibold text-foreground mb-3">Ticket Medio</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-center w-16 py-2 text-muted-foreground font-medium">Ranking</th>
            <th className="text-left py-2 text-muted-foreground font-medium">Vendedor/Consultor</th>
            <th className="text-right py-2 text-muted-foreground font-medium">Ticket Medio</th>
            <th className="text-right py-2 text-muted-foreground font-medium">Premio</th>
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
              <td className="text-right py-2">{formatCurrency(r.ticketMedio)}</td>
              <td className="text-right py-2">{r.rank === 1 ? formatCurrency(500) : formatCurrency(0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
