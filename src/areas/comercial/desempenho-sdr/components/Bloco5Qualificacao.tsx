import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  Legend,
  CartesianGrid,
} from 'recharts';
import { MovimentoLead, SDR, formatNumber, formatPct } from '../types';
import { TOOLTIP_STYLE, COLORS } from './_helpers';

interface Props {
  movimentos: MovimentoLead[];
  leads: any[];
  sdrs: SDR[];
}

const RECEPCAO = 'Recepção Leads Insta';
const VENDAS_WPP = 'Vendas WhatsApp';

function isQualificadoSDR(status?: string | null): boolean {
  if (!status) return false;
  return status.toLowerCase().startsWith('qualificado sdr');
}

export function Bloco5Qualificacao({ movimentos, sdrs }: Props) {
  const sdrNames = useMemo(() => new Set(sdrs.map((s) => s.nome)), [sdrs]);

  // Leads recebidos pelo time = leads que entraram no pipeline RECEPCAO no período (pipeline_to = RECEPCAO)
  const leadsRecebidos = useMemo(() => {
    const set = new Set<number>();
    for (const m of movimentos) {
      if (m.pipeline_to === RECEPCAO) set.add(m.lead_id);
    }
    return set;
  }, [movimentos]);

  // Movimentos de qualificação: transição RECEPCAO -> VENDAS_WPP OU status_to começa com "Qualificado SDR"
  const movimentosQualificacao = useMemo(() => {
    return movimentos.filter((m) => {
      const movedFromRec = m.pipeline_from === RECEPCAO && m.pipeline_to === VENDAS_WPP;
      const isQual = isQualificadoSDR(m.status_to);
      return movedFromRec || isQual;
    });
  }, [movimentos]);

  // Leads qualificados que TAMBÉM foram recebidos no mesmo período (evita taxa > 100%)
  const leadsQualificados = useMemo(() => {
    const set = new Set<number>();
    for (const m of movimentosQualificacao) {
      if (leadsRecebidos.has(m.lead_id)) set.add(m.lead_id);
    }
    return set;
  }, [movimentosQualificacao, leadsRecebidos]);

  // 5.1 KPI taxa de qualificação
  const taxaQualificacao = useMemo(() => {
    const total = leadsRecebidos.size;
    const qualificados = leadsQualificados.size;
    return {
      total,
      qualificados,
      taxa: total > 0 ? (qualificados / total) * 100 : 0,
    };
  }, [leadsRecebidos, leadsQualificados]);

  // 5.2 taxa por SDR (moved_by da movimentação de qualificação)
  // Denominador por SDR: seria leads atribuídos ao SDR. Aproximação: contar leads qualificados por SDR como numerador
  // e usar como denominador o total de leads recebidos no período dividido proporcionalmente?
  // Melhor: usar numerador = leads qualificados por SDR, denominador = todos os leads qualificados por este SDR
  // Interpretação direta: taxa = qualificados_do_sdr / leads_que_o_sdr_atuou
  // Como não temos atribuição clara, usamos: para cada SDR, seus leads qualificados / total de leads recebidos
  // Essa métrica reflete "contribuição para a qualificação total"
  const taxaPorSdr = useMemo(() => {
    const qualPorSdr: Record<string, Set<number>> = {};
    for (const m of movimentosQualificacao) {
      const sdr = m.moved_by;
      if (!sdr || !sdrNames.has(sdr)) continue;
      // Só conta se o lead foi recebido no período
      if (!leadsRecebidos.has(m.lead_id)) continue;
      if (!qualPorSdr[sdr]) qualPorSdr[sdr] = new Set();
      qualPorSdr[sdr].add(m.lead_id);
    }
    const total = leadsRecebidos.size || 1;
    return Object.entries(qualPorSdr)
      .map(([sdr, leads]) => ({
        sdr,
        qualificados: leads.size,
        taxa: (leads.size / total) * 100,
      }))
      .sort((a, b) => b.taxa - a.taxa);
  }, [movimentosQualificacao, sdrNames, leadsRecebidos]);

  // 5.3 Taxa mensal + total leads criados por mês
  const serieMensal = useMemo(() => {
    // Leads recebidos por mês
    const recebidosPorMes: Record<string, Set<number>> = {};
    for (const m of movimentos) {
      if (m.pipeline_to === RECEPCAO) {
        const d = new Date(m.moved_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!recebidosPorMes[key]) recebidosPorMes[key] = new Set();
        recebidosPorMes[key].add(m.lead_id);
      }
    }
    // Qualificados por mês (apenas dos que foram recebidos no mesmo mês)
    const qualificadosPorMes: Record<string, Set<number>> = {};
    for (const m of movimentosQualificacao) {
      const d = new Date(m.moved_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      // Só conta se o lead foi recebido no mesmo mês
      if (!recebidosPorMes[key]?.has(m.lead_id)) continue;
      if (!qualificadosPorMes[key]) qualificadosPorMes[key] = new Set();
      qualificadosPorMes[key].add(m.lead_id);
    }
    const allKeys = new Set([
      ...Object.keys(recebidosPorMes),
      ...Object.keys(qualificadosPorMes),
    ]);
    return Array.from(allKeys)
      .sort()
      .map((key) => {
        const rec = recebidosPorMes[key]?.size || 0;
        const qual = qualificadosPorMes[key]?.size || 0;
        return {
          mes: key,
          leadsRecebidos: rec,
          leadsQualificados: qual,
          taxa: rec > 0 ? (qual / rec) * 100 : 0,
        };
      });
  }, [movimentos, movimentosQualificacao]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-1">
          A — Conversão Pré-venda (Qualificação)
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          Leads qualificados = movidos de "Recepção Leads Insta" para "Vendas WhatsApp" ou
          passaram pela etapa "Qualificado SDR"
        </p>
      </div>

      {/* 5.1 KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-glass p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Taxa de Qualificação</p>
          <p className="text-4xl font-bold text-foreground">{formatPct(taxaQualificacao.taxa)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatNumber(taxaQualificacao.qualificados)} de{' '}
            {formatNumber(taxaQualificacao.total)} leads
          </p>
        </div>
        <div className="card-glass p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Leads Recebidos</p>
          <p className="text-4xl font-bold text-foreground">
            {formatNumber(taxaQualificacao.total)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Entradas em Recepção Leads Insta</p>
        </div>
        <div className="card-glass p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Leads Qualificados</p>
          <p className="text-4xl font-bold text-foreground">
            {formatNumber(taxaQualificacao.qualificados)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Leads que passaram da qualificação</p>
        </div>
      </div>

      {/* 5.2 taxa por SDR */}
      <div className="card-glass p-4 rounded-xl">
        <h3 className="text-base font-semibold text-foreground mb-4">Taxa de Qualificação por SDR</h3>
        {taxaPorSdr.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum SDR qualificou leads no período.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(240, taxaPorSdr.length * 36)}>
            <BarChart
              data={taxaPorSdr}
              layout="vertical"
              margin={{ left: 20, right: 60, top: 10, bottom: 10 }}
            >
              <CartesianGrid stroke="hsl(240, 4%, 16%)" horizontal={false} />
              <XAxis
                type="number"
                stroke={COLORS.muted}
                tick={{ fill: COLORS.muted, fontSize: 12 }}
                tickFormatter={(v) => `${v}%`}
              />
              <YAxis
                type="category"
                dataKey="sdr"
                stroke={COLORS.muted}
                tick={{ fill: COLORS.muted, fontSize: 12 }}
                width={120}
              />
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={(value: number, _name: string, p: any) => [
                  `${formatPct(value)} (${formatNumber(p.payload.qualificados)} leads)`,
                  'Taxa',
                ]}
              />
              <Bar dataKey="taxa" fill={COLORS.green} radius={[0, 4, 4, 0]}>
                <LabelList
                  dataKey="taxa"
                  position="right"
                  fill={COLORS.muted}
                  fontSize={11}
                  formatter={(v: number) => formatPct(v)}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 5.3 Linha mensal + barras de leads criados */}
      <div className="card-glass p-4 rounded-xl">
        <h3 className="text-base font-semibold text-foreground mb-4">
          Evolução Mensal — Taxa e Leads Recebidos
        </h3>
        {serieMensal.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Sem dados no período selecionado.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={serieMensal} margin={{ left: 10, right: 10, top: 20, bottom: 10 }}>
              <CartesianGrid stroke="hsl(240, 4%, 16%)" />
              <XAxis
                dataKey="mes"
                stroke={COLORS.muted}
                tick={{ fill: COLORS.muted, fontSize: 11 }}
              />
              <YAxis
                yAxisId="left"
                stroke={COLORS.muted}
                tick={{ fill: COLORS.muted, fontSize: 12 }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke={COLORS.muted}
                tick={{ fill: COLORS.muted, fontSize: 12 }}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={(value: number, name: string) => {
                  if (name === 'Taxa') return [formatPct(value), name];
                  return [formatNumber(value), name];
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: COLORS.muted }} />
              <Bar
                yAxisId="left"
                dataKey="leadsRecebidos"
                name="Leads Recebidos"
                fill={COLORS.purple}
                radius={[4, 4, 0, 0]}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="taxa"
                name="Taxa"
                stroke={COLORS.gold}
                strokeWidth={2}
                dot={{ r: 4, fill: COLORS.gold }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* B — Conversão para venda (placeholder) */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-1">
          B — Conversão para Venda
        </h2>
        <div className="card-glass p-8 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">
            Em breve — depende de dados de fechamento.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Bloco5Qualificacao;
