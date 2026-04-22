import { useMemo } from 'react';
import { Loader2, Info } from 'lucide-react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  ActivitySummary,
  useActiveConsultores,
  useClosedLeadsPeriodo,
  useLeadsAtribuidosPeriodo,
} from '../hooks/useConsistenciaData';
import {
  ConsistenciaVendedor,
  classifyConsistencia,
  CLASSIFICACAO_COLORS,
  ClassificacaoCRM,
} from '../types';

const EXCLUDED_CATEGORIES = new Set(['Tag', 'Vinculacao', 'Outros']);

const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: 'hsl(240, 10%, 10%)', border: 'none', borderRadius: 8 },
  itemStyle: { color: '#fff' },
};

const CLASSIFICACAO_ORDER: ClassificacaoCRM[] = [
  'Extremamente Baixa',
  'Baixa',
  'Moderada',
  'Boa',
];

const CLASSIFICACAO_NUM: Record<ClassificacaoCRM, number> = {
  'Extremamente Baixa': 1,
  'Baixa': 2,
  'Moderada': 3,
  'Boa': 4,
};

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

interface Props {
  summary: ActivitySummary[];
  selectedUsers: string[];
  dateRange: { from: Date; to: Date };
}

export function ConsistenciaCRMBlock({ summary, selectedUsers, dateRange }: Props) {
  const fromStr = toDateStr(dateRange.from);
  const toStr = toDateStr(dateRange.to);

  const { data: consultores = [], isLoading: loadingUsers } = useActiveConsultores();
  const { data: closedLeads = [], isLoading: loadingClosed } = useClosedLeadsPeriodo(fromStr, toStr);
  const { data: leadsAtribuidos = {}, isLoading: loadingAtrib } = useLeadsAtribuidosPeriodo(fromStr, toStr);

  const allRows = useMemo<ConsistenciaVendedor[]>(() => {
    if (consultores.length === 0) return [];

    const idByName = new Map<string, number>();
    for (const u of consultores) idByName.set(u.name, u.id);

    const closedCount = new Map<number, number>();
    for (const c of closedLeads) {
      if (!c.vendedor) continue;
      const uid = idByName.get(c.vendedor);
      if (uid == null) continue;
      closedCount.set(uid, (closedCount.get(uid) || 0) + 1);
    }

    const acoesPorVendedor = new Map<number, number>();
    for (const a of summary) {
      if (EXCLUDED_CATEGORIES.has(a.category)) continue;
      acoesPorVendedor.set(a.user_id, (acoesPorVendedor.get(a.user_id) || 0) + a.total);
    }

    const out: ConsistenciaVendedor[] = [];
    for (const u of consultores) {
      const acoes = acoesPorVendedor.get(u.id) || 0;
      const leadsPeriodo = leadsAtribuidos[u.id] || 0;
      const acoesPorLead = leadsPeriodo > 0 ? acoes / leadsPeriodo : 0;
      out.push({
        user_id: u.id,
        user_name: u.name,
        leads_no_periodo: leadsPeriodo,
        leads_abertos_atual: 0,
        leads_fechados_periodo: closedCount.get(u.id) || 0,
        tarefas_em_atraso: 0,
        sem_tarefa: 0,
        atraso_fim_funil: 0,
        acoes_periodo: acoes,
        acoes_por_lead: acoesPorLead,
        classificacao: classifyConsistencia(acoesPorLead),
      });
    }
    return out.sort((a, b) => b.acoes_por_lead - a.acoes_por_lead);
  }, [consultores, closedLeads, summary, leadsAtribuidos]);

  const rows = useMemo(() => {
    if (selectedUsers.length === 0) return allRows;
    const set = new Set(selectedUsers);
    return allRows.filter((r) => set.has(r.user_name));
  }, [allRows, selectedUsers]);

  const classificacaoSummary = useMemo(() => {
    const counts: Record<ClassificacaoCRM, number> = {
      'Boa': 0,
      'Moderada': 0,
      'Baixa': 0,
      'Extremamente Baixa': 0,
    };
    for (const r of rows) counts[r.classificacao] += 1;
    return counts;
  }, [rows]);

  const loading = loadingUsers || loadingClosed || loadingAtrib;
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  const scatterData = rows.map((r) => ({
    name: r.user_name,
    leads: r.leads_no_periodo,
    fechamentos: r.leads_fechados_periodo,
    classificacao: r.classificacao,
    classificacaoNum: CLASSIFICACAO_NUM[r.classificacao],
    fill: CLASSIFICACAO_COLORS[r.classificacao],
  }));

  return (
    <div className="space-y-6">
      <div className="card-glass p-4 rounded-xl">
        <div className="flex items-start gap-3">
          <Info className="text-primary flex-shrink-0 mt-0.5" size={18} />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Como o score é calculado</p>
            <p>
              <strong>Score = Ações no período ÷ Leads no período</strong>. "Leads no período" =
              leads únicos em que o vendedor foi responsável em algum momento do intervalo
              filtrado, no pipeline <strong>Vendas WhatsApp</strong> (reconstruído a partir de{' '}
              <em>entity_responsible_changed</em>; um lead que trocou de dono conta para ambos —
              dupla contagem intencional). Classificação por faixas fixas:
            </p>
            <ul className="mt-2 space-y-0.5">
              <li>
                <span className="font-medium" style={{ color: CLASSIFICACAO_COLORS['Boa'] }}>
                  Boa
                </span>{' '}
                ≥ 3,0 ações/lead
              </li>
              <li>
                <span className="font-medium" style={{ color: CLASSIFICACAO_COLORS['Moderada'] }}>
                  Moderada
                </span>{' '}
                1,5 – 3,0
              </li>
              <li>
                <span className="font-medium" style={{ color: CLASSIFICACAO_COLORS['Baixa'] }}>
                  Baixa
                </span>{' '}
                0,7 – 1,5
              </li>
              <li>
                <span
                  className="font-medium"
                  style={{ color: CLASSIFICACAO_COLORS['Extremamente Baixa'] }}
                >
                  Extremamente Baixa
                </span>{' '}
                &lt; 0,7
              </li>
            </ul>
            <p className="mt-1 text-xs">
              Ações contadas: mensagens, movimentações, ligações, notas, tarefas criadas/concluídas
              e alterações em campos da whitelist (ver <code>config.dim_campos</code>). Categorias
              Tag, Vinculação e Outros excluídas. Task events de edição (texto, prazo, tipo) não
              contam — só criação e conclusão.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(['Boa', 'Moderada', 'Baixa', 'Extremamente Baixa'] as ClassificacaoCRM[]).map((c) => (
          <div key={c} className="card-glass p-4 rounded-xl text-center">
            <p className="text-sm text-muted-foreground">{c}</p>
            <p
              className="text-3xl font-bold"
              style={{ color: CLASSIFICACAO_COLORS[c] }}
            >
              {classificacaoSummary[c]}
            </p>
            <p className="text-xs text-muted-foreground mt-1">vendedores</p>
          </div>
        ))}
      </div>

      <div className="card-glass p-4 rounded-xl overflow-x-auto">
        <h3 className="text-base font-semibold text-foreground mb-4">Consistência por Vendedor</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground font-medium">
              <th className="text-left py-2 px-3">Vendedor</th>
              <th className="text-right py-2 px-3">Leads no Período</th>
              <th className="text-right py-2 px-3">Fechados no Período</th>
              <th className="text-right py-2 px-3">Ações no Período</th>
              <th className="text-right py-2 px-3">Ações/Lead</th>
              <th className="text-left py-2 px-3">Classificação</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.user_id}
                className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
              >
                <td className="py-2 px-3 text-foreground font-medium">{r.user_name}</td>
                <td className="py-2 px-3 text-right text-foreground">
                  {r.leads_no_periodo.toLocaleString('pt-BR')}
                </td>
                <td className="py-2 px-3 text-right text-foreground">
                  {r.leads_fechados_periodo.toLocaleString('pt-BR')}
                </td>
                <td className="py-2 px-3 text-right text-foreground">
                  {r.acoes_periodo.toLocaleString('pt-BR')}
                </td>
                <td className="py-2 px-3 text-right text-foreground font-medium">
                  {r.acoes_por_lead.toFixed(2).replace('.', ',')}
                </td>
                <td className="py-2 px-3">
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: CLASSIFICACAO_COLORS[r.classificacao] + '33',
                      color: CLASSIFICACAO_COLORS[r.classificacao],
                    }}
                  >
                    {r.classificacao}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ScatterCard
          title="Leads no Período × Fechamentos"
          data={scatterData}
          xKey="leads"
          xLabel="Leads no Período"
          yKey="fechamentos"
          yLabel="Fechados no Período"
        />
        <ScatterCard
          title="Leads no Período × Classificação"
          data={scatterData}
          xKey="leads"
          xLabel="Leads no Período"
          yKey="classificacaoNum"
          yLabel="Classificação"
          yIsClassificacao
        />
        <ScatterCard
          title="Fechamentos × Classificação"
          data={scatterData}
          xKey="fechamentos"
          xLabel="Fechados no Período"
          yKey="classificacaoNum"
          yLabel="Classificação"
          yIsClassificacao
        />
      </div>
    </div>
  );
}

interface ScatterCardProps {
  title: string;
  data: Array<{
    name: string;
    leads: number;
    fechamentos: number;
    classificacao: ClassificacaoCRM;
    classificacaoNum: number;
    fill: string;
  }>;
  xKey: 'leads' | 'fechamentos';
  xLabel: string;
  yKey: 'leads' | 'fechamentos' | 'classificacaoNum';
  yLabel: string;
  yIsClassificacao?: boolean;
}

function ScatterCard({ title, data, xKey, xLabel, yKey, yLabel, yIsClassificacao }: ScatterCardProps) {
  return (
    <div className="card-glass p-4 rounded-xl">
      <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
      <ResponsiveContainer width="100%" height={260}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: yIsClassificacao ? 100 : 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(240, 5%, 25%)" />
          <XAxis
            type="number"
            dataKey={xKey}
            name={xLabel}
            stroke="hsl(240, 5%, 65%)"
            tick={{ fill: 'hsl(240, 5%, 65%)', fontSize: 11 }}
            label={{
              value: xLabel,
              position: 'insideBottom',
              offset: -15,
              fill: 'hsl(240, 5%, 65%)',
              fontSize: 11,
            }}
          />
          <YAxis
            type="number"
            dataKey={yKey}
            name={yLabel}
            stroke="hsl(240, 5%, 65%)"
            tick={{ fill: 'hsl(240, 5%, 65%)', fontSize: 11 }}
            domain={yIsClassificacao ? [0.5, 4.5] : ['auto', 'auto']}
            ticks={yIsClassificacao ? [1, 2, 3, 4] : undefined}
            tickFormatter={
              yIsClassificacao
                ? (v: number) => CLASSIFICACAO_ORDER[v - 1] ?? ''
                : undefined
            }
            width={yIsClassificacao ? 100 : 60}
          />
          <ZAxis range={[80, 80]} />
          <Tooltip
            {...TOOLTIP_STYLE}
            cursor={{ strokeDasharray: '3 3' }}
            content={({ active, payload }) => {
              if (!active || !payload || !payload.length) return null;
              const d = payload[0].payload as (typeof data)[number];
              return (
                <div
                  style={{
                    backgroundColor: 'hsl(240, 10%, 10%)',
                    border: '1px solid hsl(240, 5%, 25%)',
                    borderRadius: 8,
                    padding: 10,
                    color: '#fff',
                    fontSize: 12,
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{d.name}</div>
                  <div>Leads: {d.leads.toLocaleString('pt-BR')}</div>
                  <div>Fechamentos: {d.fechamentos.toLocaleString('pt-BR')}</div>
                  <div>
                    Classificação:{' '}
                    <span style={{ color: CLASSIFICACAO_COLORS[d.classificacao] }}>
                      {d.classificacao}
                    </span>
                  </div>
                </div>
              );
            }}
          />
          <Scatter data={data}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.fill} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

export default ConsistenciaCRMBlock;
