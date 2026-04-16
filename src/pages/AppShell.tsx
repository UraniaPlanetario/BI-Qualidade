import { Routes, Route, Navigate } from 'react-router-dom';
import { GlobalSidebar } from '@/components/layout/GlobalSidebar';
import QualidadeDashboard from '@/areas/comercial/qualidade/pages/Dashboard';
import Monitoramento from '@/areas/comercial/monitoramento/index';
import LeadsFechados from '@/areas/comercial/leads-fechados/index';
import AreaPlaceholder from '@/areas/placeholder';

interface AppShellProps {
  onLogout: () => void;
}

export default function AppShell({ onLogout }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <GlobalSidebar onLogout={onLogout} />
      <main className="ml-56 p-6">
        <Routes>
          <Route path="/comercial/qualidade" element={<QualidadeDashboard />} />
          <Route path="/comercial/monitoramento" element={<Monitoramento />} />
          <Route path="/comercial/leads-fechados" element={<LeadsFechados />} />
          <Route path="/marketing" element={<AreaPlaceholder title="Marketing" />} />
          <Route path="/financeiro" element={<AreaPlaceholder title="Financeiro" />} />
          <Route path="/onboarding" element={<AreaPlaceholder title="Onboarding" />} />
          <Route path="/tecnologia" element={<AreaPlaceholder title="Tecnologia" />} />
          <Route path="*" element={<Navigate to="/comercial/qualidade" replace />} />
        </Routes>
      </main>
    </div>
  );
}
