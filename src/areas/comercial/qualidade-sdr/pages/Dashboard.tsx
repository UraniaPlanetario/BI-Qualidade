import { useMemo, useState } from 'react';
import { Loader2, Info } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList, CartesianGrid,
} from 'recharts';
import { useQualidadeSDR } from '../hooks/useQualidadeSDR';
import {
  ETAPAS, PESO_ETAPA, COR_ETAPA, CRITERIOS, FILTROS_DEFAULT,
  notaGeralRow, notaToColor,
} from '../types';
import type { Etapa, QualidadeSDRRow, QualidadeSDRFilters, ValorCriterio } from '../types';
import { MultiSelect } from '@/components/MultiSelect';
import { DateRangePicker } from '@/components/DateRangePicker';
import { QualitativeBlock } from '../components/QualitativeBlock';

const SECTIONS = [
  { id: 'quantitativo', label: 'Quantitativo' },
  { id: 'qualitativo',  label: 'Qualitativo' },
];

const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: 'hsl(240, 10%, 10%)', border: 'none', borderRadius: 8 },
  itemStyle: { color: '#fff' },
};

const VALORES: ValorCriterio[] = ['Bom', 'Parcial', 'Não', 'Não se aplica'];
const VALOR_COR: Record<string, string> = {
  'Bom': '#10b981', 'Parcial': '#f59e0b', 'Não': '#ef4444', 'Não se aplica': '#6b7280',
};

export default function QualidadeSDRDashboard() {
  const { data: rows = [], isLoading } = useQualidadeSDR();
  const [filtros, setFiltros] = useState<QualidadeSDRFilters>(FILTROS_DEFAULT);
  const [activeSection, setActiveSection] = useState<'quantitativo' | 'qualitativo'>('quantitativo');

  const filtrados = useMemo(() => {
    return rows.filter((r) => {
      if (filtros.sdrs.length > 0 && !filtros.sdrs.includes(r.sdr || '')) return false;
      // data_referencia = fechamento se fechado, senão updated_at do lead
      const ref = r.data_referencia?.slice(0, 10);
      if (!ref) return true; // sem data → não filtra (tolerante)
      if (filtros.dateRange.from) {
        const f = ymd(filtros.dateRange.from);
        if (ref < f) return false;
      }
      if (filtros.dateRange.to) {
        const t = ymd(filtros.dateRange.to);
        if (ref > t) return false;
      }
      return true;
    });
  }, [rows, filtros]);

  const sdrs = useMemo(
    () => Array.from(new Set(rows.map((r) => r.sdr).filter(Boolean) as string[])).sort(),
    [rows],
  );

  // Linhas avaliadas: pelo menos 1 etapa com nota
  const avaliados = useMemo(
    () => filtrados.filter((r) => ETAPAS.some((e) => r[`nota_${e.toLowerCase()}` as keyof QualidadeSDRRow] != null)),
    [filtrados],
  );

  // KPIs por etapa (média ignorando NULLs) + nota geral média
  const statsEtapa = useMemo(() => {
    const out: Record<Etapa, { media: number | null; n: number }> = {
      C1: { media: null, n: 0 }, C2: { media: null, n: 0 },
      C3: { media: null, n: 0 }, C4: { media: null, n: 0 }, C5: { media: null, n: 0 },
    };
    for (const e of ETAPAS) {
      const key = `nota_${e.toLowerCase()}` as keyof QualidadeSDRRow;
      const valores = avaliados
        .map((r) => r[key] as number | null)
        .filter((v): v is number => v != null);
      if (valores.length > 0) {
        out[e] = { media: round1(valores.reduce((s, v) => s + v, 0) / valores.length), n: valores.length };
      }
    }
    return out;
  }, [avaliados]);

  const notaGeralMedia = useMemo(() => {
    const notas = avaliados.map(notaGeralRow).filter((v): v is number => v != null);
    if (notas.length === 0) return null;
    return round1(notas.reduce((s, v) => s + v, 0) / notas.length);
  }, [avaliados]);

  // Ranking por SDR
  const ranking = useMemo(() => {
    const map = new Map<string, { sdr: string; rows: QualidadeSDRRow[] }>();
    for (const r of avaliados) {
      const k = r.sdr || '(sem SDR)';
      if (!map.has(k)) map.set(k, { sdr: k, rows: [] });
      map.get(k)!.rows.push(r);
    }
    return Array.from(map.values())
      .map(({ sdr, rows: rs }) => {
        const out: any = { sdr, n: rs.length };
        for (const e of ETAPAS) {
          const key = `nota_${e.toLowerCase()}` as keyof QualidadeSDRRow;
          const vals = rs.map((r) => r[key] as number | null).filter((v): v is number => v != null);
          out[e] = vals.length > 0 ? round1(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
        }
        const notasGerais = rs.map(notaGeralRow).filter((v): v is number => v != null);
        out.geral = notasGerais.length > 0
          ? round1(notasGerais.reduce((s, v) => s + v, 0) / notasGerais.length)
          : null;
        return out;
      })
      .sort((a, b) => (b.geral ?? -1) - (a.geral ?? -1));
  }, [avaliados]);

  // Distribuição (Bom/Parcial/Não/N/A) por etapa
  const distribuicao = useMemo(() => {
    return ETAPAS.map((etapa) => {
      const counts: Record<string, number> = { 'Bom': 0, 'Parcial': 0, 'Não': 0, 'Não se aplica': 0 };
      for (const r of avaliados) {
        for (const c of CRITERIOS[etapa]) {
          const v = r[c.key] as ValorCriterio;
          if (v && counts[v] !== undefined) counts[v]++;
        }
      }
      const total = Object.values(counts).reduce((s, v) => s + v, 0);
      return { etapa, ...counts, total };
    });
  }, [avaliados]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="animate-spin mr-2" size={18} /> Carregando...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Qualidade SDR</h1>
        <p className="text-sm text-muted-foreground">
          Avaliação qualitativa da atuação dos SDRs em cada etapa de cadência (C1–C5),
          baseada em 25 critérios preenchidos no Kommo (independente do desfecho do lead).
          Nota geral pondera C1·20% + C2·20% + C3·15% + C4·20% + C5·25%.
        </p>
      </div>

      {/* Filtros */}
      <div className="card-glass p-4 rounded-xl grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div className="md:col-span-1">
          <label className="text-xs text-muted-foreground block mb-1">Período</label>
          <DateRangePicker
            from={filtros.dateRange.from}
            to={filtros.dateRange.to}
            onChange={(range) => setFiltros((f) => ({ ...f, dateRange: range }))}
            showPresets
          />
        </div>
        <div>
          <MultiSelect
            label="SDR"
            options={sdrs.map((s) => ({ value: s, label: s }))}
            value={filtros.sdrs}
            onChange={(v) => setFiltros((f) => ({ ...f, sdrs: v }))}
            placeholder="Todos os SDRs"
          />
        </div>
        <div className="text-xs text-muted-foreground italic flex items-center gap-1.5">
          <Info size={12} /> {avaliados.length} {avaliados.length === 1 ? 'lead avaliado' : 'leads avaliados'} no período
        </div>
      </div>

      {/* Tabs */}
      <div className="card-glass p-1 rounded-xl flex flex-wrap gap-1">
        {SECTIONS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveSection(id as typeof activeSection)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              activeSection === id
                ? 'bg-primary text-white font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeSection === 'qualitativo' ? (
        <QualitativeBlock rows={filtrados} />
      ) : avaliados.length === 0 ? (
        <div className="card-glass p-12 rounded-xl text-center">
          <p className="text-lg font-semibold text-foreground">Sem avaliações no período</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Os critérios C1–C5 são preenchidos pelo time no card do lead no Kommo. Nada
            ainda ou ajuste o filtro de período.
          </p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="card-glass p-4 rounded-xl text-center">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Nota Geral</p>
              <p className="text-3xl font-bold mt-1" style={{ color: notaToColor(notaGeralMedia) }}>
                {notaGeralMedia != null ? notaGeralMedia.toFixed(1) : '—'}
              </p>
              <p className="text-[10px] text-muted-foreground/70 mt-1">Média ponderada de C1–C5</p>
            </div>
            {ETAPAS.map((etapa) => {
              const s = statsEtapa[etapa];
              return (
                <div
                  key={etapa}
                  className="card-glass p-4 rounded-xl text-center border-t-4"
                  style={{ borderTopColor: COR_ETAPA[etapa] }}
                >
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {etapa} <span className="text-[10px] opacity-60">({(PESO_ETAPA[etapa] * 100).toFixed(0)}%)</span>
                  </p>
                  <p className="text-3xl font-bold mt-1" style={{ color: notaToColor(s.media) }}>
                    {s.media != null ? s.media.toFixed(1) : '—'}
                  </p>
                  <p className="text-[10px] text-muted-foreground/70 mt-1">{s.n} {s.n === 1 ? 'lead' : 'leads'}</p>
                </div>
              );
            })}
          </div>

          {/* Nota média por etapa (gráfico) */}
          <div className="card-glass p-4 rounded-xl">
            <p className="text-sm font-semibold mb-3">Nota média por etapa</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={ETAPAS.map((e) => ({ etapa: e, nota: statsEtapa[e].media ?? 0 }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="etapa" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => [Number(v).toFixed(1), 'Nota']} />
                <Bar dataKey="nota">
                  <LabelList dataKey="nota" position="top" formatter={(v: any) => v ? Number(v).toFixed(1) : '—'} fill="hsl(var(--foreground))" fontSize={11} />
                  {ETAPAS.map((e) => <Cell key={e} fill={COR_ETAPA[e]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Ranking por SDR */}
          <div className="card-glass p-4 rounded-xl">
            <p className="text-sm font-semibold mb-3">Ranking por SDR</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">SDR</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Leads</th>
                    {ETAPAS.map((e) => (
                      <th key={e} className="text-right py-2 px-3 text-xs font-semibold" style={{ color: COR_ETAPA[e] }}>
                        {e}
                      </th>
                    ))}
                    <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Geral</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((r, i) => (
                    <tr key={r.sdr} className="border-b border-border/40 hover:bg-accent/40">
                      <td className="py-1.5 px-3">
                        <span className="text-muted-foreground/60 mr-2">{i + 1}.</span>
                        {r.sdr}
                      </td>
                      <td className="py-1.5 px-3 text-right tabular-nums text-muted-foreground">{r.n}</td>
                      {ETAPAS.map((e) => (
                        <td key={e} className="py-1.5 px-3 text-right tabular-nums">
                          {r[e] != null ? (
                            <span style={{ color: notaToColor(r[e]) }} className="font-medium">{r[e].toFixed(1)}</span>
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </td>
                      ))}
                      <td className="py-1.5 px-3 text-right tabular-nums">
                        {r.geral != null ? (
                          <span style={{ color: notaToColor(r.geral) }} className="font-bold">{r.geral.toFixed(1)}</span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Distribuição por etapa (Bom/Parcial/Não/N/A) */}
          <div className="card-glass p-4 rounded-xl">
            <p className="text-sm font-semibold mb-1">Distribuição de avaliações por etapa</p>
            <p className="text-xs text-muted-foreground mb-3">
              Cada etapa tem 5 critérios; a barra empilha quantas vezes cada valor apareceu nesses 5 × {avaliados.length} avaliações.
            </p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={distribuicao} stackOffset="expand">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="etapa" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 11 }} />
                <Tooltip
                  {...TOOLTIP_STYLE}
                  formatter={(v: any, name: any, props: any) => {
                    const total = props.payload.total;
                    const pct = total > 0 ? (Number(v) / total * 100).toFixed(1) : '0';
                    return [`${v} (${pct}%)`, name];
                  }}
                />
                {VALORES.map((val) => (
                  <Bar key={val ?? '—'} dataKey={val ?? '—'} stackId="a" fill={VALOR_COR[val ?? '']} />
                ))}
              </BarChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-3 mt-2 text-xs">
              {VALORES.map((v) => (
                <span key={v ?? '—'} className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm" style={{ background: VALOR_COR[v ?? ''] }} />
                  {v}
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
