import { useMemo, useState } from 'react';
import { CATEGORY_COLORS } from '../types';
import {
  ActivitySummary,
  useMensagensPorLead,
  useTopCamposAlterados,
} from '../hooks/useConsistenciaData';
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
  { id: 'Movimentacao', label: 'Movimentação' },
  { id: 'Campo alterado', label: 'Campo alterado' },
  { id: 'Ligacao', label: 'Ligação' },
];

const CATEGORY_LABELS: Record<string, string> = {
  'Mensagem Enviada': 'Total de Mensagens Enviadas',
  Nota: 'Total de Notas Criadas',
  Movimentacao: 'Total de Movimentações',
  'Campo alterado': 'Total de Campos Alterados',
  Ligacao: 'Total de Ligações',
};

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="card-glass p-4 rounded-xl text-center">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold text-foreground">
        {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
      </p>
      {hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function HorizontalBarChart({
  data,
  avg,
  barColor,
  dataKey = 'count',
  formatValue,
}: {
  data: { name: string; count: number }[];
  avg: number;
  barColor: string;
  dataKey?: string;
  formatValue?: (v: number) => string;
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
        <XAxis
          type="number"
          stroke="hsl(240, 5%, 65%)"
          tickFormatter={formatValue}
        />
        <YAxis
          type="category"
          dataKey="name"
          stroke="hsl(240, 5%, 65%)"
          width={125}
          tick={{ fill: 'hsl(240, 5%, 65%)', fontSize: 11 }}
        />
        <Tooltip
          {...TOOLTIP_STYLE}
          formatter={(value: number) => [
            formatValue ? formatValue(value) : value.toLocaleString('pt-BR'),
            'Total',
          ]}
        />
        <ReferenceLine x={avg} stroke="hsl(45, 80%, 55%)" strokeDasharray="4 4" />
        <Bar dataKey={dataKey} fill={barColor} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function buildUserRows(
  rows: ActivitySummary[],
  filterFn: (a: ActivitySummary) => boolean,
): { rows: { name: string; count: number }[]; total: number; uniqueUsers: number; avg: number } {
  const map: Record<string, number> = {};
  for (const a of rows) {
    if (filterFn(a)) {
      map[a.user_name] = (map[a.user_name] || 0) + a.total;
    }
  }
  const out = Object.entries(map)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  const total = out.reduce((s, r) => s + r.count, 0);
  const uniqueUsers = out.length;
  const avg = uniqueUsers === 0 ? 0 : Math.round(total / uniqueUsers);
  return { rows: out, total, uniqueUsers, avg };
}

export function UsersBlock({
  summary,
  dateRange,
}: {
  summary: ActivitySummary[];
  dateRange: { from: Date; to: Date };
}) {
  const [activeTab, setActiveTab] = useState('Mensagem Enviada');
  const fromStr = toDateStr(dateRange.from);
  const toStr = toDateStr(dateRange.to);

  const filteredActivities = useMemo(
    () => summary.filter((a) => !EXCLUDED_CATEGORIES.includes(a.category)),
    [summary],
  );

  // Data per non-Tarefa category
  const categoryData = useMemo(() => {
    if (activeTab === 'Tarefa') return null;
    return buildUserRows(filteredActivities, (a) => a.category === activeTab);
  }, [filteredActivities, activeTab]);

  // Tarefa data
  const tarefaData = useMemo(() => {
    if (activeTab !== 'Tarefa') return null;
    const tarefaActivities = filteredActivities.filter((a) => a.category === 'Tarefa');
    const completed = buildUserRows(tarefaActivities, (a) => a.event_type === 'task_completed');
    const created = buildUserRows(tarefaActivities, (a) => a.event_type === 'task_added');
    const pctConclusao =
      created.total === 0 ? 0 : Math.round((completed.total / created.total) * 100);
    return { completed, created, pctConclusao };
  }, [filteredActivities, activeTab]);

  // Mensagens por lead (via RPC)
  const { data: msgsLead = [] } = useMensagensPorLead(
    activeTab === 'Mensagem Enviada' ? fromStr : null,
    activeTab === 'Mensagem Enviada' ? toStr : null,
  );

  const msgsLeadData = useMemo(() => {
    if (activeTab !== 'Mensagem Enviada') return null;
    // Map user_id → user_name via activities
    const nameById = new Map<number, string>();
    for (const a of filteredActivities) nameById.set(a.user_id, a.user_name);

    const rows = msgsLead
      .filter((r) => nameById.has(r.user_id) && r.leads_distintos > 0)
      .map((r) => ({
        name: nameById.get(r.user_id)!,
        total_msgs: r.total_msgs,
        leads_distintos: r.leads_distintos,
        count: r.total_msgs / r.leads_distintos, // média msgs/lead
      }))
      .sort((a, b) => b.count - a.count);

    const totalMsgs = rows.reduce((s, r) => s + r.total_msgs, 0);
    const totalLeads = rows.reduce((s, r) => s + r.leads_distintos, 0);
    const mediaGeral = totalLeads === 0 ? 0 : totalMsgs / totalLeads;
    const avg = rows.length === 0 ? 0 : rows.reduce((s, r) => s + r.count, 0) / rows.length;
    return { rows, mediaGeral, avg, totalLeads };
  }, [activeTab, msgsLead, filteredActivities]);

  // Top campos alterados (via RPC)
  const { data: topCampos = [] } = useTopCamposAlterados(
    activeTab === 'Campo alterado' ? fromStr : null,
    activeTab === 'Campo alterado' ? toStr : null,
    20,
  );

  const topCamposData = useMemo(() => {
    if (activeTab !== 'Campo alterado') return null;
    return topCampos.map((c) => ({ name: c.campo_nome, count: c.total }));
  }, [activeTab, topCampos]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Detalhamento por Categoria</h2>
        <div className="card-glass p-1 rounded-xl flex flex-wrap gap-1">
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
      </div>

      {activeTab === 'Tarefa' && tarefaData && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiCard label="Tarefas Concluídas" value={tarefaData.completed.total} />
            <KpiCard label="Tarefas Criadas" value={tarefaData.created.total} />
            <KpiCard
              label="% Conclusão"
              value={`${tarefaData.pctConclusao}%`}
              hint="Concluídas ÷ Criadas no mesmo período × 100"
            />
          </div>

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
              barColor="hsl(142, 60%, 50%)"
            />
          </div>

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
              barColor="hsl(263, 70%, 58%)"
            />
          </div>
        </>
      )}

      {activeTab === 'Mensagem Enviada' && categoryData && msgsLeadData && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiCard
              label={CATEGORY_LABELS[activeTab]}
              value={categoryData.total}
            />
            <KpiCard
              label="Média por Usuário"
              value={
                categoryData.uniqueUsers === 0
                  ? 0
                  : Math.round(categoryData.total / categoryData.uniqueUsers)
              }
            />
            <KpiCard
              label="Mensagens por Lead (time)"
              value={msgsLeadData.mediaGeral.toFixed(1).replace('.', ',')}
              hint={`Total msgs ÷ ${msgsLeadData.totalLeads.toLocaleString('pt-BR')} leads distintos`}
            />
          </div>

          <div className="card-glass p-4 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-foreground">
                Mensagem Enviada por Usuário
              </h3>
              <p className="text-xs text-muted-foreground">
                Linha tracejada = média ({categoryData.avg.toLocaleString('pt-BR')})
              </p>
            </div>
            <HorizontalBarChart
              data={categoryData.rows}
              avg={categoryData.avg}
              barColor={CATEGORY_COLORS[activeTab] || 'hsl(263, 70%, 58%)'}
            />
          </div>

          <div className="card-glass p-4 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  Mensagens por Lead por Usuário
                </h3>
                <p className="text-[10px] text-muted-foreground">
                  Média = total de msgs enviadas pelo vendedor ÷ leads distintos que receberam msg
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Linha tracejada = média do time ({msgsLeadData.mediaGeral.toFixed(1).replace('.', ',')})
              </p>
            </div>
            <HorizontalBarChart
              data={msgsLeadData.rows}
              avg={msgsLeadData.mediaGeral}
              barColor="hsl(263, 70%, 58%)"
              formatValue={(v) => v.toFixed(1).replace('.', ',')}
            />
          </div>
        </>
      )}

      {activeTab === 'Campo alterado' && categoryData && topCamposData && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <KpiCard label={CATEGORY_LABELS[activeTab]} value={categoryData.total} />
            <KpiCard
              label="Média por Usuário"
              value={
                categoryData.uniqueUsers === 0
                  ? 0
                  : Math.round(categoryData.total / categoryData.uniqueUsers)
              }
            />
          </div>

          <div className="card-glass p-4 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-foreground">Campo alterado por Usuário</h3>
              <p className="text-xs text-muted-foreground">
                Linha tracejada = média ({categoryData.avg.toLocaleString('pt-BR')})
              </p>
            </div>
            <HorizontalBarChart
              data={categoryData.rows}
              avg={categoryData.avg}
              barColor={CATEGORY_COLORS[activeTab] || 'hsl(200, 70%, 55%)'}
            />
          </div>

          <div className="card-glass p-4 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-foreground">
                Top Campos Alterados no Período
              </h3>
              <p className="text-xs text-muted-foreground">
                Somente campos da whitelist ({topCamposData.length} principais)
              </p>
            </div>
            <HorizontalBarChart
              data={topCamposData}
              avg={0}
              barColor="hsl(200, 70%, 55%)"
            />
          </div>
        </>
      )}

      {activeTab !== 'Tarefa' &&
        activeTab !== 'Mensagem Enviada' &&
        activeTab !== 'Campo alterado' &&
        categoryData && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <KpiCard label={CATEGORY_LABELS[activeTab] || 'Total'} value={categoryData.total} />
              <KpiCard
                label="Média por Usuário"
                value={
                  categoryData.uniqueUsers === 0
                    ? 0
                    : Math.round(categoryData.total / categoryData.uniqueUsers)
                }
              />
            </div>

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
