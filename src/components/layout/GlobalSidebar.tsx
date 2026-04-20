import { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  TrendingUp, Megaphone, DollarSign, GraduationCap, Cpu,
  ChevronDown, ChevronRight, LogOut, ShieldCheck,
} from 'lucide-react';
import logoUrania from '@/assets/logo-urania.png';
import { useUserProfile } from '@/hooks/useUserProfile';
import { hasAccess, isAdmin } from '@/lib/permissions';

interface GlobalSidebarProps {
  onLogout: () => void;
}

interface NavItem {
  id: string;
  label: string;
  path: string;
  children?: NavItem[];
}

interface AreaConfig {
  id: string;
  label: string;
  icon: any;
  path: string;
  children?: NavItem[];
}

const AREAS: AreaConfig[] = [
  {
    id: 'comercial',
    label: 'Comercial',
    icon: TrendingUp,
    path: '/comercial',
    children: [
      {
        id: 'qualidade-grp',
        label: 'Qualidade',
        path: '/comercial/qualidade-grp',
        children: [
          { id: 'qualidade', label: 'Qualidade de Fechamento', path: '/comercial/qualidade' },
          { id: 'monitoramento', label: 'Monitoramento de Usuário', path: '/comercial/monitoramento' },
        ],
      },
      {
        id: 'desempenho-grp',
        label: 'Desempenho',
        path: '/comercial/desempenho-grp',
        children: [
          { id: 'desempenho-vendedor', label: 'Desempenho Vendedores', path: '/comercial/desempenho-vendedor' },
          { id: 'desempenho-sdr', label: 'Desempenho SDR', path: '/comercial/desempenho-sdr' },
        ],
      },
      { id: 'campanhas', label: 'Campanhas Semanais', path: '/comercial/campanhas' },
      { id: 'leads-fechados', label: 'Leads Fechados', path: '/comercial/leads-fechados' },
    ],
  },
  { id: 'marketing', label: 'Marketing', icon: Megaphone, path: '/marketing' },
  { id: 'financeiro', label: 'Financeiro', icon: DollarSign, path: '/financeiro' },
  { id: 'onboarding', label: 'Onboarding', icon: GraduationCap, path: '/onboarding' },
  { id: 'tecnologia', label: 'Tecnologia', icon: Cpu, path: '/tecnologia' },
];

// Filtra recursivamente itens que o usuário tem acesso
function filterByPermission(items: NavItem[], roles: string[]): NavItem[] {
  return items
    .map((item) => {
      const filteredChildren = item.children ? filterByPermission(item.children, roles) : undefined;
      // Se tem filhos, mostra se ALGUM filho está acessível
      if (filteredChildren && filteredChildren.length > 0) {
        return { ...item, children: filteredChildren };
      }
      // Sem filhos: verifica permissão direta
      if (!item.children && hasAccess(roles, item.path)) {
        return item;
      }
      return null;
    })
    .filter((x): x is NavItem => x !== null);
}

export function GlobalSidebar({ onLogout }: GlobalSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: profile } = useUserProfile();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    comercial: true,
    'qualidade-grp': true,
    'desempenho-grp': true,
  });

  const roles = profile?.roles ?? [];

  const filteredAreas = useMemo(() => {
    return AREAS.map((area) => {
      if (!area.children) {
        return hasAccess(roles, area.path) ? area : null;
      }
      const filteredChildren = filterByPermission(area.children, roles);
      if (filteredChildren.length === 0) return null;
      return { ...area, children: filteredChildren };
    }).filter((x): x is AreaConfig => x !== null);
  }, [roles]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const isActive = (path: string) => location.pathname.startsWith(path);

  function renderNavItem(item: NavItem, depth = 0): JSX.Element {
    const hasChildren = item.children && item.children.length > 0;
    const isExp = expanded[item.id];
    const active = isActive(item.path);

    return (
      <div key={item.id}>
        <button
          onClick={() => {
            if (hasChildren) {
              toggleExpand(item.id);
            } else {
              navigate(item.path);
            }
          }}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors ${
            active && !hasChildren
              ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
              : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
          }`}
        >
          <span className="flex-1 text-left">{item.label}</span>
          {hasChildren && (isExp ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}
        </button>
        {hasChildren && isExp && (
          <div className="ml-3 mt-0.5 space-y-0.5 border-l border-sidebar-border/50 pl-3">
            {item.children!.map((child) => renderNavItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-sidebar border-r border-sidebar-border flex flex-col z-50">
      <div className="p-5 border-b border-sidebar-border">
        <img src={logoUrania} alt="Urânia" className="h-10" />
        <p className="text-xs text-sidebar-foreground/60 mt-1">Analytics</p>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto scrollbar-thin">
        <p className="text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider px-3 mb-2">Áreas</p>
        {filteredAreas.map((area) => {
          const Icon = area.icon;
          const hasChildren = area.children && area.children.length > 0;
          const isExp = expanded[area.id];
          const active = isActive(area.path);

          return (
            <div key={area.id}>
              <button
                onClick={() => {
                  if (hasChildren) {
                    toggleExpand(area.id);
                  } else {
                    navigate(area.path);
                  }
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active && !hasChildren
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                }`}
              >
                <Icon size={18} />
                <span className="flex-1 text-left">{area.label}</span>
                {hasChildren && (isExp ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
              </button>

              {hasChildren && isExp && (
                <div className="ml-5 mt-0.5 space-y-0.5 border-l border-sidebar-border/50 pl-3">
                  {area.children!.map((child) => renderNavItem(child))}
                </div>
              )}
            </div>
          );
        })}

        {isAdmin(roles) && (
          <>
            <div className="border-t border-sidebar-border/30 my-3" />
            <button
              onClick={() => navigate('/admin/usuarios')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive('/admin')
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              }`}
            >
              <ShieldCheck size={18} />
              <span className="flex-1 text-left">Admin</span>
            </button>
          </>
        )}
      </nav>

      <div className="p-3 border-t border-sidebar-border">
        {profile && (
          <div className="px-3 pb-2 mb-2 border-b border-sidebar-border/30">
            <p className="text-xs text-sidebar-foreground/80 font-medium">{profile.nome || profile.email.split('@')[0]}</p>
            <p className="text-[10px] text-sidebar-foreground/40 truncate">{profile.email}</p>
          </div>
        )}
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/50 hover:text-destructive hover:bg-sidebar-accent/50 transition-colors"
        >
          <LogOut size={18} />
          Sair
        </button>
      </div>
    </aside>
  );
}
