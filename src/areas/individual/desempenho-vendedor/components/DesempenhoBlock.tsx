import { useState, useMemo } from 'react';
import { startOfMonth, endOfMonth, subMonths } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, CartesianGrid,
} from 'recharts';
import { Loader2 } from 'lucide-react';
import { DateRangePicker } from '@/components/DateRangePicker';
import { useTempoResposta } from '@/areas/comercial/desempenho-vendedor/hooks/useDesempenhoVendedor';
import {
  useAlteracoesMensal, useAlteracoesResumo,
} from '@/areas/comercial/desempenho-sdr/hooks/useDesempenhoSDR';
import { FAIXAS_TEMPO, calcNotaTempo, formatNumber } from '@/areas/comercial/desempenho-vendedor/types';
import { useMeusLeadsFechados, type MeuLeadFechado } from '../hooks/useMeuVendedor';

interface Props {
  vendedor: string;
  vendedorOverride?: string;
}

const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: 'hsl(240, 10%, 10%)', border: 'none', borderRadius: 8 },
  itemStyle: { color: '#fff' },
};

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function toISO(d: Date | null): string | null {
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatCurrency(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function diariasOf(l: MeuLeadFechado): number {
  const n = parseInt(l.n_diarias || '0', 10);
  return isNaN(n) ? 0 : n;
}

/** Agrega leads por mês (a partir de uma string YYYY-MM-DD), retornando
 *  ordenado cronologicamente. Parse direto da string pra evitar timezone shift. */
function aggMensal<T>(items: T[], getDate: (i: T) => string | null, getValue: (i: T) => number) {
  const map: Record<string, number> = {};
  for (const it of items) {
    const ymd = getDate(it);
    if (!ymd || ymd.length < 7) continue;
    const key = ymd.slice(0, 7); // YYYY-MM
    map[key] = (map[key] ?? 0) + getValue(it);
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => {
      const [year, month] = key.split('-');
      return { name: `${MONTH_LABELS[Number(month) - 1]}/${year.slice(2)}`, value };
    });
}

/** Painel do Vendedor — aba Desempenho. Layout em SEÇÕES (sem tabs).
 *
 *  Fonte unificada com a Visão Geral: usa `useMeusLeadsFechados` (= gold.leads_closed)
 *  pros KPIs/gráficos de fechamentos, diárias, faturamento e cancelamentos.
 *  Antes usava cubo_leads_consolidado e divergia da Visão Geral. */
export function DesempenhoBlock({ vendedor, vendedorOverride }: Props) {
  const today = new Date();
  const lastMonthStart = startOfMonth(subMonths(today, 1));
  const lastMonthEnd = endOfMonth(subMonths(today, 1));
  const [dateRange, setDateRange] = useState<{ from: Date | null; to: Date | null }>({
    from: lastMonthStart,
    to: lastMonthEnd,
  });

  const dateFromISO = toISO(dateRange.from);
  const dateToISO = toISO(dateRange.to);

  // Mesma fonte da Visão Geral (gold.leads_closed via RPC)
  const { data: leads = [], isLoading: lLoading } = useMeusLeadsFechados(vendedorOverride);
  const { data: mensagens = [], isLoading: mLoading } = useTempoResposta(dateFromISO, dateToISO);
  const { data: alteracoesMensal = [], isLoading: aLoading } = useAlteracoesMensal(dateFromISO, dateToISO);
  const { data: alteracoesResumo = [] } = useAlteracoesResumo(dateFromISO, dateToISO);

  // Filtra mensagens só do vendedor
  const minhasMensagens = useMemo(
    () => mensagens.filter((m) => m.responder_user_name === vendedor && m.recebida_dentro_janela),
    [mensagens, vendedor],
  );
  const minhasAlteracoes = useMemo(
    () => alteracoesMensal.filter((a) => a.user_name === vendedor),
    [alteracoesMensal, vendedor],
  );
  const meuResumoAlteracoes = useMemo(
    () => alteracoesResumo.find((a) => a.user_name === vendedor) ?? null,
    [alteracoesResumo, vendedor],
  );

  // Ativos (não cancelados) com data_fechamento_fmt no período
  const ativos = useMemo(() => {
    return leads.filter((l) => {
      if (l.cancelado) return false;
      if (!l.data_fechamento_fmt) return false;
      if (dateFromISO && l.data_fechamento_fmt < dateFromISO) return false;
      if (dateToISO && l.data_fechamento_fmt > dateToISO) return false;
      return true;
    });
  }, [leads, dateFromISO, dateToISO]);

  // Cancelados (com data_cancelamento_fmt no período)
  const cancelados = useMemo(() => {
    return leads.filter((l) => {
      if (!l.cancelado) return false;
      if (!l.data_cancelamento_fmt) return false;
      if (dateFromISO && l.data_cancelamento_fmt < dateFromISO) return false;
      if (dateToISO && l.data_cancelamento_fmt > dateToISO) return false;
      return true;
    });
  }, [leads, dateFromISO, dateToISO]);

  // === Tempo de Resposta ===
  const tempoStats = useMemo(() => {
    const faixaCounts = Object.fromEntries(FAIXAS_TEMPO.map((f) => [f, 0])) as Record<string, number>;
    let total = 0;
    for (const m of minhasMensagens) {
      if (m.faixa in faixaCounts) {
        faixaCounts[m.faixa] += 1;
        total += 1;
      }
    }
    const nota = total > 0 ? calcNotaTempo(faixaCounts) : 0;
    return {
      total,
      nota,
      distribuicao: FAIXAS_TEMPO.map((f) => ({ name: f, value: faixaCounts[f] ?? 0 })),
    };
  }, [minhasMensagens]);

  // === Campos Alterados ===
  const camposStats = useMemo(() => {
    const total = minhasAlteracoes.reduce((s, a) => s + a.total, 0);
    const leadsDistintos = meuResumoAlteracoes?.leads_distintos ?? 0;
    const diasComAlt = meuResumoAlteracoes?.dias_com_alt ?? 0;
    const mediaPorLead = leadsDistintos > 0 ? total / leadsDistintos : 0;
    const mediaDiaria = diasComAlt > 0 ? total / diasComAlt : 0;
    const mensal = [...minhasAlteracoes]
      .sort((a, b) => a.mes_key.localeCompare(b.mes_key))
      .map((a) => {
        const [year, month] = a.mes_key.split('-');
        return { name: `${MONTH_LABELS[Number(month) - 1]}/${year.slice(2)}`, value: a.total };
      });
    return { total, mediaPorLead, mediaDiaria, mensal };
  }, [minhasAlteracoes, meuResumoAlteracoes]);

  // === Vendas (KPIs juntos) ===
  const vendasStats = useMemo(() => {
    const totalLeads = ativos.length;
    const totalDiarias = ativos.reduce((s, l) => s + diariasOf(l), 0);
    const diariasPorLead = totalLeads > 0 ? totalDiarias / totalLeads : 0;
    const faturamento = ativos.reduce((s, l) => s + (l.lead_price || 0), 0);
    const totalCancelamentos = cancelados.length;

    // Churn — regra Urânia (validada com Julia em 04/05/2026):
    // Numerador  : cancelamentos do vendedor com data_cancelamento no período
    // Denominador: TODOS os fechamentos do vendedor nos MESES-ORIGEM dos
    //              cancelados (= meses YYYY-MM em que os cancelados foram
    //              originalmente fechados).
    // Ex: 2 canc em abril, leads originalmente fechados jan+fev. Vendedor
    // fechou 20 leads em jan+fev. Churn = 2/20 = 10%.
    // Cancelados também contam no denominador (eram fechamentos legítimos
    // naquele mês, antes de cancelar).
    const mesesOrigem = new Set<string>();
    for (const c of cancelados) {
      if (c.data_fechamento_fmt) mesesOrigem.add(c.data_fechamento_fmt.slice(0, 7));
    }
    let denominadorChurn = 0;
    if (mesesOrigem.size > 0) {
      // Itera leads brutos (não filtrados por período) — denominador olha
      // TODOS os fechamentos do vendedor nos meses-origem, independente do
      // filtro de período do dashboard.
      for (const l of leads) {
        if (!l.data_fechamento_fmt) continue;
        const mes = l.data_fechamento_fmt.slice(0, 7);
        if (mesesOrigem.has(mes)) denominadorChurn += 1;
      }
    }
    const churnPct = denominadorChurn > 0 ? (totalCancelamentos / denominadorChurn) * 100 : 0;

    return {
      totalLeads, totalDiarias, diariasPorLead, faturamento,
      totalCancelamentos, churnPct, denominadorChurn,
      mesesOrigem: Array.from(mesesOrigem).sort(),
    };
  }, [ativos, cancelados, leads]);

  // Datasets mensais
  const fechMensal = useMemo(
    () => aggMensal(ativos, (l) => l.data_fechamento_fmt, () => 1),
    [ativos],
  );
  const diariasMensal = useMemo(
    () => aggMensal(ativos, (l) => l.data_fechamento_fmt, (l) => diariasOf(l)),
    [ativos],
  );
  const faturamentoMensal = useMemo(
    () => aggMensal(ativos, (l) => l.data_fechamento_fmt, (l) => l.lead_price ?? 0),
    [ativos],
  );
  const cancelMensal = useMemo(
    () => aggMensal(cancelados, (l) => l.data_cancelamento_fmt, () => 1),
    [cancelados],
  );

  const isLoading = lLoading || mLoading || aLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="animate-spin mr-2" size={18} /> Carregando seu desempenho...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Filtro de período (compartilhado pelas seções) */}
      <div className="card-glass p-4 rounded-xl">
        <label className="text-xs text-muted-foreground block mb-1">Período</label>
        <DateRangePicker
          from={dateRange.from}
          to={dateRange.to}
          onChange={setDateRange}
          showPresets
        />
      </div>

      {/* === Seção: Tempo de Resposta === */}
      <section className="space-y-4">
        <div className="border-b pb-2">
          <h2 className="text-xl font-semibold">Tempo de Resposta</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card-glass p-4 rounded-xl text-center">
            <p className="text-sm text-muted-foreground">Nota Geral do Tempo de Resposta</p>
            <p className="text-4xl font-bold text-foreground">{tempoStats.nota.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">Pondera as faixas (0 a 1)</p>
          </div>
          <div className="card-glass p-4 rounded-xl text-center">
            <p className="text-sm text-muted-foreground">Total de Mensagens Enviadas</p>
            <p className="text-4xl font-bold text-foreground">{formatNumber(tempoStats.total)}</p>
          </div>
        </div>
        <div className="card-glass p-4 rounded-xl">
          <h3 className="text-base font-semibold mb-3">Distribuição por faixa de tempo</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={tempoStats.distribuicao} margin={{ left: 10, right: 10, top: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(240, 5%, 65%)" tick={{ fill: 'hsl(240, 5%, 65%)', fontSize: 12 }} />
              <YAxis stroke="hsl(240, 5%, 65%)" tick={{ fill: 'hsl(240, 5%, 65%)', fontSize: 12 }} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [formatNumber(v), 'Mensagens']} />
              <Bar dataKey="value" fill="hsl(263, 70%, 58%)" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="value" position="top" fill="hsl(240, 5%, 65%)" fontSize={11} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* === Seção: Campos Alterados === */}
      <section className="space-y-4">
        <div className="border-b pb-2">
          <h2 className="text-xl font-semibold">Campos Alterados</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Quantidade de alterações em campos do CRM no período (proxy de atividade humana).
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card-glass p-4 rounded-xl text-center">
            <p className="text-sm text-muted-foreground">Total de Campos Alterados</p>
            <p className="text-4xl font-bold text-foreground">{formatNumber(camposStats.total)}</p>
          </div>
          <div className="card-glass p-4 rounded-xl text-center">
            <p className="text-sm text-muted-foreground">Média por Lead</p>
            <p className="text-4xl font-bold text-foreground">{camposStats.mediaPorLead.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground mt-1">total / leads distintos com alteração</p>
          </div>
          <div className="card-glass p-4 rounded-xl text-center">
            <p className="text-sm text-muted-foreground">Média Diária</p>
            <p className="text-4xl font-bold text-foreground">{camposStats.mediaDiaria.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground mt-1">total / dias com alteração</p>
          </div>
        </div>
        <div className="card-glass p-4 rounded-xl">
          <h3 className="text-base font-semibold mb-3">Alterações mensais</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={camposStats.mensal} margin={{ left: 10, right: 10, top: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(240, 5%, 65%)" tick={{ fill: 'hsl(240, 5%, 65%)', fontSize: 12 }} />
              <YAxis stroke="hsl(240, 5%, 65%)" tick={{ fill: 'hsl(240, 5%, 65%)', fontSize: 12 }} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [formatNumber(v), 'Alterações']} />
              <Bar dataKey="value" fill="hsl(263, 70%, 58%)" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="value" position="top" fill="hsl(240, 5%, 65%)" fontSize={11} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {camposStats.mensal.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-6">Sem alterações no período.</p>
          )}
        </div>
      </section>

      {/* === Seção: Vendas (fechamentos / diárias / faturamento / cancelamentos) === */}
      <section className="space-y-4">
        <div className="border-b pb-2">
          <h2 className="text-xl font-semibold">Vendas</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Fechamentos pela data de fechamento. Cancelamentos pela data de cancelamento. Mesma fonte da Visão Geral.
          </p>
        </div>

        {/* KPIs unificados */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="card-glass p-4 rounded-xl text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Fechamentos</p>
            <p className="text-3xl font-bold mt-1">{vendasStats.totalLeads.toLocaleString('pt-BR')}</p>
          </div>
          <div className="card-glass p-4 rounded-xl text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Diárias</p>
            <p className="text-3xl font-bold mt-1">{vendasStats.totalDiarias.toLocaleString('pt-BR')}</p>
          </div>
          <div className="card-glass p-4 rounded-xl text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Diárias / Lead</p>
            <p className="text-3xl font-bold mt-1">{vendasStats.diariasPorLead.toFixed(1)}</p>
          </div>
          <div className="card-glass p-4 rounded-xl text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Faturamento</p>
            <p className="text-xl font-bold mt-1">{formatCurrency(vendasStats.faturamento)}</p>
          </div>
          <div className="card-glass p-4 rounded-xl text-center border border-rose-500/30">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Cancelamentos</p>
            <p className="text-3xl font-bold mt-1 text-rose-500">{vendasStats.totalCancelamentos.toLocaleString('pt-BR')}</p>
          </div>
          <div
            className="card-glass p-4 rounded-xl text-center border border-amber-500/30"
            title={`Cancelamentos no período (${vendasStats.totalCancelamentos}) ÷ fechamentos nos meses-origem dos cancelados (${vendasStats.denominadorChurn})${vendasStats.mesesOrigem.length > 0 ? ` — meses-origem: ${vendasStats.mesesOrigem.join(', ')}` : ''}`}
          >
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Churn</p>
            <p className="text-3xl font-bold mt-1 text-amber-500">{vendasStats.churnPct.toFixed(1)}%</p>
            <p className="text-[10px] text-muted-foreground/70 mt-1">
              {vendasStats.totalCancelamentos} canc / {vendasStats.denominadorChurn} fech (meses-origem)
            </p>
          </div>
        </div>

        {/* 4 gráficos mensais lado a lado em 2x2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card-glass p-4 rounded-xl">
            <h3 className="text-base font-semibold mb-3">Fechamentos mensais</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={fechMensal}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [formatNumber(v), 'Fechamentos']} />
                <Bar dataKey="value" fill="hsl(263, 70%, 58%)" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="value" position="top" fill="hsl(240, 5%, 65%)" fontSize={11} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {fechMensal.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-6">Sem fechamentos no período.</p>
            )}
          </div>

          <div className="card-glass p-4 rounded-xl">
            <h3 className="text-base font-semibold mb-3">Diárias mensais</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={diariasMensal}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [formatNumber(v), 'Diárias']} />
                <Bar dataKey="value" fill="hsl(263, 70%, 58%)" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="value" position="top" fill="hsl(240, 5%, 65%)" fontSize={11} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {diariasMensal.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-6">Sem diárias no período.</p>
            )}
          </div>

          <div className="card-glass p-4 rounded-xl">
            <h3 className="text-base font-semibold mb-3">Valor vendido mensal</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={faturamentoMensal}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [formatCurrency(v), 'Faturamento']} />
                <Bar dataKey="value" fill="hsl(142, 60%, 45%)" radius={[4, 4, 0, 0]}>
                  <LabelList
                    dataKey="value"
                    position="top"
                    formatter={(v: any) => `R$ ${(Number(v) / 1000).toFixed(0)}k`}
                    fill="hsl(240, 5%, 65%)"
                    fontSize={10}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {faturamentoMensal.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-6">Sem faturamento no período.</p>
            )}
          </div>

          <div className="card-glass p-4 rounded-xl">
            <h3 className="text-base font-semibold mb-3">Cancelamentos mensais</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={cancelMensal}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [formatNumber(v), 'Cancelamentos']} />
                <Bar dataKey="value" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="value" position="top" fill="hsl(240, 5%, 65%)" fontSize={11} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {cancelMensal.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-6">Sem cancelamentos no período.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
