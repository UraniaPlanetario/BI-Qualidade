import { useMemo } from 'react';
import { Loader2, Info } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine, LabelList } from 'recharts';
import {
  useActiveConsultores,
  useOpenTasks,
  useCamposAlteradosFiltered,
  useLeadsAtribuidosPeriodo,
} from '../hooks/useConsistenciaData';
import { UserActivity } from '../types';

const EXCLUDED_CATEGORIES = new Set(['Tag', 'Vinculacao', 'Outros', 'Campo alterado']);

const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: 'hsl(240, 10%, 10%)', border: 'none', borderRadius: 8 },
  itemStyle: { color: '#fff' },
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

interface Row {
  user_id: number;
  user_name: string;
  acoes_por_lead: number;
  posicao: number;
  percentil: number;
  faixa: 'Top 25%' | 'Acima da Mediana' | 'Abaixo da Mediana' | 'Bottom 25%';
}

const FAIXA_COLORS: Record<Row['faixa'], string> = {
  'Top 25%': 'hsl(142, 60%, 50%)',
  'Acima da Mediana': 'hsl(142, 45%, 55%)',
  'Abaixo da Mediana': 'hsl(25, 80%, 55%)',
  'Bottom 25%': 'hsl(0, 72%, 51%)',
};

interface Props {
  activities: UserActivity[];
  selectedUsers: string[];
  dateRange: { from: Date; to: Date };
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

export function RankingPercentilBlock({ activities, selectedUsers, dateRange }: Props) {
  const fromStr = toDateStr(dateRange.from);
  const toStr = toDateStr(dateRange.to);
  const { data: consultores = [], isLoading: loadingUsers } = useActiveConsultores();
  const { data: openTasks = [], isLoading: loadingTasks } = useOpenTasks();
  const { data: camposFiltered = {}, isLoading: loadingCampos } = useCamposAlteradosFiltered(fromStr, toStr);
  const { data: leadsAtribuidos = {}, isLoading: loadingAtrib } = useLeadsAtribuidosPeriodo(fromStr, toStr);

  const { rows, p25, p50, p75 } = useMemo(() => {
    if (consultores.length === 0) return { rows: [], p25: 0, p50: 0, p75: 0 };

    const acoesCount = new Map<number, number>();
    for (const a of activities) {
      if (EXCLUDED_CATEGORIES.has(a.category)) continue;
      acoesCount.set(a.user_id, (acoesCount.get(a.user_id) || 0) + a.activity_count);
    }
    for (const [uidStr, count] of Object.entries(camposFiltered)) {
      const uid = Number(uidStr);
      acoesCount.set(uid, (acoesCount.get(uid) || 0) + count);
    }

    const base = consultores.map((u) => {
      const leads = leadsAtribuidos[u.id] || 0;
      const acoes = acoesCount.get(u.id) || 0;
      return {
        user_id: u.id,
        user_name: u.name,
        acoes_por_lead: leads > 0 ? acoes / leads : 0,
      };
    });

    const sorted = [...base.map((b) => b.acoes_por_lead)].sort((a, b) => a - b);
    const p25v = percentile(sorted, 25);
    const p50v = percentile(sorted, 50);
    const p75v = percentile(sorted, 75);

    const ordered = [...base].sort((a, b) => b.acoes_por_lead - a.acoes_por_lead);
    const total = ordered.length;
    const rows: Row[] = ordered.map((b, i) => {
      const posicao = i + 1;
      const percentilValue = total > 1 ? ((total - posicao) / (total - 1)) * 100 : 100;
      let faixa: Row['faixa'];
      if (b.acoes_por_lead >= p75v) faixa = 'Top 25%';
      else if (b.acoes_por_lead >= p50v) faixa = 'Acima da Mediana';
      else if (b.acoes_por_lead >= p25v) faixa = 'Abaixo da Mediana';
      else faixa = 'Bottom 25%';
      return { ...b, posicao, percentil: percentilValue, faixa };
    });

    return { rows, p25: p25v, p50: p50v, p75: p75v };
  }, [consultores, activities, camposFiltered, leadsAtribuidos]);

  const loading = loadingUsers || loadingTasks || loadingCampos || loadingAtrib;
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  const displayedRows = useMemo(() => {
    if (selectedUsers.length === 0) return rows;
    const set = new Set(selectedUsers);
    return rows.filter((r) => set.has(r.user_name));
  }, [rows, selectedUsers]);

  const chartData = displayedRows.map((r) => ({
    name: r.user_name,
    value: r.acoes_por_lead,
    faixa: r.faixa,
  }));

  return (
    <div className="space-y-6">
      <div className="card-glass p-4 rounded-xl">
        <div className="flex items-start gap-3">
          <Info className="text-primary flex-shrink-0 mt-0.5" size={18} />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Ranking relativo ao time</p>
            <p>
              Compara cada vendedor pela métrica <strong>ações/lead</strong> contra os percentis do
              próprio time no período selecionado. Diferente da classificação por faixas fixas, aqui
              o ponto de corte se ajusta conforme o desempenho do grupo.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card-glass p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">P25 (quartil inferior)</p>
          <p className="text-2xl font-bold text-foreground">{p25.toFixed(2).replace('.', ',')}</p>
        </div>
        <div className="card-glass p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">P50 (mediana)</p>
          <p className="text-2xl font-bold text-foreground">{p50.toFixed(2).replace('.', ',')}</p>
        </div>
        <div className="card-glass p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">P75 (quartil superior)</p>
          <p className="text-2xl font-bold text-foreground">{p75.toFixed(2).replace('.', ',')}</p>
        </div>
      </div>

      <div className="card-glass p-4 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-foreground">Ações por Lead — Time</h3>
          <div className="flex flex-wrap gap-3">
            {(['Top 25%', 'Acima da Mediana', 'Abaixo da Mediana', 'Bottom 25%'] as Row['faixa'][]).map(
              (f) => (
                <div key={f} className="flex items-center gap-1.5">
                  <div
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: FAIXA_COLORS[f] }}
                  />
                  <span className="text-xs text-muted-foreground">{f}</span>
                </div>
              ),
            )}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 36)}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 140, right: 60 }}>
            <XAxis
              type="number"
              stroke="hsl(240, 5%, 65%)"
              tick={{ fill: 'hsl(240, 5%, 65%)', fontSize: 12 }}
            />
            <YAxis
              type="category"
              dataKey="name"
              stroke="hsl(240, 5%, 65%)"
              width={135}
              tick={{ fill: 'hsl(240, 5%, 65%)', fontSize: 12 }}
            />
            <Tooltip
              {...TOOLTIP_STYLE}
              formatter={(v: number) => [v.toFixed(2).replace('.', ','), 'Ações/Lead']}
            />
            <ReferenceLine x={p25} stroke="hsl(240, 5%, 50%)" strokeDasharray="3 3" label={{ value: 'P25', fill: 'hsl(240, 5%, 65%)', fontSize: 10 }} />
            <ReferenceLine x={p50} stroke="hsl(240, 5%, 50%)" strokeDasharray="3 3" label={{ value: 'P50', fill: 'hsl(240, 5%, 65%)', fontSize: 10 }} />
            <ReferenceLine x={p75} stroke="hsl(240, 5%, 50%)" strokeDasharray="3 3" label={{ value: 'P75', fill: 'hsl(240, 5%, 65%)', fontSize: 10 }} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={FAIXA_COLORS[d.faixa]} />
              ))}
              <LabelList
                dataKey="value"
                position="right"
                fill="hsl(240, 5%, 65%)"
                fontSize={11}
                fontWeight={600}
                formatter={(v: number) => v.toFixed(2).replace('.', ',')}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card-glass p-4 rounded-xl overflow-x-auto">
        <h3 className="text-base font-semibold text-foreground mb-4">Ranking Detalhado</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground font-medium">
              <th className="text-left py-2 px-3">#</th>
              <th className="text-left py-2 px-3">Vendedor</th>
              <th className="text-right py-2 px-3">Ações/Lead</th>
              <th className="text-right py-2 px-3">Percentil</th>
              <th className="text-left py-2 px-3">Faixa</th>
            </tr>
          </thead>
          <tbody>
            {displayedRows.map((r) => (
              <tr
                key={r.user_id}
                className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
              >
                <td className="py-2 px-3 text-foreground font-medium">{r.posicao}</td>
                <td className="py-2 px-3 text-foreground">{r.user_name}</td>
                <td className="py-2 px-3 text-right text-foreground font-medium">
                  {r.acoes_por_lead.toFixed(2).replace('.', ',')}
                </td>
                <td className="py-2 px-3 text-right text-foreground">
                  P{r.percentil.toFixed(0)}
                </td>
                <td className="py-2 px-3">
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: FAIXA_COLORS[r.faixa] + '33',
                      color: FAIXA_COLORS[r.faixa],
                    }}
                  >
                    {r.faixa}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default RankingPercentilBlock;
