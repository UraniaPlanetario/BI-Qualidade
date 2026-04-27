import { useState, useMemo } from 'react';
import { Loader2, Calendar, ListTodo, ShieldAlert } from 'lucide-react';
import { useAgendamentos, useAstronomos, calcStats } from '../hooks/useAgendamentos';
import { FILTROS_DEFAULT, nomesBatem, datasBatem, auditoriaTarefaSuspeita } from '../types';
import type { Filtros, Agendamento } from '../types';
import { FilterBar } from '../components/FilterBar';
import { KPIs } from '../components/KPIs';
import { AgendaTab } from '../components/AgendaTab';
import { ConcluidasTab } from '../components/ConcluidasTab';
import { AuditoriaTab } from '../components/AuditoriaTab';

type TabId = 'agenda' | 'concluidas' | 'auditoria';

const TABS: { id: TabId; label: string; icon: any }[] = [
  { id: 'agenda', label: 'Agenda', icon: Calendar },
  { id: 'concluidas', label: 'Concluídas', icon: ListTodo },
  { id: 'auditoria', label: 'Auditoria', icon: ShieldAlert },
];

export default function CalendarioAstronomosDashboard() {
  const { data: agendamentos, isLoading } = useAgendamentos();
  const { data: astronomos } = useAstronomos();

  const [tab, setTab] = useState<TabId>('agenda');
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_DEFAULT);

  const filtrados = useMemo(() => {
    if (!agendamentos) return [];
    const norm = (s: string) =>
      s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const buscaN = filtros.busca ? norm(filtros.busca) : '';
    const fromTs = filtros.dateRange.from?.getTime() ?? null;
    const toTs = filtros.dateRange.to
      ? new Date(filtros.dateRange.to.getTime() + 24 * 60 * 60 * 1000 - 1).getTime()
      : null;

    return agendamentos.filter((a: Agendamento) => {
      if (filtros.astronomos.length && !filtros.astronomos.includes(a.astronomo ?? '')) return false;
      if (filtros.tiposTarefa.length && !filtros.tiposTarefa.includes(a.desc_tarefa as any)) return false;
      if (filtros.status.length && !filtros.status.includes(a.status_tarefa)) return false;
      if (fromTs != null || toTs != null) {
        const ts = a.data_conclusao ? new Date(a.data_conclusao).getTime() : null;
        if (ts == null) return false;
        if (fromTs != null && ts < fromTs) return false;
        if (toTs != null && ts > toTs) return false;
      }
      if (buscaN) {
        const haystack = norm(`${a.nome_escola ?? ''} ${a.cidade ?? ''} ${a.uf ?? ''} ${a.endereco ?? ''}`);
        if (!haystack.includes(buscaN)) return false;
      }
      if (filtros.flagAuditoriaNome && nomesBatem(a.astronomo, a.astronomo_card)) return false;
      if (filtros.flagAuditoriaData && datasBatem(a.data_conclusao, a.data_agendamento)) return false;
      if (filtros.flagAuditoriaTarefa && !auditoriaTarefaSuspeita(a)) return false;
      return true;
    });
  }, [agendamentos, filtros]);

  const stats = useMemo(() => calcStats(filtrados), [filtrados]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="animate-spin mr-2" size={18} /> Carregando agendamentos…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Calendário Astrônomos</h1>
        <p className="text-sm text-muted-foreground">
          Visitas, pré-visitas e reservas dos astrônomos na operação de onboarding.
        </p>
      </div>

      <FilterBar
        filtros={filtros}
        onChange={setFiltros}
        astronomos={astronomos ?? []}
        showAuditoriaToggles={tab === 'auditoria'}
        showStatusFilter={tab === 'agenda'}
      />

      <KPIs stats={stats} />

      <div className="border-b flex">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm border-b-2 transition-colors flex items-center gap-2 ${
              tab === id
                ? 'border-primary text-primary font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === 'agenda' && <AgendaTab agendamentos={filtrados} />}
      {tab === 'concluidas' && <ConcluidasTab agendamentos={filtrados} />}
      {tab === 'auditoria' && <AuditoriaTab agendamentos={filtrados} />}
    </div>
  );
}
