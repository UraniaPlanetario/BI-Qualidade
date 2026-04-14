import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { UserActivity, MonitoringFilters } from '../types';
import { useMemo } from 'react';

export function useActivitiesData(filters: MonitoringFilters) {
  // Build server-side filter on date range to reduce payload
  return useQuery<UserActivity[]>({
    queryKey: ['gold_user_activities', filters.dateRange.from?.toISOString(), filters.dateRange.to?.toISOString()],
    queryFn: async () => {
      let query = supabase.schema('gold').from('user_activities').select('*');
      if (filters.dateRange.from) {
        query = query.gte('activity_date', filters.dateRange.from.toISOString().split('T')[0]);
      }
      if (filters.dateRange.to) {
        query = query.lte('activity_date', filters.dateRange.to.toISOString().split('T')[0]);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
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
      return true;
    });
  }, [activities, filters]);
}
