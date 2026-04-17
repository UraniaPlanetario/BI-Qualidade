import { formatCurrency } from '../types';

interface MetasTableProps {
  faturamento: number;
  metas: {
    meta70: number;
    meta80: number;
    meta90: number;
    meta100: number;
  };
}

export function MetasTable({ faturamento, metas }: MetasTableProps) {
  const rows = [
    { label: '70%', target: metas.meta70 },
    { label: '80%', target: metas.meta80 },
    { label: '90%', target: metas.meta90 },
    { label: '100%', target: metas.meta100 },
  ];

  return (
    <div className="card-glass p-4 rounded-xl">
      <h3 className="text-sm font-medium text-muted-foreground mb-3">Metas Anuais</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/40">
              <th className="text-left py-2 px-3 text-muted-foreground font-medium">Meta</th>
              <th className="text-left py-2 px-3 text-muted-foreground font-medium">Status</th>
              <th className="text-right py-2 px-3 text-muted-foreground font-medium">Progresso</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ label, target }) => {
              const atingida = faturamento >= target;
              const faltam = target - faturamento;
              const progresso = target > 0 ? ((faturamento / target) * 100).toFixed(1) : '0.0';

              return (
                <tr
                  key={label}
                  className={
                    atingida
                      ? 'bg-green-500/10'
                      : 'bg-red-500/10'
                  }
                >
                  <td className="py-2 px-3 font-medium text-foreground">{label}</td>
                  <td className="py-2 px-3">
                    {atingida ? (
                      <span className="text-green-400 font-medium">Atingida ✓</span>
                    ) : (
                      <span className="text-red-400">Faltam {formatCurrency(faltam)}</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-foreground">{progresso}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
