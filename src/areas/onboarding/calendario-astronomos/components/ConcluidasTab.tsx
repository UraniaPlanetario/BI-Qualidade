import { useState, useMemo } from 'react';
import type { Agendamento } from '../types';
import { ListaAgendamentos } from './ListaAgendamentos';
import { AgendamentoModal } from './AgendamentoModal';
import { colorForAstronomo, astronomoDisplay, formatCurrency } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

interface Props {
  agendamentos: Agendamento[];
}

export function ConcluidasTab({ agendamentos }: Props) {
  const [selected, setSelected] = useState<Agendamento | null>(null);

  // Aba "Concluídas" considera APENAS tarefas tipo VISITA — as outras (PRÉ,
  // RESERVA, Ñ MARCAR) são etapas operacionais que não representam atendimento.
  const concluidas = useMemo(
    () => agendamentos.filter((a) => a.status_tarefa === 'completa' && a.desc_tarefa === 'VISITA'),
    [agendamentos],
  );

  const porAstronomo = useMemo(() => {
    const map = new Map<string, { astronomo: string; nome: string; total: number; valor: number }>();
    for (const a of concluidas) {
      const k = a.astronomo ?? '—';
      if (!map.has(k)) map.set(k, { astronomo: k, nome: astronomoDisplay(k), total: 0, valor: 0 });
      const ag = map.get(k)!;
      ag.total++;
      if (a.valor_venda) ag.valor += Number(a.valor_venda);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [concluidas]);

  const totalValor = porAstronomo.reduce((s, x) => s + x.valor, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total de visitas concluídas</p>
          <p className="text-2xl font-semibold mt-1">{concluidas.length}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Valor total atendido</p>
          <p className="text-2xl font-semibold mt-1">{formatCurrency(totalValor)}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Astrônomos ativos</p>
          <p className="text-2xl font-semibold mt-1">{porAstronomo.length}</p>
        </div>
      </div>

      {porAstronomo.length > 0 && (
        <div className="bg-card border rounded-lg p-4">
          <p className="text-sm font-semibold mb-2">Visitas concluídas por astrônomo</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={porAstronomo} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip cursor={{ fill: 'hsl(var(--accent))' }} />
              <Bar dataKey="total">
                {porAstronomo.map((d) => (
                  <Cell key={d.astronomo} fill={colorForAstronomo(d.astronomo)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <ListaAgendamentos
        agendamentos={concluidas}
        onSelect={setSelected}
        emptyLabel="Nenhuma VISITA concluída encontrada. As ~2.000 tarefas concluídas no histórico usam task_type_ids antigos (anteriores a jul/2025) que não estão no mapeamento atual de astrônomos. Visitas novas começarão a aparecer aqui à medida que forem concluídas."
      />

      <AgendamentoModal
        open={!!selected}
        agendamento={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
