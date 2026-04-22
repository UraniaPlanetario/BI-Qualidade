import { useMemo } from 'react';
import { CATEGORY_COLORS } from '../types';
import { ActivitySummary } from '../hooks/useConsistenciaData';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { UsersBlock } from './UsersBlock';

const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: 'hsl(240, 10%, 10%)', border: 'none', borderRadius: 8 },
  itemStyle: { color: '#fff' },
};

const DISPLAY_LABEL: Record<string, string> = {
  Tarefa: 'Tarefas Concluídas',
};

const EXCLUDED = ['Tag', 'Vinculacao', 'Outros'];

export function OverviewBlock({
  summary,
  dateRange,
}: {
  summary: ActivitySummary[];
  dateRange: { from: Date; to: Date };
}) {
  // Ajuste: na categoria 'Tarefa', só contamos task_completed (renomeada para "Tarefas Concluídas")
  const filteredForChart = useMemo(
    () =>
      summary.filter((a) => {
        if (EXCLUDED.includes(a.category)) return false;
        if (a.category === 'Tarefa') return a.event_type === 'task_completed';
        return true;
      }),
    [summary],
  );

  const stats = useMemo(() => {
    const total = filteredForChart.reduce((s, a) => s + a.total, 0);
    const users = new Set(filteredForChart.map((a) => a.user_id)).size;
    // dias_com_atividade vem embutido na RPC (mesmo valor em todas as linhas)
    const days = filteredForChart[0]?.dias_com_atividade ?? 0;
    const avgPerUser = users > 0 ? Math.round(total / users) : 0;
    const avgPerDay = days > 0 ? Math.round(total / days) : 0;
    return { total, users, avgPerUser, avgPerDay, days };
  }, [filteredForChart]);

  const byCategory = useMemo(() => {
    const map: Record<string, { value: number; originalCategory: string }> = {};
    for (const a of filteredForChart) {
      const label = DISPLAY_LABEL[a.category] ?? a.category;
      if (!map[label]) map[label] = { value: 0, originalCategory: a.category };
      map[label].value += a.total;
    }
    return Object.entries(map)
      .map(([name, { value, originalCategory }]) => ({ name, value, originalCategory }))
      .sort((a, b) => b.value - a.value);
  }, [filteredForChart]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card-glass p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Total Atividades</p>
          <p className="text-3xl font-bold text-foreground">{stats.total.toLocaleString('pt-BR')}</p>
        </div>
        <div className="card-glass p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Usuários Ativos</p>
          <p className="text-3xl font-bold text-foreground">{stats.users}</p>
        </div>
        <div className="card-glass p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Média por Usuário</p>
          <p className="text-3xl font-bold text-foreground">{stats.avgPerUser.toLocaleString('pt-BR')}</p>
        </div>
        <div className="card-glass p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Média por Dia</p>
          <p className="text-3xl font-bold text-foreground">{stats.avgPerDay.toLocaleString('pt-BR')}</p>
        </div>
      </div>

      <div className="card-glass p-4 rounded-xl">
        <h3 className="text-base font-semibold text-foreground mb-1">Atividades por Categoria</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Tarefas contam apenas as <strong>concluídas</strong> (<code>task_completed</code>) no período.
        </p>
        <ResponsiveContainer width="100%" height={Math.max(250, byCategory.length * 35)}>
          <BarChart data={byCategory} layout="vertical" margin={{ left: 140 }}>
            <XAxis type="number" stroke="hsl(240, 5%, 65%)" />
            <YAxis type="category" dataKey="name" stroke="hsl(240, 5%, 65%)" width={135} tick={{ fill: 'hsl(240, 5%, 65%)', fontSize: 12 }} />
            <Tooltip {...TOOLTIP_STYLE} formatter={(value: number) => [value.toLocaleString('pt-BR'), 'Total']} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {byCategory.map((c, idx) => (
                <Cell key={idx} fill={CATEGORY_COLORS[c.originalCategory] || 'hsl(263, 70%, 58%)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <UsersBlock summary={summary} dateRange={dateRange} />
    </div>
  );
}
