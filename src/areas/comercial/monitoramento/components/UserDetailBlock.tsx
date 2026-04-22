import { useMemo } from 'react';
import { AlertCircle } from 'lucide-react';
import { UserActivity, CATEGORY_COLORS } from '../types';
import { getISOWeek, getISOWeekYear, parseISO, startOfISOWeek, endOfISOWeek, format, differenceInDays, subDays } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';

const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: 'hsl(240, 10%, 10%)', border: 'none', borderRadius: 8 },
  itemStyle: { color: '#fff' },
};

const EXCLUDED_CATEGORIES = new Set(['Tag', 'Vinculacao', 'Outros']);

interface Props {
  activities: UserActivity[];
  selectedUsers: string[];
  dateRange: { from: Date; to: Date };
}

export function UserDetailBlock({ activities, selectedUsers, dateRange }: Props) {
  const selectedUser = selectedUsers.length === 1 ? selectedUsers[0] : '';

  const filtered = useMemo(
    () =>
      activities.filter(
        (a) => a.user_name === selectedUser && !EXCLUDED_CATEGORIES.has(a.category),
      ),
    [activities, selectedUser],
  );

  // KPI data
  const kpis = useMemo(() => {
    if (!filtered.length) return null;

    const totalActivities = filtered.reduce((s, a) => s + a.activity_count, 0);
    const distinctDates = new Set(filtered.map((a) => a.activity_date));
    const activeDays = distinctDates.size;
    const avgPerDay = activeDays > 0 ? totalActivities / activeDays : 0;

    const categoryTotals: Record<string, number> = {};
    for (const a of filtered) {
      categoryTotals[a.category] = (categoryTotals[a.category] || 0) + a.activity_count;
    }
    const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

    return { totalActivities, activeDays, avgPerDay, topCategory };
  }, [filtered]);

  // Period comparison
  const periodComparison = useMemo(() => {
    if (!kpis || !dateRange.from || !dateRange.to) return null;
    const periodDays = differenceInDays(dateRange.to, dateRange.from) + 1;
    const prevFrom = subDays(dateRange.from, periodDays);
    const prevTo = subDays(dateRange.from, 1);
    const prevFromStr = format(prevFrom, 'yyyy-MM-dd');
    const prevToStr = format(prevTo, 'yyyy-MM-dd');

    const prevTotal = activities
      .filter(
        (a) =>
          a.user_name === selectedUser &&
          !EXCLUDED_CATEGORIES.has(a.category) &&
          a.activity_date >= prevFromStr &&
          a.activity_date <= prevToStr,
      )
      .reduce((s, a) => s + a.activity_count, 0);

    if (prevTotal === 0) return null;
    const pctChange = ((kpis.totalActivities - prevTotal) / prevTotal) * 100;
    return { pctChange, prevTotal };
  }, [kpis, activities, selectedUser, dateRange]);

  // Group average (same role)
  const groupAvg = useMemo(() => {
    if (!selectedUser) return null;
    const userRole = activities.find((a) => a.user_name === selectedUser)?.role_name;
    if (!userRole) return null;

    const roleActivities = activities.filter(
      (a) => a.role_name === userRole && !EXCLUDED_CATEGORIES.has(a.category),
    );
    const userTotals: Record<string, number> = {};
    for (const a of roleActivities) {
      userTotals[a.user_name] = (userTotals[a.user_name] || 0) + a.activity_count;
    }
    const users = Object.values(userTotals);
    if (users.length === 0) return null;
    const avg = Math.round(users.reduce((s, v) => s + v, 0) / users.length);
    return { avg, roleName: userRole };
  }, [activities, selectedUser]);

  // General average (all users)
  const generalAvg = useMemo(() => {
    const allFiltered = activities.filter((a) => !EXCLUDED_CATEGORIES.has(a.category));
    const userTotals: Record<string, number> = {};
    for (const a of allFiltered) {
      userTotals[a.user_name] = (userTotals[a.user_name] || 0) + a.activity_count;
    }
    const hourSum: Record<number, number> = {};
    const hourDays: Record<number, Set<string>> = {};
    for (let h = 0; h < 24; h++) { hourSum[h] = 0; hourDays[h] = new Set(); }
    for (const a of allFiltered) {
      hourSum[a.activity_hour] += a.activity_count;
      hourDays[a.activity_hour].add(a.activity_date + ':' + a.user_name);
    }
    const uniqueUsers = Object.keys(userTotals).length;
    const hourlyAvg = Array.from({ length: 24 }, (_, h) => {
      const days = hourDays[h].size;
      return days > 0 ? Math.round((hourSum[h] / days) * 100) / 100 : 0;
    });
    return { hourlyAvg };
  }, [activities]);

  // Group hourly average (same role)
  const groupHourlyAvg = useMemo(() => {
    if (!selectedUser) return null;
    const userRole = activities.find((a) => a.user_name === selectedUser)?.role_name;
    if (!userRole) return null;

    const roleActivities = activities.filter(
      (a) => a.role_name === userRole && !EXCLUDED_CATEGORIES.has(a.category),
    );
    const hourSum: Record<number, number> = {};
    const hourDays: Record<number, Set<string>> = {};
    for (let h = 0; h < 24; h++) { hourSum[h] = 0; hourDays[h] = new Set(); }
    for (const a of roleActivities) {
      hourSum[a.activity_hour] += a.activity_count;
      hourDays[a.activity_hour].add(a.activity_date + ':' + a.user_name);
    }
    return Array.from({ length: 24 }, (_, h) => {
      const days = hourDays[h].size;
      return days > 0 ? Math.round((hourSum[h] / days) * 100) / 100 : 0;
    });
  }, [activities, selectedUser]);

  // Weekly data
  const weeklyData = useMemo(() => {
    const fromStr = dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : null;
    const toStr = dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : null;
    const map: Record<string, { count: number; minDate: Date }> = {};
    for (const a of filtered) {
      if (fromStr && a.activity_date < fromStr) continue;
      if (toStr && a.activity_date > toStr) continue;
      const date = parseISO(a.activity_date);
      const week = getISOWeek(date);
      const year = getISOWeekYear(date);
      const key = `${year}-${String(week).padStart(2, '0')}`;
      if (!map[key]) {
        map[key] = { count: 0, minDate: date };
      }
      map[key].count += a.activity_count;
      if (date < map[key].minDate) map[key].minDate = date;
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, { count, minDate }]) => ({
        week: format(startOfISOWeek(minDate), 'dd/MM') + ' - ' + format(endOfISOWeek(minDate), 'dd/MM'),
        count,
      }));
  }, [filtered, dateRange]);

  // Hourly average data
  const hourlyAvgData = useMemo(() => {
    const hourSum: Record<number, number> = {};
    const hourDays: Record<number, Set<string>> = {};
    for (let h = 0; h < 24; h++) {
      hourSum[h] = 0;
      hourDays[h] = new Set();
    }
    for (const a of filtered) {
      hourSum[a.activity_hour] += a.activity_count;
      hourDays[a.activity_hour].add(a.activity_date);
    }
    return Array.from({ length: 24 }, (_, h) => ({
      hour: String(h).padStart(2, '0') + 'h',
      avg: hourDays[h].size > 0 ? Math.round((hourSum[h] / hourDays[h].size) * 100) / 100 : 0,
    }));
  }, [filtered]);

  // Category breakdown
  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of filtered) {
      map[a.category] = (map[a.category] || 0) + a.activity_count;
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => ({ category, count }));
  }, [filtered]);

  const multipleSelected = selectedUsers.length > 1;
  const noneSelected = selectedUsers.length === 0;

  return (
    <div className="space-y-6">
      {(multipleSelected || noneSelected) ? (
        <div className="card-glass p-6 rounded-xl flex items-start gap-3">
          <AlertCircle className="text-primary flex-shrink-0 mt-0.5" size={20} />
          <div>
            <p className="text-sm font-medium text-foreground">
              {multipleSelected
                ? `Para a análise individual, precisa deixar apenas 1 seleção no filtro de Usuário (atualmente ${selectedUsers.length} selecionados).`
                : 'Para a análise individual, selecione 1 usuário no filtro de Usuário acima.'}
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* KPI row */}
          {kpis && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Total Atividades */}
              <div className="card-glass p-4 rounded-xl text-center">
                <p className="text-muted-foreground text-xs mb-1">Total Atividades</p>
                <p className="text-2xl font-bold text-foreground">{kpis.totalActivities.toLocaleString('pt-BR')}</p>
                <div className="mt-1 space-y-0.5">
                  {periodComparison && (
                    <span className={`text-[10px] block ${periodComparison.pctChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {periodComparison.pctChange >= 0 ? '↑' : '↓'} {Math.abs(periodComparison.pctChange).toFixed(1)}% vs período anterior
                    </span>
                  )}
                  {groupAvg && (() => {
                    const diff = kpis.totalActivities - groupAvg.avg;
                    const pct = groupAvg.avg > 0 ? ((diff / groupAvg.avg) * 100) : 0;
                    return (
                      <span className={`text-[10px] block ${pct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {pct >= 0 ? '↑' : '↓'} {Math.abs(pct).toFixed(1)}% vs média do grupo ({groupAvg.avg.toLocaleString('pt-BR')})
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* Média por Dia */}
              <div className="card-glass p-4 rounded-xl text-center">
                <p className="text-muted-foreground text-xs mb-1">Média por Dia</p>
                <p className="text-2xl font-bold text-foreground">{kpis.avgPerDay.toFixed(1)}</p>
              </div>

              {/* Dias Ativos */}
              <div className="card-glass p-4 rounded-xl text-center">
                <p className="text-muted-foreground text-xs mb-1">Dias Ativos</p>
                <p className="text-2xl font-bold text-foreground">{kpis.activeDays.toLocaleString('pt-BR')}</p>
              </div>

              {/* Categoria Principal */}
              <div className="card-glass p-4 rounded-xl text-center">
                <p className="text-muted-foreground text-xs mb-1">Categoria Principal</p>
                <p className="text-lg font-bold text-foreground">{kpis.topCategory}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Tipo de atividade mais frequente</p>
              </div>
            </div>
          )}

          {/* Weekly chart */}
          <div className="card-glass p-4 rounded-xl">
            <h3 className="text-base font-semibold text-foreground mb-4">Atividades por Semana</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={weeklyData}>
                <XAxis dataKey="week" stroke="hsl(240, 5%, 65%)" tick={{ fill: 'hsl(240, 5%, 65%)', fontSize: 10 }} />
                <YAxis stroke="hsl(240, 5%, 65%)" />
                <Tooltip {...TOOLTIP_STYLE} formatter={(value: number) => [value.toLocaleString('pt-BR'), 'Total']} />
                <Bar dataKey="count" fill="hsl(263, 70%, 58%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Hourly average chart */}
          <div className="card-glass p-4 rounded-xl">
            <h3 className="text-base font-semibold text-foreground mb-4">Média de Atividades por Hora</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={hourlyAvgData.filter((d) => d.avg > 0).map((d) => ({
                ...d,
                groupAvgVal: groupHourlyAvg ? groupHourlyAvg[parseInt(d.hour)] : undefined,
              }))}>
                <XAxis dataKey="hour" stroke="hsl(240, 5%, 65%)" tick={{ fill: 'hsl(240, 5%, 65%)', fontSize: 11 }} />
                <YAxis stroke="hsl(240, 5%, 65%)" />
                <Tooltip {...TOOLTIP_STYLE} formatter={(value: number) => [value.toLocaleString('pt-BR'), 'Média']} />
                <Bar dataKey="avg" fill="hsl(270, 50%, 70%)" radius={[4, 4, 0, 0]} />
                {groupHourlyAvg && (() => {
                  const activeHours = hourlyAvgData.filter((d) => d.avg > 0);
                  const groupVals = activeHours.map((d) => groupHourlyAvg[parseInt(d.hour)]);
                  const groupAvgLine = groupVals.length > 0 ? groupVals.reduce((s, v) => s + v, 0) / groupVals.length : 0;
                  return <ReferenceLine y={groupAvgLine} stroke="hsl(142, 60%, 50%)" strokeDasharray="4 4" />;
                })()}
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2 justify-center">
              {groupHourlyAvg && (
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-0.5" style={{ borderTop: '2px dashed hsl(142, 60%, 50%)' }} />
                  <span className="text-[10px] text-muted-foreground">Média do grupo ({groupAvg?.roleName})</span>
                </div>
              )}
            </div>
          </div>

          {/* Category breakdown */}
          <div className="card-glass p-4 rounded-xl">
            <h3 className="text-base font-semibold text-foreground mb-4">Breakdown por Categoria</h3>
            <ResponsiveContainer width="100%" height={Math.max(200, categoryData.length * 40)}>
              <BarChart data={categoryData} layout="vertical">
                <XAxis type="number" stroke="hsl(240, 5%, 65%)" />
                <YAxis
                  type="category"
                  dataKey="category"
                  stroke="hsl(240, 5%, 65%)"
                  tick={{ fill: 'hsl(240, 5%, 65%)', fontSize: 12 }}
                  width={140}
                />
                <Tooltip {...TOOLTIP_STYLE} formatter={(value: number) => [value.toLocaleString('pt-BR'), 'Total']} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {categoryData.map((entry) => (
                    <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category] || 'hsl(240, 5%, 50%)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
