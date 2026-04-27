import type { Agendamento } from '../types';
import {
  colorForAstronomo, astronomoDisplay, formatDateTime, statusLabel, statusColorClass,
  nomesBatem, datasBatem, auditoriaTarefaSuspeita,
} from '../types';
import { AlertTriangle, MapPin } from 'lucide-react';

interface Props {
  agendamentos: Agendamento[];
  onSelect: (a: Agendamento) => void;
  showAuditoriaFlags?: boolean;
  emptyLabel?: string;
}

export function ListaAgendamentos({
  agendamentos, onSelect, showAuditoriaFlags, emptyLabel,
}: Props) {
  if (agendamentos.length === 0) {
    return (
      <div className="bg-card border rounded-lg p-8 text-center text-sm text-muted-foreground">
        {emptyLabel ?? 'Nenhum agendamento encontrado.'}
      </div>
    );
  }

  return (
    <div className="bg-card border rounded-lg divide-y">
      {agendamentos.map((a) => {
        const flagNome = !nomesBatem(a.astronomo, a.astronomo_card);
        const flagData = !datasBatem(a.data_conclusao, a.data_agendamento);
        const flagTarefa = auditoriaTarefaSuspeita(a);
        const hasFlag = showAuditoriaFlags && (flagNome || flagData || flagTarefa);
        return (
          <button
            key={a.task_id}
            onClick={() => onSelect(a)}
            className="w-full text-left px-4 py-3 hover:bg-accent/40 transition-colors flex items-start gap-3"
          >
            <span
              className="flex-none w-2 h-2 rounded-full mt-2"
              style={{ background: colorForAstronomo(a.astronomo) }}
              aria-hidden
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-muted-foreground">
                  {astronomoDisplay(a.astronomo)} · {a.desc_tarefa ?? '—'}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${statusColorClass(a.status_tarefa)}`}>
                  {statusLabel(a.status_tarefa)}
                </span>
                {hasFlag && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-700">
                    <AlertTriangle size={10} />
                    {flagNome && 'nome'}
                    {flagNome && (flagData || flagTarefa) && ' · '}
                    {flagData && 'data'}
                    {flagData && flagTarefa && ' · '}
                    {flagTarefa && 'tarefa'}
                  </span>
                )}
              </div>
              <p className="text-sm font-medium mt-0.5 truncate">
                {a.nome_escola ?? '(escola não vinculada)'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
                <span>{formatDateTime(a.data_conclusao)}</span>
                {a.cidade_estado && (
                  <span className="inline-flex items-center gap-0.5">
                    <MapPin size={10} /> {a.cidade_estado}
                  </span>
                )}
                {a.numero_diarias && <span>{a.numero_diarias} diária(s)</span>}
                {a.turno && <span>{a.turno}</span>}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
