import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { AlteracaoCampo, normalizeUserName, formatNumber } from '../types';

const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: 'hsl(240, 10%, 10%)', border: 'none', borderRadius: 8 },
  itemStyle: { color: '#fff' },
};

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const COLORS = [
  'hsl(263, 70%, 58%)',
  'hsl(270, 50%, 70%)',
  'hsl(45, 80%, 55%)',
  'hsl(142, 60%, 50%)',
  'hsl(0, 72%, 51%)',
  'hsl(200, 70%, 55%)',
  'hsl(330, 65%, 60%)',
  'hsl(30, 80%, 55%)',
];

interface VendedorStat {
  vendedor: string;
  total: number;
  diasComAlteracao: number;
  leadsDistintos: number;
}

export function BlocoCamposAlterados({ alteracoes }: { alteracoes: AlteracaoCampo[] }) {
  const filtered = useMemo(() => alteracoes.filter((a) => a.dentro_janela), [alteracoes]);

  const vendedorStats = useMemo<VendedorStat[]>(() => {
    const map: Record<string, { total: number; dias: Set<string>; leads: Set<number> }> = {};
    for (const a of filtered) {
      const v = normalizeUserName(a.criado_por);
      if (!map[v]) {
        map[v] = { total: 0, dias: new Set(), leads: new Set() };
      }
      map[v].total += 1;
      const date = a.data_criacao?.slice(0, 10);
      if (date) map[v].dias.add(date);
      if (a.lead_id != null) map[v].leads.add(a.lead_id);
    }
    return Object.entries(map)
      .map(([vendedor, v]) => ({
        vendedor,
        total: v.total,
        diasComAlteracao: v.dias.size,
        leadsDistintos: v.leads.size,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filtered]);

  const totalAlteracoes = vendedorStats.reduce((s, v) => s + v.total, 0);
  const numVendedores = vendedorStats.length;
  const totalDias = vendedorStats.reduce((s, v) => s + v.diasComAlteracao, 0);
  const totalLeads = vendedorStats.reduce((s, v) => s + v.leadsDistintos, 0);

  const mediaPorVendedor = numVendedores > 0 ? totalAlteracoes / numVendedores : 0;
  const mediaDiaria = totalDias > 0 ? totalAlteracoes / totalDias : 0;
  const mediaPorLead = totalLeads > 0 ? totalAlteracoes / totalLeads : 0;

  // 2.4 Monthly bar chart (grouped)
  const topVendedores = useMemo(() => vendedorStats.slice(0, 8).map((v) => v.vendedor), [vendedorStats]);

  const monthlyData = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const a of filtered) {
      const v = normalizeUserName(a.criado_por);
      if (!topVendedores.includes(v)) continue;
      const d = a.data_criacao ? new Date(a.data_criacao) : null;
      if (!d || isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
      if (!map[key]) map[key] = {};
      map[key][v] = (map[key][v] || 0) + 1;
    }
    // Compute months and also per-vendedor monthly average
    const monthKeys = Object.keys(map).sort();
    return monthKeys.map((key) => {
      const [year, month] = key.split('-');
      const row: Record<string, number | string> = {
        name: `${MONTH_LABELS[Number(month)]}/${year.slice(2)}`,
      };
      for (const v of topVendedores) {
        row[v] = map[key][v] || 0;
      }
      return row;
    });
  }, [filtered, topVendedores]);

  return (
    <div className="space-y-6">
      {/* 2.1 + 2.2 + 2.3 KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-glass p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Média por Vendedor</p>
          <p className="text-3xl font-bold text-foreground">{mediaPorVendedor.toFixed(1).replace('.', ',')}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatNumber(totalAlteracoes)} alt. / {numVendedores} vendedores
          </p>
        </div>
        <div className="card-glass p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Média Diária</p>
          <p className="text-3xl font-bold text-foreground">{mediaDiaria.toFixed(1).replace('.', ',')}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatNumber(totalAlteracoes)} alt. / {totalDias} dias úteis
          </p>
        </div>
        <div className="card-glass p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Média por Lead</p>
          <p className="text-3xl font-bold text-foreground">{mediaPorLead.toFixed(1).replace('.', ',')}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatNumber(totalAlteracoes)} alt. / {totalLeads} leads
          </p>
        </div>
      </div>

      {/* 2.1 Tabela Total por Vendedor */}
      <div className="card-glass p-4 rounded-xl overflow-x-auto">
        <h3 className="text-base font-semibold text-foreground mb-4">Total por Vendedor</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground font-medium">
              <th className="text-left py-2 px-3">Vendedor</th>
              <th className="text-right py-2 px-3">Total de Alterações</th>
              <th className="text-right py-2 px-3">Média (por vendedor)</th>
            </tr>
          </thead>
          <tbody>
            {vendedorStats.map((v) => (
              <tr key={v.vendedor} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                <td className="py-2 px-3 text-foreground font-medium">{v.vendedor}</td>
                <td className="py-2 px-3 text-right text-foreground">{formatNumber(v.total)}</td>
                <td className="py-2 px-3 text-right text-foreground">
                  {mediaPorVendedor.toFixed(1).replace('.', ',')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 2.2 Tabela Média Diária */}
      <div className="card-glass p-4 rounded-xl overflow-x-auto">
        <h3 className="text-base font-semibold text-foreground mb-4">Média Diária por Vendedor</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground font-medium">
              <th className="text-left py-2 px-3">Vendedor</th>
              <th className="text-right py-2 px-3">Total</th>
              <th className="text-right py-2 px-3">Dias com Alteração</th>
              <th className="text-right py-2 px-3">Média Diária</th>
            </tr>
          </thead>
          <tbody>
            {vendedorStats.map((v) => {
              const media = v.diasComAlteracao > 0 ? v.total / v.diasComAlteracao : 0;
              return (
                <tr key={v.vendedor} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="py-2 px-3 text-foreground font-medium">{v.vendedor}</td>
                  <td className="py-2 px-3 text-right text-foreground">{formatNumber(v.total)}</td>
                  <td className="py-2 px-3 text-right text-foreground">{formatNumber(v.diasComAlteracao)}</td>
                  <td className="py-2 px-3 text-right text-foreground">{media.toFixed(1).replace('.', ',')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 2.3 Tabela Média por Lead */}
      <div className="card-glass p-4 rounded-xl overflow-x-auto">
        <h3 className="text-base font-semibold text-foreground mb-4">Média de Alterações por Lead</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground font-medium">
              <th className="text-left py-2 px-3">Vendedor</th>
              <th className="text-right py-2 px-3">Total</th>
              <th className="text-right py-2 px-3">Leads Alterados</th>
              <th className="text-right py-2 px-3">Média por Lead</th>
            </tr>
          </thead>
          <tbody>
            {vendedorStats.map((v) => {
              const media = v.leadsDistintos > 0 ? v.total / v.leadsDistintos : 0;
              return (
                <tr key={v.vendedor} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="py-2 px-3 text-foreground font-medium">{v.vendedor}</td>
                  <td className="py-2 px-3 text-right text-foreground">{formatNumber(v.total)}</td>
                  <td className="py-2 px-3 text-right text-foreground">{formatNumber(v.leadsDistintos)}</td>
                  <td className="py-2 px-3 text-right text-foreground">{media.toFixed(1).replace('.', ',')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 2.4 Gráfico agrupado mensal */}
      <div className="card-glass p-4 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-foreground">Alterações Mensais por Vendedor</h3>
          <p className="text-xs text-muted-foreground">Top 8 vendedores por volume</p>
        </div>
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={monthlyData} margin={{ left: 10, right: 10, top: 20 }}>
            <XAxis dataKey="name" stroke="hsl(240, 5%, 65%)" tick={{ fill: 'hsl(240, 5%, 65%)', fontSize: 12 }} />
            <YAxis stroke="hsl(240, 5%, 65%)" tick={{ fill: 'hsl(240, 5%, 65%)', fontSize: 12 }} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 12, color: 'hsl(240, 5%, 65%)' }} />
            {topVendedores.map((v, i) => (
              <Bar key={v} dataKey={v} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default BlocoCamposAlterados;
