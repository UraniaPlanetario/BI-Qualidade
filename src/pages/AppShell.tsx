import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { GlobalSidebar } from '@/components/layout/GlobalSidebar';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import QualidadeDashboard from '@/areas/comercial/qualidade/pages/Dashboard';
import Monitoramento from '@/areas/comercial/monitoramento/index';
import LeadsFechados from '@/areas/comercial/leads-fechados/index';
import Campanhas from '@/areas/comercial/campanhas/index';
import DesempenhoVendedor from '@/areas/comercial/desempenho-vendedor/index';
import DesempenhoSDR from '@/areas/comercial/desempenho-sdr/index';
import Faturamento from '@/areas/financeiro/index';
import AreaPlaceholder from '@/areas/placeholder';
import Home from '@/pages/Home';
import AdminUsers from '@/pages/admin/Users';
import AdminDepartments from '@/pages/admin/Departments';
import AdminAccessControl from '@/pages/admin/AccessControl';
import AdminPlatforms from '@/pages/admin/Platforms';
import { useAuth } from '@/hooks/useAuth';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { getDashboardByPath } from '@/lib/dashboards';

interface AppShellProps {
  onLogout: () => void;
}

const protectedRoutes = [
  { path: '/', element: <Home /> },
  { path: '/comercial/qualidade', element: <QualidadeDashboard /> },
  { path: '/comercial/monitoramento', element: <Monitoramento /> },
  { path: '/comercial/leads-fechados', element: <LeadsFechados /> },
  { path: '/comercial/campanhas', element: <Campanhas /> },
  { path: '/comercial/desempenho-vendedor', element: <DesempenhoVendedor /> },
  { path: '/comercial/desempenho-sdr', element: <DesempenhoSDR /> },
  { path: '/marketing', element: <AreaPlaceholder title="Marketing" /> },
  { path: '/financeiro', element: <Faturamento /> },
  { path: '/onboarding', element: <AreaPlaceholder title="Onboarding" /> },
  { path: '/tecnologia', element: <AreaPlaceholder title="Tecnologia" /> },
  { path: '/admin/usuarios', element: <AdminUsers /> },
  { path: '/admin/departamentos', element: <AdminDepartments /> },
  { path: '/admin/acessos', element: <AdminAccessControl /> },
  { path: '/admin/plataformas', element: <AdminPlatforms /> },
];

/** Rastreia rotas visitadas (exceto a própria Home) em localStorage pra mostrar em "Últimas acessadas". */
function RouteTracker() {
  const location = useLocation();
  const { user } = useAuth();
  const { trackVisit } = useUserPreferences(user?.id);
  useEffect(() => {
    if (location.pathname === '/' || location.pathname.startsWith('/admin')) return;
    if (getDashboardByPath(location.pathname)) trackVisit(location.pathname);
  }, [location.pathname, trackVisit]);
  return null;
}

export default function AppShell({ onLogout }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <GlobalSidebar onLogout={onLogout} />
      <main className="ml-56 p-6">
        <RouteTracker />
        <Routes>
          {protectedRoutes.map(({ path, element }) => (
            <Route
              key={path}
              path={path}
              element={<ProtectedRoute>{element}</ProtectedRoute>}
            />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
