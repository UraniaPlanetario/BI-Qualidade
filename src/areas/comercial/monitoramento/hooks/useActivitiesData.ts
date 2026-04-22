import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { UserActivity, MonitoringFilters } from '../types';
import { useMemo } from 'react';
import { subDays, startOfMonth } from 'date-fns';

function getEffectiveDateRange(filters: MonitoringFilters) {
  // Default: mês atual se nenhum filtro de data selecionado
  const from = filters.dateRange.from ?? startOfMonth(new Date());
  const to = filters.dateRange.to ?? new Date();
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  };
}

export function useActivitiesData(filters: MonitoringFilters) {
  const dateRange = getEffectiveDateRange(filters);

  return useQuery<UserActivity[]>({
    queryKey: ['gold_user_activities', dateRange.from, dateRange.to],
    queryFn: async () => {
      // Paginate to get all rows (Supabase default limit is 1000)
      const allData: UserActivity[] = [];
      let from = 0;
      const pageSize = 1000;

      while (true) {
        const { data, error } = await supabase
          .schema('gold')
          .from('user_activities_humanas')
          .select('*')
          .gte('activity_date', dateRange.from)
          .lte('activity_date', dateRange.to)
          .range(from, from + pageSize - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        allData.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }

      return allData;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useFilteredActivities(activities: UserActivity[], filters: MonitoringFilters) {
  return useMemo(() => {
    return activities.filter((a) => {
      if (filters.users.length > 0 && !filters.users.includes(a.user_name)) return false;
      if (filters.categories.length > 0 && !filters.categories.includes(a.category)) return false;
      if (filters.roles.length > 0 && !filters.roles.includes(a.role_name || '')) return false;
      return true;
    });
  }, [activities, filters]);
}
