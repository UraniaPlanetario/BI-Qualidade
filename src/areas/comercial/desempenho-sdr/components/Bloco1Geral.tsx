import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  CartesianGrid,
} from 'recharts';
import {
  MensagemSDR,
  AlteracaoSDR,
  MovimentoLead,
  SDR,
  MetaSDR,
  MultiplicadorComissao,
  FAIXAS_TEMPO,
  calcNotaTempo,
  calcMPA,
  calcMultiplicador,
  formatPct,
  formatCurrency,
  isQualificadoSDRById,
} from '../types';
import { TOOLTIP_STYLE, COLORS, getActiveSdrs, toLocalDateKey } from './_helpers';

interface Props {
  mensagens: MensagemSDR[];
  alteracoes: AlteracaoSDR[];
  movimentos: MovimentoLead[];
  sdrs: SDR[];
  metas: MetaSDR[];
  multiplicadores: MultiplicadorComissao[];
  dateFrom: Date;
  dateTo: Date;
}

const RECEPCAO = 'Recepção Leads Insta';
const VENDAS_WPP = 'Vendas WhatsApp';

interface SdrPerformance {
  sdr: string;
  nivel: string;
  meta: MetaSDR | null;
  exec_tempo: number; // nota (0-1)
  exec_msg: number; // média diária
  exec_campos: number; // média diária
  exec_conv: number; // taxa em %
  mpa: number; // em %
  multiplicador: number;
  comissao: number;
}

export function Bloco1Geral({
  mensagens,
  alteracoes,
  movimentos,
  sdrs,
  metas,
  multiplicadores,
  dateFrom,
  dateTo,
}: Props) {
  const performances = useMemo<SdrPerformance[]>(() => {
    const ativos = getActiveSdrs(sdrs, dateFrom, dateTo);
    const metasPorNivel = new Map(metas.map((m) => [m.nivel, m]));

    // Pré-calcular denominadores globais para conversão
    const leadsRecebidosGlobal = new Set<number>();
    for (const m of movimentos) {
      if (m.pipeline_to === RECEPCAO) leadsRecebidosGlobal.add(m.lead_id);
    }
    const totalRecebidos = leadsRecebidosGlobal.size || 1;

    return ativos.map<SdrPerformance>((sdr) => {
      const meta = metasPorNivel.get(sdr.nivel) ?? null;

      // Tempo de resposta: calcular nota de tempo (0-1) para esse SDR
      const faixaCounts = Object.fromEntries(FAIXAS_TEMPO.map((f) => [f, 0])) as Record<
        string,
        number
      >;
      for (const m of mensagens) {
        if (m.responder_user_name !== sdr.nome) continue;
        if (m.faixa in faixaCounts) faixaCounts[m.faixa] += 1;
      }
      const nota = calcNotaTempo(faixaCounts);

      // Mensagens: média diária (total / dias úteis com mensagem do SDR)
      const diasMsg = new Set<string>();
      let totalMsg = 0;
      for (const m of mensagens) {
        if (m.responder_user_name !== sdr.nome) continue;
        const d = new Date(m.received_at);
        const dow = d.getDay();
        if (dow === 0 || dow === 6) continue;
        diasMsg.add(toLocalDateKey(d));
        totalMsg += 1;
      }
      const mediaMsg = diasMsg.size > 0 ? totalMsg / diasMsg.size : 0;

      // Alterações: média diária
      const diasAlt = new Set<string>();
      let totalAlt = 0;
      for (const a of alteracoes) {
        if (a.criado_por !== sdr.nome) continue;
        const d = new Date(a.data_criacao);
        const dow = d.getDay();
        if (dow === 0 || dow === 6) continue;
        diasAlt.add(toLocalDateKey(d));
        totalAlt += 1;
      }
      const mediaAlt = diasAlt.size > 0 ? totalAlt / diasAlt.size : 0;

      // Conversão: leads qualificados por esse SDR / leads recebidos global
      const qualificadosSdr = new Set<number>();
      for (const mov of movimentos) {
        const movedFromRec =
          mov.pipeline_from === RECEPCAO && mov.pipeline_to === VENDAS_WPP;
        const isQual = isQualificadoSDRById(mov.status_to_id);
        if ((movedFromRec || isQual) && mov.moved_by === sdr.nome) {
          qualificadosSdr.add(mov.lead_id);
        }
      }
      const taxaConv = (qualificadosSdr.size / totalRecebidos) * 100;

      // MPA
      const mpa = meta
        ? calcMPA(
            nota,
            meta.meta_tempo_resposta,
            mediaMsg,
            meta.meta_msg_diaria,
            mediaAlt,
            meta.meta_campos_diarios,
            taxaConv,
            meta.meta_conversao,
          )
        : 0;

      const multiplicador = calcMultiplicador(mpa, multiplicadores);
      const comissao = (meta?.comissao_variavel_base ?? 0) * multiplicador;

      return {
        sdr: sdr.nome,
        nivel: sdr.nivel,
        meta,
        exec_tempo: nota,
        exec_msg: mediaMsg,
        exec_campos: mediaAlt,
        exec_conv: taxaConv,
        mpa,
        multiplicador,
        comissao,
      };
    });
  }, [mensagens, alteracoes, movimentos, sdrs, metas, multiplicadores, dateFrom, dateTo]);

  const mpaGeral = useMemo(() => {
    if (performances.length === 0) return 0;
    return performances.reduce((s, p) => s + p.mpa, 0) / performances.length;
  }, [performances]);

  const mpaPorSdr = useMemo(
    () =>
      [...performances]
        .sort((a, b) => b.mpa - a.mpa)
        .map((p) => ({ sdr: p.sdr, mpa: Number(p.mpa.toFixed(1)) })),
    [performances],
  );

  const comissaoPorSdr = useMemo(
    () =>
      [...performances]
        .sort((a, b) => b.comissao - a.comissao)
        .map((p) => ({ sdr: p.sdr, comissao: Number(p.comissao.toFixed(2)) })),
    [performances],
  );

  if (performances.length === 0) {
    return (
      <div className="card-glass p-8 rounded-xl text-center">
        <p className="text-sm text-muted-foreground">
          Nenhum SDR ativo no período selecionado.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1.1 KPI MPA Geral */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-glass p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">MPA Geral do Time</p>
          <p className="text-4xl font-bold text-foreground">{formatPct(mpaGeral)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Média das MPAs individuais ({performances.length} SDRs)
          </p>
        </div>
        <div className="card-glass p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Melhor MPA</p>
          <p className="text-4xl font-bold text-foreground">
            {performances.length > 0 ? formatPct(Math.max(...performances.map((p) => p.mpa))) : '—'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {performances.length > 0
              ? [...performances].sort((a, b) => b.mpa - a.mpa)[0].sdr
              : '—'}
          </p>
        </div>
        <div className="card-glass p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Total em Comissões</p>
          <p className="text-4xl font-bold text-foreground">
            {formatCurrency(performances.reduce((s, p) => s + p.comissao, 0))}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Soma das comissões do time</p>
        </div>
      </div>

      {/* 1.2 MPA por SDR */}
      <div className="card-glass p-4 rounded-xl">
        <h3 className="text-base font-semibold text-foreground mb-4">MPA por SDR</h3>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={mpaPorSdr} margin={{ left: 10, right: 10, top: 20, bottom: 30 }}>
            <CartesianGrid stroke="hsl(240, 4%, 16%)" vertical={false} />
            <XAxis
              dataKey="sdr"
              stroke={COLORS.muted}
              tick={{ fill: COLORS.muted, fontSize: 11 }}
              angle={-20}
              textAnchor="end"
              height={50}
            />
            <YAxis
              stroke={COLORS.muted}
              tick={{ fill: COLORS.muted, fontSize: 12 }}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              {...TOOLTIP_STYLE}
              formatter={(value: number) => [formatPct(value), 'MPA']}
            />
            <Bar dataKey="mpa" fill={COLORS.purple} radius={[4, 4, 0, 0]}>
              <LabelList
                dataKey="mpa"
                position="top"
                fill={COLORS.muted}
                fontSize={11}
                formatter={(v: number) => formatPct(v)}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 1.3 Comissão por SDR */}
      <div className="card-glass p-4 rounded-xl">
        <h3 className="text-base font-semibold text-foreground mb-4">Comissão por SDR</h3>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={comissaoPorSdr} margin={{ left: 10, right: 10, top: 20, bottom: 30 }}>
            <CartesianGrid stroke="hsl(240, 4%, 16%)" vertical={false} />
            <XAxis
              dataKey="sdr"
              stroke={COLORS.muted}
              tick={{ fill: COLORS.muted, fontSize: 11 }}
              angle={-20}
              textAnchor="end"
              height={50}
            />
            <YAxis
              stroke={COLORS.muted}
              tick={{ fill: COLORS.muted, fontSize: 12 }}
              tickFormatter={(v) =>
                v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
              }
            />
            <Tooltip
              {...TOOLTIP_STYLE}
              formatter={(value: number) => [formatCurrency(value), 'Comissão']}
            />
            <Bar dataKey="comissao" fill={COLORS.gold} radius={[4, 4, 0, 0]}>
              <LabelList
                dataKey="comissao"
                position="top"
                fill={COLORS.muted}
                fontSize={11}
                formatter={(v: number) => formatCurrency(v)}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tabela de detalhe por SDR */}
      <div className="card-glass p-4 rounded-xl overflow-x-auto">
        <h3 className="text-base font-semibold text-foreground mb-4">Detalhe por SDR</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground font-medium">
              <th className="text-left py-2 px-3">SDR</th>
              <th className="text-left py-2 px-3">Nível</th>
              <th className="text-right py-2 px-3">Tempo (0-1)</th>
              <th className="text-right py-2 px-3">Msgs/dia</th>
              <th className="text-right py-2 px-3">Campos/dia</th>
              <th className="text-right py-2 px-3">Conv %</th>
              <th className="text-right py-2 px-3">MPA</th>
              <th className="text-right py-2 px-3">Mult.</th>
              <th className="text-right py-2 px-3">Comissão</th>
            </tr>
          </thead>
          <tbody>
            {performances
              .slice()
              .sort((a, b) => b.mpa - a.mpa)
              .map((p) => (
                <tr
                  key={p.sdr}
                  className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
                >
                  <td className="py-2 px-3 text-foreground font-medium">{p.sdr}</td>
                  <td className="py-2 px-3 text-muted-foreground">{p.nivel}</td>
                  <td className="py-2 px-3 text-right text-foreground">
                    {p.exec_tempo.toFixed(2)}
                  </td>
                  <td className="py-2 px-3 text-right text-foreground">
                    {p.exec_msg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
                  </td>
                  <td className="py-2 px-3 text-right text-foreground">
                    {p.exec_campos.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
                  </td>
                  <td className="py-2 px-3 text-right text-foreground">
                    {formatPct(p.exec_conv)}
                  </td>
                  <td className="py-2 px-3 text-right text-foreground">{formatPct(p.mpa)}</td>
                  <td className="py-2 px-3 text-right text-foreground">
                    {p.multiplicador.toFixed(2)}
                  </td>
                  <td className="py-2 px-3 text-right text-foreground">
                    {formatCurrency(p.comissao)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* 1.4 Elegíveis a Promoção (placeholder) */}
      <div className="card-glass p-4 rounded-xl">
        <h3 className="text-base font-semibold text-foreground mb-2">Elegíveis a Promoção</h3>
        <p className="text-sm text-muted-foreground">
          Calculado com base nos últimos 3 meses anteriores ao período.
        </p>
      </div>
    </div>
  );
}

export default Bloco1Geral;
