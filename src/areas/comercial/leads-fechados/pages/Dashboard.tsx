import { useState } from 'react';
import { useClosedLeads, useFilteredClosed } from '../hooks/useClosedLeads';
import { ClosedFilters } from '../types';
import { ClosedFilterBar } from '../components/ClosedFilterBar';
import { OverviewBlock } from '../components/OverviewBlock';
import { VendedorBlock } from '../components/VendedorBlock';
import { DetailBlock } from '../components/DetailBlock';
import { Loader2 } from 'lucide-react';

const SECTIONS = [
  { id: 'overview', label: 'Visão Geral' },
  { id: 'vendedor', label: 'Por Vendedor' },
  { id: 'detail', label: 'Detalhamento' },
];

export default function LeadsFechadosDashboard() {
  const [filters, setFilters] = useState<ClosedFilters>({
    vendedores: [],
    cancelado: 'all',
    dateRange: {
      from: new Date(new Date().getFullYear(), 0, 1),
      to: new Date(),
    },
  });

  const { data: leads = [], isLoading, error } = useClosedLeads();
  const filtered = useFilteredClosed(leads, filters);
  const [activeSection, setActiveSection] = useState('overview');

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
        <h1 className="text-2xl font-bold text-foreground">Leads Fechados</h1>
        <p className="text-sm text-muted-foreground mt-1">Leads que entraram no Onboarding</p>
      </div>

      <ClosedFilterBar leads={leads} filters={filters} onFiltersChange={setFilters} />

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
        {activeSection === 'overview' && <OverviewBlock leads={filtered} />}
        {activeSection === 'vendedor' && <VendedorBlock leads={filtered} />}
        {activeSection === 'detail' && <DetailBlock leads={filtered} />}
      </div>
    </div>
  );
}
