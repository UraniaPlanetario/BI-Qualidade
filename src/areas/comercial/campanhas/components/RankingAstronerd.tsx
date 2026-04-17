import { useMemo } from 'react';
import { LeadCampanha, normalizeVendedor, podiumEmoji } from '../types';

interface Props {
  leads: LeadCampanha[];
}

interface VendedorRow {
  vendedor: string;
  leads: number;
  rank: number;
}

function denseRank(values: number[]): number[] {
  const sorted = [...new Set(values)].sort((a, b) => b - a);
  return values.map((v) => sorted.indexOf(v) + 1);
}

function isAstronerd(lead: LeadCampanha): boolean {
  const produtos = (lead.produtos || '').toLowerCase();
  const conteudo = (lead.conteudo_apresentacao || '').toLowerCase();
  return produtos.includes('astronerd') || conteudo.includes('astronerd');
}

export function RankingAstronerd({ leads }: Props) {
  const rows = useMemo(() => {
    const astronerdLeads = leads.filter(isAstronerd);

    const grouped = new Map<string, Set<number>>();
    for (const l of astronerdLeads) {
      const vendedor = normalizeVendedor(l.vendedor);
      if (!grouped.has(vendedor)) grouped.set(vendedor, new Set());
      grouped.get(vendedor)!.add(l.id_lead);
    }

    const items: Omit<VendedorRow, 'rank'>[] = [];
    for (const [vendedor, ids] of grouped) {
      items.push({ vendedor, leads: ids.size });
    }

    items.sort((a, b) => b.leads - a.leads);
    const ranks = denseRank(items.map((i) => i.leads));
    return items.map((item, i) => ({ ...item, rank: ranks[i] }));
  }, [leads]);

  if (rows.length === 0) {
    return (
      <div className="card-glass p-4 rounded-xl">
        <h3 className="text-sm font-semibold text-foreground mb-3">Leads Fechados (Astronerd)</h3>
        <p className="text-sm text-muted-foreground text-center py-4">Sem dados no periodo</p>
      </div>
    );
  }

  return (
    <div className="card-glass p-4 rounded-xl">
      <h3 className="text-sm font-semibold text-foreground mb-3">Leads Fechados (Astronerd)</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-center w-16 py-2 text-muted-foreground font-medium">Ranking</th>
            <th className="text-left py-2 text-muted-foreground font-medium">Vendedor/Consultor</th>
            <th className="text-right py-2 text-muted-foreground font-medium">Leads Fechados (Astronerd)</th>
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
              <td className="text-right py-2">{r.leads.toLocaleString('pt-BR')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
