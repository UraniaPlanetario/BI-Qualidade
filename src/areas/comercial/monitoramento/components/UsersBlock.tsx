import { useMemo, useState } from 'react';
import { UserActivity, CATEGORY_COLORS } from '../types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: 'hsl(240, 10%, 10%)', border: 'none', borderRadius: 8 },
  itemStyle: { color: '#fff' },
};

const EXCLUDED_CATEGORIES = ['Tag', 'Vinculacao', 'Outros'];

const TABS: { id: string; label: string }[] = [
  { id: 'Mensagem Enviada', label: 'Mensagem Enviada' },
  { id: 'Tarefa', label: 'Tarefa' },
  { id: 'Nota', label: 'Nota' },
  { id: 'Movimentacao', label: 'Movimentacao' },
  { id: 'Campo alterado', label: 'Campo alterado' },
  { id: 'Ligacao', label: 'Ligacao' },
  { id: 'Outros', label: 'Outros' },
];

const CATEGORY_LABELS: Record<string, string> = {
  'Mensagem Enviada': 'Total de Mensagens Enviadas',
  'Nota': 'Total de Notas Criadas',
  'Movimentacao': 'Total de Movimentações',
  'Campo alterado': 'Total de Campos Alterados',
  'Ligacao': 'Total de Ligações',
  'Outros': 'Total de Outras Atividades',
};

const TASK_SUBTYPES = {
  completed: {
    label: 'Tarefas Concluídas',
    eventTypes: ['task_completed'],
    color: 'hsl(142, 60%, 50%)',
  },
  created: {
    label: 'Tarefas Criadas',
    eventTypes: ['task_added'],
    color: 'hsl(263, 70%, 58%)',
  },
  changed: {
    label: 'Tarefas Alteradas',
    eventTypes: ['task_text_changed', 'task_deadline_changed'],
    color: 'hsl(45, 80%, 55%)',
  },
} as const;

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card-glass p-4 rounded-xl text-center">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold text-foreground">{value.toLocaleString('pt-BR')}</p>
    </div>
  );
}

function HorizontalBarChart({
  data,
  avg,
  barColor,
  dataKey = 'count',
}: {
  data: { name: string; count: number }[];
  avg: number;
  barColor: string;
  dataKey?: string;
}) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Nenhuma atividade encontrada.
      </p>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(300, data.length * 32)}>
      <BarChart data={data} layout="vertical" margin={{ left: 130 }}>
        <XAxis type="number" stroke="hsl(240, 5%, 65%)" />
        <YAxis
          type="category"
          dataKey="name"
          stroke="hsl(240, 5%, 65%)"
          width={125}
          tick={{ fill: 'hsl(240, 5%, 65%)', fontSize: 11 }}
        />
        <Tooltip {...TOOLTIP_STYLE} formatter={(value: number) => [value.toLocaleString('pt-BR'), 'Total']} />
        <ReferenceLine x={avg} stroke="hsl(45, 80%, 55%)" strokeDasharray="4 4" />
        <Bar dataKey={dataKey} fill={barColor} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function buildUserRows(
  activities: UserActivity[],
  filterFn: (a: UserActivity) => boolean,
): { rows: { name: string; count: number }[]; total: number; uniqueUsers: number; avg: number } {
  const map: Record<string, number> = {};
  for (const a of activities) {
    if (filterFn(a)) {
      map[a.user_name] = (map[a.user_name] || 0) + a.activity_count;
    }
  }
  const rows = Object.entries(map)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  const total = rows.reduce((s, r) => s + r.count, 0);
  const uniqueUsers = rows.length;
  const avg = uniqueUsers === 0 ? 0 : Math.round(total / uniqueUsers);
  return { rows, total, uniqueUsers, avg };
}

export function UsersBlock({ activities }: { activities: UserActivity[] }) {
  const [activeTab, setActiveTab] = useState('Mensagem Enviada');

  const filteredActivities = useMemo(
    () => activities.filter((a) => !EXCLUDED_CATEGORIES.includes(a.category)),
    [activities],
  );

  // === Category tab data (non-Tarefa) ===
  const categoryData = useMemo(() => {
    if (activeTab === 'Tarefa') return null;
    return buildUserRows(filteredActivities, (a) => a.category === activeTab);
  }, [filteredActivities, activeTab]);

  // === Tarefa tab data ===
  const tarefaData = useMemo(() => {
    if (activeTab !== 'Tarefa') return null;
    const tarefaActivities = filteredActivities.filter((a) => a.category === 'Tarefa');
    const completed = buildUserRows(tarefaActivities, (a) =>
      TASK_SUBTYPES.completed.eventTypes.includes(a.event_type),
    );
    const created = buildUserRows(tarefaActivities, (a) =>
      TASK_SUBTYPES.created.eventTypes.includes(a.event_type),
    );
    const changed = buildUserRows(tarefaActivities, (a) =>
      (TASK_SUBTYPES.changed.eventTypes as readonly string[]).includes(a.event_type),
    );
    return { completed, created, changed };
  }, [filteredActivities, activeTab]);

  return (
    <div className="space-y-6">
      {/* Category tabs */}
      <div className="card-glass p-1 rounded-xl mb-6 flex flex-wrap gap-1">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
              activeTab === id
                ? 'bg-primary text-white font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'Tarefa' && tarefaData && (
        <>
          {/* 3 KPIs */}
          <div className="grid grid-cols-3 gap-4">
            <KpiCard label="Tarefas Concluídas" value={tarefaData.completed.total} />
            <KpiCard label="Tarefas Criadas" value={tarefaData.created.total} />
            <KpiCard label="Tarefas Alteradas" value={tarefaData.changed.total} />
          </div>

          {/* Concluídas chart */}
          <div className="card-glass p-4 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-foreground">Concluídas por Usuário</h3>
              <p className="text-xs text-muted-foreground">
                Linha tracejada = média ({tarefaData.completed.avg.toLocaleString('pt-BR')})
              </p>
            </div>
            <HorizontalBarChart
              data={tarefaData.completed.rows}
              avg={tarefaData.completed.avg}
              barColor={TASK_SUBTYPES.completed.color}
            />
          </div>

          {/* Criadas chart */}
          <div className="card-glass p-4 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-foreground">Criadas por Usuário</h3>
              <p className="text-xs text-muted-foreground">
                Linha tracejada = média ({tarefaData.created.avg.toLocaleString('pt-BR')})
              </p>
            </div>
            <HorizontalBarChart
              data={tarefaData.created.rows}
              avg={tarefaData.created.avg}
              barColor={TASK_SUBTYPES.created.color}
            />
          </div>

          {/* Alteradas chart */}
          <div className="card-glass p-4 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-foreground">Alteradas por Usuário</h3>
              <p className="text-xs text-muted-foreground">
                Linha tracejada = média ({tarefaData.changed.avg.toLocaleString('pt-BR')})
              </p>
            </div>
            <HorizontalBarChart
              data={tarefaData.changed.rows}
              avg={tarefaData.changed.avg}
              barColor={TASK_SUBTYPES.changed.color}
            />
          </div>
        </>
      )}

      {activeTab !== 'Tarefa' && categoryData && (
        <>
          {/* 2 KPIs */}
          <div className="grid grid-cols-2 gap-4">
            <KpiCard label={CATEGORY_LABELS[activeTab] || 'Total'} value={categoryData.total} />
            <KpiCard
              label="Média por Usuário"
              value={categoryData.uniqueUsers === 0 ? 0 : Math.round(categoryData.total / categoryData.uniqueUsers)}
            />
          </div>

          {activeTab === 'Outros' && (
            <p className="text-xs text-muted-foreground/70 italic">
              Inclui: alterações de responsável em contatos, adição de tags, vinculações entre entidades, conversas (talk), e outras atividades do CRM não categorizadas acima.
            </p>
          )}

          {/* Bar chart */}
          <div className="card-glass p-4 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-foreground">{activeTab} por Usuário</h3>
              <p className="text-xs text-muted-foreground">
                Linha tracejada = média ({categoryData.avg.toLocaleString('pt-BR')})
              </p>
            </div>
            <HorizontalBarChart
              data={categoryData.rows}
              avg={categoryData.avg}
              barColor={CATEGORY_COLORS[activeTab] || 'hsl(240, 5%, 50%)'}
            />
          </div>
        </>
      )}
    </div>
  );
}
