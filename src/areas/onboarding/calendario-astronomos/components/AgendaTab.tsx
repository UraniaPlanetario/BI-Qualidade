import { useState } from 'react';
import type { Agendamento } from '../types';
import { CalendarioAgendamentos } from './CalendarioAgendamentos';
import { MapaAgendamentos } from './MapaAgendamentos';
import { ListaAgendamentos } from './ListaAgendamentos';
import { AgendamentoModal } from './AgendamentoModal';

interface Props {
  agendamentos: Agendamento[];
}

export function AgendaTab({ agendamentos }: Props) {
  const [selected, setSelected] = useState<Agendamento | null>(null);

  return (
    <div className="space-y-4">
      <CalendarioAgendamentos agendamentos={agendamentos} onSelect={setSelected} height={720} />

      <MapaAgendamentos agendamentos={agendamentos} onSelect={setSelected} height={520} />

      <div>
        <h3 className="text-sm font-semibold mb-2 text-muted-foreground">
          Lista ({agendamentos.length})
        </h3>
        <ListaAgendamentos agendamentos={agendamentos} onSelect={setSelected} />
      </div>

      <AgendamentoModal
        open={!!selected}
        agendamento={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
