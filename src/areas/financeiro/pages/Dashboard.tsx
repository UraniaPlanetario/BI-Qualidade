import { useMetas, useLeadsFechados } from '../hooks/useFaturamento';
import { SpaceProgress } from '../components/SpaceProgress';
import { MetasTable } from '../components/MetasTable';
import { MonthlyChart } from '../components/MonthlyChart';
import { formatCurrency } from '../types';
import { Loader2 } from 'lucide-react';

export default function FaturamentoDashboard() {
  const { data: metas = [], isLoading: loadingMetas, error: errorMetas } = useMetas();
  const { data: leads = [], isLoading: loadingLeads, error: errorLeads } = useLeadsFechados();

  const isLoading = loadingMetas || loadingLeads;
  const error = errorMetas || errorLeads;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="card-glass p-8 text-center">
          <p className="text-destructive font-medium">Erro ao carregar dados</p>
          <p className="text-sm text-muted-foreground mt-2">{(error as Error).message}</p>
        </div>
      </div>
    );
  }

  const faturamentoTotal = leads.reduce((sum, l) => sum + (l.valor_total ?? 0), 0);

  const annualMetas = {
    meta70: metas.reduce((sum, m) => sum + m.meta_70, 0),
    meta80: metas.reduce((sum, m) => sum + m.meta_80, 0),
    meta90: metas.reduce((sum, m) => sum + m.meta_90, 0),
    meta100: metas.reduce((sum, m) => sum + m.meta_100, 0),
  };

  const currentYear = new Date().getFullYear();

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-foreground">Faturamento {currentYear}</h1>
        <p className="text-sm text-muted-foreground mt-1">Acompanhamento anual de receita por data de agendamento vs metas</p>
      </div>

      <div className="max-w-6xl space-y-6">
        {/* KPI Card */}
        <div className="card-glass p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Faturamento Acumulado</p>
          <p className="text-3xl font-bold text-foreground mt-1">{formatCurrency(faturamentoTotal)}</p>
        </div>

        {/* Space Progress - temática espacial */}
        <SpaceProgress
          value={faturamentoTotal}
          meta70={annualMetas.meta70}
          meta80={annualMetas.meta80}
          meta90={annualMetas.meta90}
          meta100={annualMetas.meta100}
        />

        {/* Metas Table */}
        <MetasTable faturamento={faturamentoTotal} metas={annualMetas} />

        {/* Monthly Chart */}
        <MonthlyChart leads={leads} metas={metas} />
      </div>
    </div>
  );
}
