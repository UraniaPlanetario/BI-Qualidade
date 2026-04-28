import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useBIRole } from '@/hooks/useBIRole';

/**
 * Rotas liberadas ao usuário via departamento.
 * - Admin/Gestão: sem restrição (retorna null em allowedRoutes)
 * - Usuário/Viewer: lista específica de rotas herdadas de department_route_access
 */
export function useDepartmentAccess() {
  const { user, loading: authLoading } = useAuth();
  const { biRole, isManager, isLoading: roleLoading } = useBIRole();

  const isRestricted = !!biRole && !isManager;

  const { data: allowedRoutes, isLoading: routesLoading } = useQuery<string[] | null>({
    queryKey: ['department-route-access', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data: userDepts } = await supabase
        .from('user_departments')
        .select('department_id')
        .eq('user_id', user.id);

      if (!userDepts || userDepts.length === 0) return [];

      const deptIds = userDepts.map((d) => d.department_id);

      const { data: routes } = await supabase
        .from('department_route_access')
        .select('route')
        .in('department_id', deptIds);

      if (!routes) return [];
      return [...new Set(routes.map((r) => r.route))];
    },
    staleTime: 30_000,
    enabled: isRestricted && !!user?.id && !authLoading && !roleLoading,
  });

  const isLoading = authLoading || roleLoading || (isRestricted && routesLoading);

  return {
    allowedRoutes: isRestricted ? (allowedRoutes ?? []) : null,
    isRestricted,
    isLoading,
    canAccessRoute: (route: string): boolean => {
      if (!isRestricted) return true;
      if (!allowedRoutes) return false;
      // Match de prefixo: liberar `/onboarding` também libera `/onboarding/X`.
      // É o comportamento que o admin espera ao "habilitar a pasta" no UI de
      // departamentos. Match com `/` evita falsos positivos (`/onboardingfoo`
      // não é liberado por `/onboarding`).
      return allowedRoutes.some(
        (allowed) => route === allowed || route.startsWith(allowed + '/'),
      );
    },
  };
}
