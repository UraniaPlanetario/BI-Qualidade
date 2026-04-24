import {
  BarChart3, Users, Target, Calendar, TrendingUp, Activity, DollarSign,
  Megaphone, GraduationCap, Cpu, type LucideIcon,
} from 'lucide-react';

/** Catálogo central de dashboards — fonte de verdade pra sidebar, home, favoritos. */
export interface DashboardEntry {
  path: string;
  label: string;
  icon: LucideIcon;
  area: string;
  description?: string;
}

export const DASHBOARDS: DashboardEntry[] = [
  { path: '/comercial/qualidade',          label: 'Qualidade de Fechamento',     icon: Target,     area: 'Comercial', description: 'Scores de qualidade e rankings por consultor' },
  { path: '/comercial/monitoramento',      label: 'Monitoramento de Usuário',    icon: Activity,   area: 'Comercial', description: 'Atividade diária, consistência CRM e percentis' },
  { path: '/comercial/desempenho-vendedor', label: 'Desempenho Vendedor',        icon: TrendingUp, area: 'Comercial', description: 'Fechamentos, diárias, faturamento e cancelamentos' },
  { path: '/comercial/desempenho-sdr',     label: 'Desempenho SDR',              icon: Users,      area: 'Comercial', description: 'MPA, qualificação e comissão' },
  { path: '/comercial/campanhas',          label: 'Campanhas Semanais',          icon: Calendar,   area: 'Comercial', description: 'Leads da semana, produtos e conteúdo' },
  { path: '/comercial/leads-fechados',     label: 'Leads Fechados',              icon: BarChart3,  area: 'Comercial' },
  { path: '/financeiro',                   label: 'Faturamento',                 icon: DollarSign, area: 'Financeiro' },
  { path: '/marketing',                    label: 'Marketing',                   icon: Megaphone,  area: 'Marketing' },
  { path: '/onboarding',                   label: 'Onboarding',                  icon: GraduationCap, area: 'Onboarding' },
  { path: '/tecnologia',                   label: 'Tecnologia',                  icon: Cpu,        area: 'Tecnologia' },
];

export function getDashboardByPath(path: string): DashboardEntry | undefined {
  return DASHBOARDS.find((d) => d.path === path);
}
