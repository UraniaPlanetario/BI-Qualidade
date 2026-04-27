import { Calendar, AlertTriangle, CheckCircle2, ListChecks } from 'lucide-react';
import type { AgendamentoStats } from '../hooks/useAgendamentos';

interface Props {
  stats: AgendamentoStats;
}

export function KPIs({ stats }: Props) {
  const cards = [
    { label: 'Total', value: stats.total, icon: ListChecks, accent: 'text-foreground' },
    { label: 'Abertas',   value: stats.abertas,   icon: Calendar,       accent: 'text-sky-600' },
    { label: 'Atrasadas', value: stats.atrasadas, icon: AlertTriangle,  accent: 'text-rose-600' },
    { label: 'Concluídas', value: stats.completas, icon: CheckCircle2,  accent: 'text-emerald-600' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map(({ label, value, icon: Icon, accent }) => (
        <div key={label} className="bg-card border rounded-lg p-4 flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className={`text-2xl font-semibold mt-1 ${accent}`}>{value}</p>
          </div>
          <Icon className={accent} size={20} />
        </div>
      ))}
    </div>
  );
}
