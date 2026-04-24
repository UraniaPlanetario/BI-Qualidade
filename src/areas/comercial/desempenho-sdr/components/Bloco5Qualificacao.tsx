import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
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
import { MovimentoLead, SDR, formatNumber, formatPct, isQualificadoSDRById } from '../types';
import { useLeadsSDRMap } from '../hooks/useDesempenhoSDR';
import { TOOLTIP_STYLE, COLORS } from './_helpers';

interface Props {
  movimentos: MovimentoLead[];
  leads: any[];
  sdrs: SDR[];
}

const RECEPCAO = 'Recepção Leads Insta';
const VENDAS_WPP = 'Vendas WhatsApp';

type Canal = 'insta' | 'whatsapp' | 'geral';
const CANAIS: { id: Canal; label: string }[] = [
  { id: 'geral', label: 'Geral' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'insta', label: 'Instagram' },
];

interface CanalStats {
  leadsRecebidos: Set<number>;
  leadsQualificados: Set<number>;
  qualPorSdr: Record<string, Set<number>>;
  serieMensal: Array<{ mes: string; leadsRecebidos: number; leadsQualificados: number; taxa: number }>;
}

export function Bloco5Qualificacao({ movimentos, sdrs }: Props) {
  const sdrNames = useMemo(() => new Set(sdrs.map((s) => s.nome)), [sdrs]);
  const [canal, setCanal] = useState<Canal>('geral');
  const { data: sdrMap } = useLeadsSDRMap();

  // Classifica cada lead: qual é o canal onde ele foi CRIADO.
  // Pré-requisito do prop `movimentos`: já vem filtrado por lead_created_at no período
  // (via useMovimentosLeadsCriados). Base = leads nascidos no canal.
  const stats = useMemo<Record<Canal, CanalStats>>(() => {
    const insta = new Set<number>();     // lead criado em Recepção Leads Insta
    const whatsapp = new Set<number>();  // lead criado em Vendas WhatsApp

    // Primeiro movimento de cada lead (por ordem cronológica dos dados recebidos)
    const firstMovByLead = new Map<number, MovimentoLead>();
    for (const m of movimentos) {
      const cur = firstMovByLead.get(m.lead_id);
      if (!cur || new Date(m.moved_at) < new Date(cur.moved_at)) firstMovByLead.set(m.lead_id, m);
    }
    for (const [leadId, m] of firstMovByLead) {
      // Lead "criado" em um pipeline = primeiro movimento com pipeline_from NULL
      // (Kommo grava um evento sintético de criação). Alternativa: se o primeiro
      // movimento conhecido já é em Insta/Vendas, assume criação lá.
      if (m.pipeline_from === null) {
        if (m.pipeline_to === RECEPCAO) insta.add(leadId);
        else if (m.pipeline_to === VENDAS_WPP) whatsapp.add(leadId);
      } else {
        // Fallback: considerar o primeiro pipeline observado
        if (m.pipeline_from === RECEPCAO || m.pipeline_to === RECEPCAO) insta.add(leadId);
        else if (m.pipeline_from === VENDAS_WPP || m.pipeline_to === VENDAS_WPP) whatsapp.add(leadId);
      }
    }
    const geral = new Set<number>([...insta, ...whatsapp]);

    // Movimentos de qualificação (os mesmos para qualquer canal)
    const isQualMov = (m: MovimentoLead) =>
      (m.pipeline_from === RECEPCAO && m.pipeline_to === VENDAS_WPP) ||
      isQualificadoSDRById(m.status_to_id);

    // Lead qualificado → SDR via custom field (cubo_leads_consolidado.sdr).
    // Se o lead não tem SDR preenchido, fica fora do cômputo "por SDR".
    const qualificados = new Set<number>();            // todos qualificados (inclui sem SDR)
    const qualificadosComSdr = new Set<number>();       // qualificados com SDR identificado
    const qualPorSdrAll: Record<string, Set<number>> = {};
    for (const m of movimentos) {
      if (!isQualMov(m)) continue;
      qualificados.add(m.lead_id);
      const sdr = sdrMap?.get(m.lead_id);
      if (sdr && sdrNames.has(sdr)) {
        qualificadosComSdr.add(m.lead_id);
        if (!qualPorSdrAll[sdr]) qualPorSdrAll[sdr] = new Set();
        qualPorSdrAll[sdr].add(m.lead_id);
      }
    }

    const build = (leadsSet: Set<number>): CanalStats => {
      // Numerador: apenas qualificações com SDR identificado (gráfico de desempenho de SDRs)
      const q = new Set<number>();
      for (const id of qualificadosComSdr) if (leadsSet.has(id)) q.add(id);
      const qSdr: Record<string, Set<number>> = {};
      for (const [sdr, ids] of Object.entries(qualPorSdrAll)) {
        const inter = new Set<number>();
        for (const id of ids) if (leadsSet.has(id)) inter.add(id);
        if (inter.size > 0) qSdr[sdr] = inter;
      }

      // Série mensal — bucket pelo mês de CRIAÇÃO do lead (denominador coerente com a base).
      const recebidosPorMes: Record<string, Set<number>> = {};
      // Mapa lead_id → created_at (usa o primeiro movimento)
      const createdByLead = new Map<number, string>();
      for (const m of movimentos) {
        if (!leadsSet.has(m.lead_id)) continue;
        const created = m.lead_created_at || m.moved_at;
        if (!createdByLead.has(m.lead_id)) createdByLead.set(m.lead_id, created);
      }
      for (const [leadId, created] of createdByLead) {
        const d = new Date(created);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!recebidosPorMes[key]) recebidosPorMes[key] = new Set();
        recebidosPorMes[key].add(leadId);
      }

      // Qualificados por mês (mesmo mês de criação do lead)
      const qualPorMes: Record<string, Set<number>> = {};
      for (const m of movimentos) {
        if (!isQualMov(m)) continue;
        if (!leadsSet.has(m.lead_id)) continue;
        if (!qualificadosComSdr.has(m.lead_id)) continue;
        const created = createdByLead.get(m.lead_id);
        if (!created) continue;
        const d = new Date(created);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!qualPorMes[key]) qualPorMes[key] = new Set();
        qualPorMes[key].add(m.lead_id);
      }
      const keys = new Set([...Object.keys(recebidosPorMes), ...Object.keys(qualPorMes)]);
      const serieMensal = Array.from(keys)
        .sort()
        .map((key) => {
          const rec = recebidosPorMes[key]?.size || 0;
          const qual = qualPorMes[key]?.size || 0;
          return {
            mes: key,
            leadsRecebidos: rec,
            leadsQualificados: qual,
            taxa: rec > 0 ? (qual / rec) * 100 : 0,
          };
        });

      return { leadsRecebidos: leadsSet, leadsQualificados: q, qualPorSdr: qSdr, serieMensal };
    };

    return {
      insta: build(insta),
      whatsapp: build(whatsapp),
      geral: build(geral),
    };
  }, [movimentos, sdrNames, sdrMap]);

  const atual = stats[canal];
  const total = atual.leadsRecebidos.size;
  const qualificados = atual.leadsQualificados.size;
  const taxa = total > 0 ? (qualificados / total) * 100 : 0;

  const taxaPorSdr = useMemo(() => {
    return Object.entries(atual.qualPorSdr)
      .map(([sdr, ids]) => ({
        sdr,
        qualificados: ids.size,
        taxa: total > 0 ? (ids.size / total) * 100 : 0,
      }))
      .sort((a, b) => b.taxa - a.taxa);
  }, [atual, total]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-1">
          A — Conversão Pré-venda (Qualificação)
        </h2>
        <p className="text-xs text-muted-foreground mb-3">
          Qualificado = lead movido de <strong>Recepção Leads Insta → Vendas WhatsApp</strong> ou que
          passou pela etapa <strong>Qualificado SDR</strong> no funil de Vendas WhatsApp. Numerador considera
          apenas leads com o custom field <code>SDR</code> preenchido (qualificações atribuídas a um SDR humano).
        </p>

        {/* Tabs de canal */}
        <div className="card-glass p-1 rounded-xl inline-flex gap-1">
          {CANAIS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setCanal(id)}
              className={`px-4 py-1.5 rounded-lg text-xs transition-colors ${
                canal === id
                  ? 'bg-primary text-white font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-glass p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Taxa de Qualificação</p>
          <p className="text-4xl font-bold text-foreground">{formatPct(taxa)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatNumber(qualificados)} de {formatNumber(total)} leads
          </p>
        </div>
        <div className="card-glass p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Leads Recebidos</p>
          <p className="text-4xl font-bold text-foreground">{formatNumber(total)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {canal === 'insta' && 'Leads criados em Recepção Leads Insta'}
            {canal === 'whatsapp' && 'Leads criados em Vendas WhatsApp'}
            {canal === 'geral' && 'Soma Insta + WhatsApp (leads criados no canal)'}
          </p>
        </div>
        <div className="card-glass p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Leads Qualificados por SDR</p>
          <p className="text-4xl font-bold text-foreground">{formatNumber(qualificados)}</p>
          <p className="text-xs text-muted-foreground mt-1">Qualificados com SDR identificado no custom field</p>
        </div>
      </div>

      {/* Taxa de Qualificação por SDR */}
      <div className="card-glass p-4 rounded-xl">
        <div className="flex items-start justify-between mb-4 gap-4">
          <h3 className="text-base font-semibold text-foreground">Taxa de Qualificação por SDR</h3>
          <p className="text-[11px] text-muted-foreground italic text-right max-w-md">
            qualificados_do_sdr / leads_recebidos_no_canal. Atribuição usa o custom field <code>SDR</code> do lead (não <code>moved_by</code>).
          </p>
        </div>
        {taxaPorSdr.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum SDR qualificou leads no período neste canal.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(240, taxaPorSdr.length * 36)}>
            <BarChart data={taxaPorSdr} layout="vertical" margin={{ left: 20, right: 80, top: 10, bottom: 10 }}>
              <CartesianGrid stroke="hsl(240, 4%, 16%)" horizontal={false} />
              <XAxis type="number" stroke={COLORS.muted} tick={{ fill: COLORS.muted, fontSize: 12 }}
                tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="sdr" stroke={COLORS.muted} tick={{ fill: COLORS.muted, fontSize: 12 }}
                width={120} />
              <Tooltip {...TOOLTIP_STYLE}
                formatter={(value: number, _n: string, p: any) =>
                  [`${formatPct(value)} (${formatNumber(p.payload.qualificados)} leads)`, 'Taxa']} />
              <Bar dataKey="taxa" fill={COLORS.green} radius={[0, 4, 4, 0]}>
                <LabelList dataKey="taxa" position="right" fill={COLORS.muted} fontSize={11} fontWeight={600}
                  formatter={(v: number) => formatPct(v)} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Série mensal */}
      <div className="card-glass p-4 rounded-xl">
        <h3 className="text-base font-semibold text-foreground mb-4">
          Evolução Mensal — Taxa e Leads Recebidos
        </h3>
        {atual.serieMensal.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sem dados no período selecionado.</p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={atual.serieMensal} margin={{ left: 10, right: 10, top: 20, bottom: 10 }}>
              <CartesianGrid stroke="hsl(240, 4%, 16%)" />
              <XAxis dataKey="mes" stroke={COLORS.muted} tick={{ fill: COLORS.muted, fontSize: 11 }} />
              <YAxis yAxisId="left" stroke={COLORS.muted} tick={{ fill: COLORS.muted, fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" stroke={COLORS.muted}
                tick={{ fill: COLORS.muted, fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
              <Tooltip {...TOOLTIP_STYLE}
                formatter={(value: number, name: string) =>
                  name === 'Taxa' ? [formatPct(value), name] : [formatNumber(value), name]} />
              <Legend wrapperStyle={{ fontSize: 12, color: COLORS.muted }} />
              <Bar yAxisId="left" dataKey="leadsRecebidos" name="Leads Recebidos" fill={COLORS.purple}
                radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="taxa" name="Taxa" stroke={COLORS.gold}
                strokeWidth={2} dot={{ r: 4, fill: COLORS.gold }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* B — placeholder */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-1">B — Conversão para Venda</h2>
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
