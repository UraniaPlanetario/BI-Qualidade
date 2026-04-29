import { useMemo, useState } from 'react';
import type { QualidadeSDRRow } from '../types';
import { SCORE_COLORS } from '../types';

interface Props {
  rows: QualidadeSDRRow[];
}

/** Aba "Qualitativo" da Qualidade SDR — espelha a mesma da Qualidade de
 *  Fechamento, mas sem "Ponto Positivo" e "Conhecia Urânia" (esses são
 *  campos que fazem sentido só na avaliação de fechamento). Mostra Lead,
 *  SDR, Score, Observações gerais e Ponto crítico — todos preenchidos pela
 *  líder de qualidade no card do lead. */
export function QualitativeBlock({ rows }: Props) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const filtered = useMemo(() => {
    // Mostra só leads que têm algum campo qualitativo preenchido.
    const comAlgo = rows.filter(
      (r) => r.score_qualidade || r.observacoes_gerais || r.ponto_critico,
    );
    if (!search.trim()) return comAlgo;
    const term = search.toLowerCase();
    return comAlgo.filter((r) => {
      const fields = [r.lead_name, r.sdr, r.observacoes_gerais, r.ponto_critico, r.score_qualidade];
      return fields.some((f) => f?.toLowerCase().includes(term));
    });
  }, [rows, search]);

  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const truncate = (text: string | null, max = 100): string => {
    if (!text) return '—';
    return text.length <= max ? text : text.slice(0, max) + '...';
  };

  const scoreColor = (s: string | null) => (s && SCORE_COLORS[s]) || 'inherit';

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-foreground">Qualitativo</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Avaliação narrativa preenchida pela líder de qualidade no card do lead. Os campos são os mesmos da aba Qualitativo da Qualidade de Fechamento.
        </p>
      </div>

      <div className="card-glass p-4 rounded-xl">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar em observações, ponto crítico, SDR ou lead..."
          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/50"
        />
      </div>

      <div className="card-glass p-4 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left py-2 px-3 text-muted-foreground font-medium w-8"></th>
              <th className="text-left py-2 px-3 text-muted-foreground font-medium">Lead</th>
              <th className="text-left py-2 px-3 text-muted-foreground font-medium">SDR</th>
              <th className="text-center py-2 px-3 text-muted-foreground font-medium">Score</th>
              <th className="text-left py-2 px-3 text-muted-foreground font-medium">Observações gerais</th>
              <th className="text-left py-2 px-3 text-muted-foreground font-medium">Ponto crítico</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const isExp = expanded.has(r.lead_id);
              return (
                <tr
                  key={r.lead_id}
                  className="border-b border-white/5 hover:bg-white/5 transition cursor-pointer"
                  onClick={() => toggle(r.lead_id)}
                >
                  <td className="py-2 px-3 text-muted-foreground">
                    <span
                      className="inline-block transition-transform"
                      style={{ transform: isExp ? 'rotate(90deg)' : 'rotate(0deg)' }}
                    >
                      ▶
                    </span>
                  </td>
                  <td className="py-2 px-3 text-foreground font-medium">
                    {r.lead_name || `Lead #${r.lead_id}`}
                  </td>
                  <td className="py-2 px-3 text-foreground">{r.sdr || '—'}</td>
                  <td
                    className="py-2 px-3 text-center font-semibold"
                    style={{ color: scoreColor(r.score_qualidade) }}
                  >
                    {r.score_qualidade || '—'}
                  </td>
                  <td className="py-2 px-3 text-muted-foreground max-w-[280px] whitespace-pre-wrap">
                    {isExp ? r.observacoes_gerais || '—' : truncate(r.observacoes_gerais)}
                  </td>
                  <td className="py-2 px-3 text-muted-foreground max-w-[280px] whitespace-pre-wrap">
                    {isExp ? r.ponto_critico || '—' : truncate(r.ponto_critico)}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted-foreground">
                  {search.trim()
                    ? 'Nenhum resultado pra essa busca.'
                    : 'Nenhum lead com avaliação qualitativa preenchida no período.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="text-xs text-muted-foreground mt-3">
          Mostrando {filtered.length} de {rows.length} leads. Clique em uma linha pra expandir.
        </p>
      </div>
    </section>
  );
}
