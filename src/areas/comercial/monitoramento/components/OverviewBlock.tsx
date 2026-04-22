import { useMemo } from 'react';
import { UserActivity, CATEGORY_COLORS } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';

const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: 'hsl(240, 10%, 10%)', border: 'none', borderRadius: 8 },
  itemStyle: { color: '#fff' },
};

export function OverviewBlock({ activities }: { activities: UserActivity[] }) {
  const stats = useMemo(() => {
    const total = activities.reduce((s, a) => s + a.activity_count, 0);
    const users = new Set(activities.map((a) => a.user_id)).size;
    const days = new Set(activities.map((a) => a.activity_date)).size;
    const avgPerUser = users > 0 ? Math.round(total / users) : 0;
    const avgPerDay = days > 0 ? Math.round(total / days) : 0;
    return { total, users, avgPerUser, avgPerDay, days };
  }, [activities]);

  const EXCLUDED = ['Tag', 'Vinculacao', 'Outros'];

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of activities) {
      if (EXCLUDED.includes(a.category)) continue;
      map[a.category] = (map[a.category] || 0) + a.activity_count;
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [activities]);

  return (
    <div className="space-y-6">
      {/* KPIs */}
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

      {/* Categoria chart */}
      <div className="card-glass p-4 rounded-xl">
        <h3 className="text-base font-semibold text-foreground mb-4">Atividades por Categoria</h3>
        <ResponsiveContainer width="100%" height={Math.max(250, byCategory.length * 35)}>
          <BarChart data={byCategory} layout="vertical" margin={{ left: 120 }}>
            <XAxis type="number" stroke="hsl(240, 5%, 65%)" />
            <YAxis type="category" dataKey="name" stroke="hsl(240, 5%, 65%)" width={115} tick={{ fill: 'hsl(240, 5%, 65%)', fontSize: 12 }} />
            <Tooltip {...TOOLTIP_STYLE} formatter={(value: number) => [value.toLocaleString('pt-BR'), 'Total']} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {byCategory.map((c, idx) => (
                <Cell key={idx} fill={CATEGORY_COLORS[c.name] || 'hsl(263, 70%, 58%)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
