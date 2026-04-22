import { useState } from 'react';
import { startOfMonth } from 'date-fns';
import { useActivitiesData, useFilteredActivities } from '../hooks/useActivitiesData';
import { MonitoringFilters } from '../types';
import { MonitoringFilterBar } from '../components/MonitoringFilterBar';
import { OverviewBlock } from '../components/OverviewBlock';
import { UsersBlock } from '../components/UsersBlock';
import { UserDetailBlock } from '../components/UserDetailBlock';
import { ConsistenciaCRMBlock } from '../components/ConsistenciaCRMBlock';
import { RankingPercentilBlock } from '../components/RankingPercentilBlock';
import { Loader2 } from 'lucide-react';

const SECTIONS = [
  { id: 'overview', label: 'Visão Geral' },
  { id: 'categories', label: 'Por Categoria' },
  { id: 'user-detail', label: 'Por Usuário' },
  { id: 'consistencia', label: 'Consistência CRM' },
  { id: 'ranking', label: 'Ranking por Percentil' },
];

export default function MonitoramentoDashboard() {
  const [filters, setFilters] = useState<MonitoringFilters>({
    users: [],
    categories: [],
    roles: [],
    dateRange: { from: null, to: null },
  });

  const { data: activities = [], isLoading, error } = useActivitiesData(filters);
  const filtered = useFilteredActivities(activities, filters);
  const [activeSection, setActiveSection] = useState('overview');

  const effectiveDateRange = {
    from: filters.dateRange.from ?? startOfMonth(new Date()),
    to: filters.dateRange.to ?? new Date(),
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="animate-spin text-primary" size={32} />
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center py-20">
      <div className="card-glass p-8 text-center">
        <p className="text-destructive font-medium">Erro ao carregar dados</p>
        <p className="text-sm text-muted-foreground mt-2">{(error as Error).message}</p>
      </div>
    </div>
  );

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-foreground">Monitoramento de Usuários</h1>
        <p className="text-sm text-muted-foreground mt-1">Atividades dos usuários no Kommo CRM</p>
      </div>

      <MonitoringFilterBar activities={activities} filters={filters} onFiltersChange={setFilters} />

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
        {activeSection === 'overview' && <OverviewBlock activities={filtered} />}
        {activeSection === 'categories' && <UsersBlock activities={filtered} />}
        {activeSection === 'user-detail' && (
          <UserDetailBlock
            activities={activities}
            selectedUsers={filters.users}
            dateRange={effectiveDateRange}
          />
        )}
        {activeSection === 'consistencia' && (
          <ConsistenciaCRMBlock
            activities={activities}
            selectedUsers={filters.users}
            dateRange={effectiveDateRange}
          />
        )}
        {activeSection === 'ranking' && (
          <RankingPercentilBlock
            activities={activities}
            selectedUsers={filters.users}
            dateRange={effectiveDateRange}
          />
        )}
      </div>
    </div>
  );
}
