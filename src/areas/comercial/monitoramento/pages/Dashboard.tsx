import { useState, useMemo } from 'react';
import { startOfMonth } from 'date-fns';
import { MonitoringFilters } from '../types';
import { useActivitiesSummary } from '../hooks/useConsistenciaData';
import { MonitoringFilterBar } from '../components/MonitoringFilterBar';
import { OverviewBlock } from '../components/OverviewBlock';
import { UserDetailBlock } from '../components/UserDetailBlock';
import { ConsistenciaCRMBlock } from '../components/ConsistenciaCRMBlock';
import { RankingPercentilBlock } from '../components/RankingPercentilBlock';
import { Loader2 } from 'lucide-react';

const SECTIONS = [
  { id: 'overview', label: 'Visão Geral' },
  { id: 'user-detail', label: 'Por Usuário' },
  { id: 'consistencia', label: 'Consistência CRM' },
  { id: 'ranking', label: 'Ranking por Percentil' },
];

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

export default function MonitoramentoDashboard() {
  const [filters, setFilters] = useState<MonitoringFilters>({
    users: [],
    categories: [],
    roles: [],
    dateRange: { from: null, to: null },
  });

  const effectiveDateRange = {
    from: filters.dateRange.from ?? startOfMonth(new Date()),
    to: filters.dateRange.to ?? new Date(),
  };

  const fromStr = toDateStr(effectiveDateRange.from);
  const toStr = toDateStr(effectiveDateRange.to);

  const { data: summary = [], isLoading, error } = useActivitiesSummary(fromStr, toStr);

  const filteredSummary = useMemo(() => {
    return summary.filter((a) => {
      if (filters.users.length > 0 && !filters.users.includes(a.user_name)) return false;
      if (filters.categories.length > 0 && !filters.categories.includes(a.category)) return false;
      if (filters.roles.length > 0 && !filters.roles.includes(a.role_name || '')) return false;
      return true;
    });
  }, [summary, filters]);

  const [activeSection, setActiveSection] = useState('overview');

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-foreground">Monitoramento de Usuários</h1>
        <p className="text-sm text-muted-foreground mt-1">Atividades dos usuários no Kommo CRM</p>
      </div>

      <MonitoringFilterBar summary={summary} filters={filters} onFiltersChange={setFilters} />

      <div className="card-glass p-1 rounded-xl mb-6 flex flex-wrap gap-1">
        {SECTIONS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveSection(id)}
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

      <div className="max-w-6xl">
        {error ? (
          <div className="card-glass p-8 text-center">
            <p className="text-destructive font-medium">Erro ao carregar dados</p>
            <p className="text-sm text-muted-foreground mt-2">{(error as Error).message}</p>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        ) : (
          <>
            {activeSection === 'overview' && (
              <OverviewBlock summary={filteredSummary} dateRange={effectiveDateRange} />
            )}
            {activeSection === 'user-detail' && (
              <UserDetailBlock
                selectedUsers={filters.users}
                dateRange={effectiveDateRange}
              />
            )}
            {activeSection === 'consistencia' && (
              <ConsistenciaCRMBlock
                summary={summary}
                selectedUsers={filters.users}
                dateRange={effectiveDateRange}
              />
            )}
            {activeSection === 'ranking' && (
              <RankingPercentilBlock
                summary={summary}
                selectedUsers={filters.users}
                dateRange={effectiveDateRange}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
