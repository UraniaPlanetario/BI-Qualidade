import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  Legend,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import {
  MensagemSDR,
  SDR,
  MetaSDR,
  formatNumber,
} from '../types';
import {
  TOOLTIP_STYLE,
  COLORS,
  SERIES_COLORS,
  filterToSDRs,
  getActiveSdrs,
  toLocalDateKey,
  toWeekKey,
  datesBetween,
  shortDay,
} from './_helpers';

interface Props {
  mensagens: MensagemSDR[];
  sdrs: SDR[];
  metas: MetaSDR[];
  dateFrom: Date;
  dateTo: Date;
}

export function Bloco3Mensagens({ mensagens, sdrs, metas, dateFrom, dateTo }: Props) {
  const sdrNames = useMemo(() => new Set(sdrs.map((s) => s.nome)), [sdrs]);
  const filtered = useMemo(
    () => filterToSDRs(mensagens, sdrNames, (m) => m.responder_user_name),
    [mensagens, sdrNames],
  );

  // 3.1 — Média diária (total / dias úteis com mensagem)
  const mediaDiariaKpi = useMemo(() => {
    const diasComMsg = new Set<string>();
    for (const m of filtered) {
      const d = new Date(m.received_at);
      const dow = d.getDay();
      if (dow === 0 || dow === 6) continue;
      diasComMsg.add(toLocalDateKey(d));
    }
    const total = filtered.length;
    const n = diasComMsg.size;
    return { total, dias: n, media: n > 0 ? total / n : 0 };
  }, [filtered]);

  // Meta global diária = soma das meta_msg_diaria dos SDRs ativos no período
  const metaGlobalDiaria = useMemo(() => {
    const ativos = getActiveSdrs(sdrs, dateFrom, dateTo);
    const metasPorNivel = new Map(metas.map((m) => [m.nivel, m]));
    return ativos.reduce((sum, sdr) => {
      const meta = metasPorNivel.get(sdr.nivel);
      return sum + (meta?.meta_msg_diaria || 0);
    }, 0);
  }, [sdrs, metas, dateFrom, dateTo]);

  // 3.2 — Total diário (X=dia, Y=count)
  const totalDiario = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of filtered) {
      const key = toLocalDateKey(new Date(m.received_at));
      counts[key] = (counts[key] || 0) + 1;
    }
    return datesBetween(dateFrom, dateTo).map((key) => ({
      date: key,
      label: shortDay(key),
      count: counts[key] || 0,
    }));
  }, [filtered, dateFrom, dateTo]);

  // 3.3 — Média semanal por SDR (top 8)
  const mediaSemanalPorSdr = useMemo(() => {
    // countsWeekSdr[week][sdr] = count
    const map: Record<string, Record<string, number>> = {};
    // also compute weekdays per week
    const weekdaysPerWeek: Record<string, Set<string>> = {};
    for (const m of filtered) {
      const d = new Date(m.received_at);
      const dow = d.getDay();
      if (dow === 0 || dow === 6) continue;
      const week = toWeekKey(d);
      const name = m.responder_user_name!;
      if (!map[week]) map[week] = {};
      map[week][name] = (map[week][name] || 0) + 1;
      if (!weekdaysPerWeek[week]) weekdaysPerWeek[week] = new Set();
      weekdaysPerWeek[week].add(toLocalDateKey(d));
    }
    // Top 8 SDRs globais
    const totalPorSdr: Record<string, number> = {};
    for (const m of filtered) {
      const name = m.responder_user_name!;
      totalPorSdr[name] = (totalPorSdr[name] || 0) + 1;
    }
    const top8 = Object.entries(totalPorSdr)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([n]) => n);

    const weeks = Object.keys(map).sort();
    const rows = weeks.map((week) => {
      const row: Record<string, any> = { week };
      const dias = weekdaysPerWeek[week]?.size || 1;
      for (const sdr of top8) {
        row[sdr] = (map[week][sdr] || 0) / dias;
      }
      return row;
    });
    return { rows, sdrs: top8 };
  }, [filtered]);

  // 3.4 — Média diária por SDR (total / dias úteis com msg do SDR)
  const mediaDiariaPorSdr = useMemo(() => {
    const totalPorSdr: Record<string, number> = {};
    const diasComMsgPorSdr: Record<string, Set<string>> = {};
    for (const m of filtered) {
      const d = new Date(m.received_at);
      const dow = d.getDay();
      if (dow === 0 || dow === 6) continue;
      const name = m.responder_user_name!;
      totalPorSdr[name] = (totalPorSdr[name] || 0) + 1;
      if (!diasComMsgPorSdr[name]) diasComMsgPorSdr[name] = new Set();
      diasComMsgPorSdr[name].add(toLocalDateKey(d));
    }
    const rows = Object.keys(totalPorSdr).map((sdr) => {
      const dias = diasComMsgPorSdr[sdr].size;
      return {
        sdr,
        media: dias > 0 ? totalPorSdr[sdr] / dias : 0,
      };
    });
    return rows.sort((a, b) => b.media - a.media);
  }, [filtered]);

  // 3.5 — Média de mensagens por lead por SDR (total mensagens / leads distintos)
  const mensagensPorLeadPorSdr = useMemo(() => {
    const sdrData: Record<string, { total: number; leads: Set<number> }> = {};
    for (const m of filtered) {
      const name = m.responder_user_name!;
      if (!sdrData[name]) sdrData[name] = { total: 0, leads: new Set() };
      sdrData[name].total += 1;
      if (m.lead_id != null) sdrData[name].leads.add(m.lead_id);
    }
    const rows = Object.entries(sdrData).map(([sdr, d]) => ({
      sdr,
      media: d.leads.size > 0 ? d.total / d.leads.size : 0,
    }));
    return rows.sort((a, b) => b.media - a.media);
  }, [filtered]);

  // 3.6 — Total por SDR
  const totalPorSdr = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of filtered) {
      const name = m.responder_user_name!;
      map[name] = (map[name] || 0) + 1;
    }
    return Object.entries(map)
      .map(([sdr, total]) => ({ sdr, total }))
      .sort((a, b) => b.total - a.total);
  }, [filtered]);

  if (filtered.length === 0) {
    return (
      <div className="card-glass p-8 rounded-xl text-center">
        <p className="text-sm text-muted-foreground">
          Nenhuma mensagem de SDR no período selecionado.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 3.1 KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-glass p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Média Diária</p>
          <p className="text-4xl font-bold text-foreground">
            {mediaDiariaKpi.media.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatNumber(mediaDiariaKpi.total)} msgs / {mediaDiariaKpi.dias} dias úteis
          </p>
        </div>
        <div className="card-glass p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Meta Diária do Time</p>
          <p className="text-4xl font-bold text-foreground">
            {formatNumber(metaGlobalDiaria)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Soma das metas dos SDRs ativos</p>
        </div>
        <div className="card-glass p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Total de Mensagens</p>
          <p className="text-4xl font-bold text-foreground">{formatNumber(mediaDiariaKpi.total)}</p>
          <p className="text-xs text-muted-foreground mt-1">No período selecionado</p>
        </div>
      </div>

      {/* 3.2 Line chart total diário com linha de meta */}
      <div className="card-glass p-4 rounded-xl">
        <h3 className="text-base font-semibold text-foreground mb-4">
          Total Diário de Mensagens
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={totalDiario} margin={{ left: 10, right: 20, top: 20, bottom: 10 }}>
            <CartesianGrid stroke="hsl(240, 4%, 16%)" />
            <XAxis
              dataKey="label"
              stroke={COLORS.muted}
              tick={{ fill: COLORS.muted, fontSize: 11 }}
            />
            <YAxis stroke={COLORS.muted} tick={{ fill: COLORS.muted, fontSize: 12 }} />
            <Tooltip
              {...TOOLTIP_STYLE}
              formatter={(value: number) => [formatNumber(value), 'Mensagens']}
            />
            {metaGlobalDiaria > 0 && (
              <ReferenceLine
                y={metaGlobalDiaria}
                stroke={COLORS.gold}
                strokeDasharray="6 4"
                label={{ value: `Meta: ${formatNumber(metaGlobalDiaria)}`, position: 'right', fill: COLORS.gold, fontSize: 11 }}
              />
            )}
            <Line
              type="monotone"
              dataKey="count"
              stroke={COLORS.purple}
              strokeWidth={2}
              dot={{ r: 3, fill: COLORS.purple }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 3.3 Bar chart agrupado vertical: média semanal por SDR (top 8) */}
      <div className="card-glass p-4 rounded-xl">
        <h3 className="text-base font-semibold text-foreground mb-4">
          Média Semanal por SDR (Top 8)
        </h3>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={mediaSemanalPorSdr.rows} margin={{ left: 10, right: 10, top: 20, bottom: 30 }}>
            <CartesianGrid stroke="hsl(240, 4%, 16%)" vertical={false} />
            <XAxis
              dataKey="week"
              stroke={COLORS.muted}
              tick={{ fill: COLORS.muted, fontSize: 11 }}
              angle={-20}
              textAnchor="end"
              height={50}
            />
            <YAxis stroke={COLORS.muted} tick={{ fill: COLORS.muted, fontSize: 12 }} />
            <Tooltip
              {...TOOLTIP_STYLE}
              formatter={(value: number, name: string) => [
                value.toLocaleString('pt-BR', { maximumFractionDigits: 1 }),
                name,
              ]}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: COLORS.muted }} />
            {mediaSemanalPorSdr.sdrs.map((sdr, i) => (
              <Bar
                key={sdr}
                dataKey={sdr}
                fill={SERIES_COLORS[i % SERIES_COLORS.length]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 3.4 / 3.5 / 3.6 horizontais lado a lado */}
      <div className="grid grid-cols-1 gap-6">
        {/* 3.4 */}
        <div className="card-glass p-4 rounded-xl">
          <h3 className="text-base font-semibold text-foreground mb-4">
            Média Diária por SDR
          </h3>
          <ResponsiveContainer width="100%" height={Math.max(240, mediaDiariaPorSdr.length * 36)}>
            <BarChart
              data={mediaDiariaPorSdr}
              layout="vertical"
              margin={{ left: 20, right: 60, top: 10, bottom: 10 }}
            >
              <CartesianGrid stroke="hsl(240, 4%, 16%)" horizontal={false} />
              <XAxis type="number" stroke={COLORS.muted} tick={{ fill: COLORS.muted, fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey="sdr"
                stroke={COLORS.muted}
                tick={{ fill: COLORS.muted, fontSize: 12 }}
                width={120}
              />
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={(value: number) => [
                  value.toLocaleString('pt-BR', { maximumFractionDigits: 1 }),
                  'Média',
                ]}
              />
              <Bar dataKey="media" fill={COLORS.purple} radius={[0, 4, 4, 0]}>
                <LabelList
                  dataKey="media"
                  position="right"
                  fill={COLORS.muted}
                  fontSize={11}
                  formatter={(v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 3.5 */}
        <div className="card-glass p-4 rounded-xl">
          <h3 className="text-base font-semibold text-foreground mb-4">
            Mensagens por Lead por SDR
          </h3>
          <p className="text-xs text-muted-foreground mb-2">
            Proxy: média de mensagens por conversa (sdr + dia) — sem talk_id direto
          </p>
          <ResponsiveContainer width="100%" height={Math.max(240, mensagensPorLeadPorSdr.length * 36)}>
            <BarChart
              data={mensagensPorLeadPorSdr}
              layout="vertical"
              margin={{ left: 20, right: 60, top: 10, bottom: 10 }}
            >
              <CartesianGrid stroke="hsl(240, 4%, 16%)" horizontal={false} />
              <XAxis type="number" stroke={COLORS.muted} tick={{ fill: COLORS.muted, fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey="sdr"
                stroke={COLORS.muted}
                tick={{ fill: COLORS.muted, fontSize: 12 }}
                width={120}
              />
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={(value: number) => [
                  value.toLocaleString('pt-BR', { maximumFractionDigits: 1 }),
                  'Média',
                ]}
              />
              <Bar dataKey="media" fill={COLORS.lilac} radius={[0, 4, 4, 0]}>
                <LabelList
                  dataKey="media"
                  position="right"
                  fill={COLORS.muted}
                  fontSize={11}
                  formatter={(v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 3.6 */}
        <div className="card-glass p-4 rounded-xl">
          <h3 className="text-base font-semibold text-foreground mb-4">
            Total de Mensagens por SDR
          </h3>
          <ResponsiveContainer width="100%" height={Math.max(240, totalPorSdr.length * 36)}>
            <BarChart
              data={totalPorSdr}
              layout="vertical"
              margin={{ left: 20, right: 60, top: 10, bottom: 10 }}
            >
              <CartesianGrid stroke="hsl(240, 4%, 16%)" horizontal={false} />
              <XAxis type="number" stroke={COLORS.muted} tick={{ fill: COLORS.muted, fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey="sdr"
                stroke={COLORS.muted}
                tick={{ fill: COLORS.muted, fontSize: 12 }}
                width={120}
              />
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={(value: number) => [formatNumber(value), 'Total']}
              />
              <Bar dataKey="total" fill={COLORS.gold} radius={[0, 4, 4, 0]}>
                <LabelList
                  dataKey="total"
                  position="right"
                  fill={COLORS.muted}
                  fontSize={11}
                  formatter={(v: number) => formatNumber(v)}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default Bloco3Mensagens;
