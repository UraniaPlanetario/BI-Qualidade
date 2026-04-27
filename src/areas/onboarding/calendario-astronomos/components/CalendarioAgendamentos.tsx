import { useMemo } from 'react';
import { Calendar, dateFnsLocalizer, Views, Event as RBCEvent } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, startOfDay, endOfDay, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './calendar.css';
import type { Agendamento } from '../types';
import { colorForAstronomo, astronomoDisplay, statusLabel } from '../types';

const locales = { 'pt-BR': ptBR };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (d: Date) => startOfWeek(d, { weekStartsOn: 0 }),
  getDay,
  locales,
});

const NAO_MARCAR_COLOR = '#9ca3af'; // cinza neutro

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

interface CalEvent extends RBCEvent {
  agendamento: Agendamento;
}

interface Props {
  agendamentos: Agendamento[];
  onSelect: (a: Agendamento) => void;
  height?: number;
}

export function CalendarioAgendamentos({ agendamentos, onSelect, height = 600 }: Props) {
  const events = useMemo<CalEvent[]>(() => {
    return agendamentos
      .filter((a) => !!a.data_conclusao)
      .map((a) => {
        // Quantas diárias o agendamento tem (custom field "Nº de Diárias" do
        // lead). Default 1 quando vazio ou não-numérico. Múltiplas diárias
        // viram um bloco contínuo no calendário cobrindo todos os dias.
        const numDias = Math.max(1, Number(a.numero_diarias) || 1);
        // Travamos start/end em início/fim do dia local pra que o evento NÃO
        // vaze pro dia seguinte só porque a hora UTC do complete_till caiu
        // perto da meia-noite. O calendário é all-day mesmo, hora não importa.
        const start = startOfDay(new Date(a.data_conclusao!));
        const end = endOfDay(addDays(start, numDias - 1));
        const isNaoMarcar = a.desc_tarefa === 'Ñ MARCAR';
        const main = isNaoMarcar
          ? 'Não Marcar'
          : `${a.nome_escola ?? '(sem escola)'}${a.cidade ? ' · ' + a.cidade : ''}`;
        return {
          title: `${astronomoDisplay(a.astronomo)} · ${main}${numDias > 1 ? ' (' + numDias + ' diárias)' : ''}`,
          start,
          end,
          allDay: true,
          agendamento: a,
        } as CalEvent;
      });
  }, [agendamentos]);

  const messages = {
    today: 'Hoje',
    previous: '<',
    next: '>',
    month: 'Mês',
    week: 'Semana',
    day: 'Dia',
    agenda: 'Agenda',
    date: 'Data',
    time: 'Hora',
    event: 'Evento',
    noEventsInRange: 'Nenhum agendamento no período',
    showMore: (n: number) => `+${n} mais`,
  };

  const formats = {
    monthHeaderFormat: (date: Date) =>
      cap(format(date, 'MMMM yyyy', { locale: ptBR })),
    dayHeaderFormat: (date: Date) =>
      cap(format(date, "EEEE, dd 'de' MMMM", { locale: ptBR })),
    dayRangeHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
      `${cap(format(start, "dd 'de' MMMM", { locale: ptBR }))} – ${cap(format(end, "dd 'de' MMMM yyyy", { locale: ptBR }))}`,
    weekdayFormat: (date: Date) =>
      cap(format(date, 'EEEE', { locale: ptBR })),
    agendaHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
      `${format(start, 'dd/MM/yyyy')} – ${format(end, 'dd/MM/yyyy')}`,
    agendaDateFormat: (date: Date) =>
      cap(format(date, "EEEE, dd 'de' MMMM", { locale: ptBR })),
  };

  return (
    <div className="bg-card border rounded-lg p-2 calendario-agendamentos" style={{ height }}>
      <Calendar
        localizer={localizer}
        culture="pt-BR"
        messages={messages}
        formats={formats}
        events={events}
        defaultView={Views.MONTH}
        views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
        startAccessor="start"
        endAccessor="end"
        onSelectEvent={(e) => onSelect((e as CalEvent).agendamento)}
        eventPropGetter={(e) => {
          const a = (e as CalEvent).agendamento;
          const isNaoMarcar = a.desc_tarefa === 'Ñ MARCAR';
          const bg = isNaoMarcar ? NAO_MARCAR_COLOR : colorForAstronomo(a.astronomo);
          return {
            style: {
              backgroundColor: bg,
              borderColor: bg,
              color: '#fff',
              fontSize: '11px',
              padding: '2px 4px',
              borderRadius: '4px',
              opacity: a.status_tarefa === 'atrasada' ? 0.75 : 1,
            },
            title: `${astronomoDisplay(a.astronomo)} · ${isNaoMarcar ? 'Não Marcar' : (a.nome_escola ?? '')} (${statusLabel(a.status_tarefa)})`,
          };
        }}
        style={{ height: '100%' }}
      />
    </div>
  );
}
