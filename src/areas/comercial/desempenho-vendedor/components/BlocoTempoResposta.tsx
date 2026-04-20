import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { MensagemTempo, normalizeUserName, FAIXAS_TEMPO, calcNotaTempo, formatNumber, formatPct } from '../types';

const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: 'hsl(240, 10%, 10%)', border: 'none', borderRadius: 8 },
  itemStyle: { color: '#fff' },
};

interface VendedorStats {
  vendedor: string;
  total: number;
  faixaCounts: Record<string, number>;
  nota: number;
}

export function BlocoTempoResposta({ mensagens }: { mensagens: MensagemTempo[] }) {
  const vendedorStats = useMemo<VendedorStats[]>(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const m of mensagens) {
      if (!m.recebida_dentro_janela) continue;
      const v = normalizeUserName(m.responder_user_name);
      if (!map[v]) {
        map[v] = Object.fromEntries(FAIXAS_TEMPO.map((f) => [f, 0]));
      }
      if (m.faixa in map[v]) {
        map[v][m.faixa] += 1;
      }
    }
    const out: VendedorStats[] = [];
    for (const [vendedor, faixaCounts] of Object.entries(map)) {
      const total = Object.values(faixaCounts).reduce((s, v) => s + v, 0);
      if (total === 0) continue;
      out.push({
        vendedor,
        total,
        faixaCounts,
        nota: calcNotaTempo(faixaCounts),
      });
    }
    return out.sort((a, b) => b.nota - a.nota);
  }, [mensagens]);

  const notaGeral = useMemo(() => {
    if (vendedorStats.length === 0) return 0;
    return vendedorStats.reduce((s, v) => s + v.nota, 0) / vendedorStats.length;
  }, [vendedorStats]);

  const distTime = useMemo(() => {
    const totals = Object.fromEntries(FAIXAS_TEMPO.map((f) => [f, 0])) as Record<string, number>;
    for (const v of vendedorStats) {
      for (const f of FAIXAS_TEMPO) {
        totals[f] += v.faixaCounts[f] || 0;
      }
    }
    return FAIXAS_TEMPO.map((f) => ({ name: f, value: totals[f] }));
  }, [vendedorStats]);

  const distByVendedor = useMemo(() => {
    const rows: { vendedor: string; faixa: string; pct: number; count: number }[] = [];
    for (const v of vendedorStats) {
      for (const f of FAIXAS_TEMPO) {
        const count = v.faixaCounts[f] || 0;
        rows.push({
          vendedor: v.vendedor,
          faixa: f,
          count,
          pct: v.total > 0 ? (count / v.total) * 100 : 0,
        });
      }
    }
    return rows;
  }, [vendedorStats]);

  return (
    <div className="space-y-6">
      {/* 1.1 KPI Nota Geral */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card-glass p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Nota Geral do Time</p>
          <p className="text-4xl font-bold text-foreground">{notaGeral.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground mt-1">Média das notas individuais (0 a 1)</p>
        </div>
        <div className="card-glass p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Total de Mensagens Avaliadas</p>
          <p className="text-4xl font-bold text-foreground">
            {formatNumber(vendedorStats.reduce((s, v) => s + v.total, 0))}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{vendedorStats.length} vendedores</p>
        </div>
      </div>

      {/* 1.2 Bar chart distribuição do time por faixa */}
      <div className="card-glass p-4 rounded-xl">
        <h3 className="text-base font-semibold text-foreground mb-4">Distribuição do Time por Faixa de Tempo</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={distTime} margin={{ left: 10, right: 10, top: 20 }}>
            <XAxis dataKey="name" stroke="hsl(240, 5%, 65%)" tick={{ fill: 'hsl(240, 5%, 65%)', fontSize: 12 }} />
            <YAxis stroke="hsl(240, 5%, 65%)" tick={{ fill: 'hsl(240, 5%, 65%)', fontSize: 12 }} />
            <Tooltip {...TOOLTIP_STYLE} formatter={(value: number) => [formatNumber(value), 'Mensagens']} />
            <Bar dataKey="value" fill="hsl(263, 70%, 58%)" radius={[4, 4, 0, 0]}>
              <LabelList dataKey="value" position="top" fill="hsl(240, 5%, 65%)" fontSize={11} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 1.3 Tabela nota por vendedor */}
      <div className="card-glass p-4 rounded-xl overflow-x-auto">
        <h3 className="text-base font-semibold text-foreground mb-4">Nota por Vendedor</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground font-medium">
              <th className="text-left py-2 px-3">Vendedor</th>
              <th className="text-right py-2 px-3">Nota</th>
              <th className="text-right py-2 px-3">Mensagens</th>
            </tr>
          </thead>
          <tbody>
            {vendedorStats.map((v) => (
              <tr key={v.vendedor} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                <td className="py-2 px-3 text-foreground font-medium">{v.vendedor}</td>
                <td className="py-2 px-3 text-right text-foreground">{v.nota.toFixed(2)}</td>
                <td className="py-2 px-3 text-right text-foreground">{formatNumber(v.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 1.4 Distribuição por faixa por vendedor */}
      <div className="card-glass p-4 rounded-xl overflow-x-auto">
        <h3 className="text-base font-semibold text-foreground mb-4">Distribuição por Faixa por Vendedor</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground font-medium">
              <th className="text-left py-2 px-3">Vendedor</th>
              <th className="text-left py-2 px-3">Faixa</th>
              <th className="text-right py-2 px-3">Mensagens</th>
              <th className="text-right py-2 px-3">%</th>
            </tr>
          </thead>
          <tbody>
            {distByVendedor.map((r, i) => {
              const isFirstOfGroup = i === 0 || distByVendedor[i - 1].vendedor !== r.vendedor;
              return (
                <tr key={`${r.vendedor}-${r.faixa}`} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="py-2 px-3 text-foreground font-medium">
                    {isFirstOfGroup ? r.vendedor : ''}
                  </td>
                  <td className="py-2 px-3 text-foreground">{r.faixa}</td>
                  <td className="py-2 px-3 text-right text-foreground">{formatNumber(r.count)}</td>
                  <td className="py-2 px-3 text-right text-foreground">{formatPct(r.pct)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default BlocoTempoResposta;
