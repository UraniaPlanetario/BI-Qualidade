import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  TrendingUp, Megaphone, DollarSign, GraduationCap, Cpu,
  ChevronDown, ChevronRight, LogOut,
} from 'lucide-react';
import logoUrania from '@/assets/logo-urania.png';

interface GlobalSidebarProps {
  onLogout: () => void;
}

interface AreaConfig {
  id: string;
  label: string;
  icon: any;
  path: string;
  children?: { id: string; label: string; path: string }[];
}

const AREAS: AreaConfig[] = [
  {
    id: 'comercial',
    label: 'Comercial',
    icon: TrendingUp,
    path: '/comercial',
    children: [
      { id: 'qualidade', label: 'Qualidade', path: '/comercial/qualidade' },
      { id: 'monitoramento', label: 'Monitoramento Usuários', path: '/comercial/monitoramento' },
      { id: 'leads-fechados', label: 'Leads Fechados', path: '/comercial/leads-fechados' },
    ],
  },
  { id: 'marketing', label: 'Marketing', icon: Megaphone, path: '/marketing' },
  { id: 'financeiro', label: 'Financeiro', icon: DollarSign, path: '/financeiro' },
  { id: 'onboarding', label: 'Onboarding', icon: GraduationCap, path: '/onboarding' },
  { id: 'tecnologia', label: 'Tecnologia', icon: Cpu, path: '/tecnologia' },
];

export function GlobalSidebar({ onLogout }: GlobalSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ comercial: true });

  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-sidebar border-r border-sidebar-border flex flex-col z-50">
      <div className="p-5 border-b border-sidebar-border">
        <img src={logoUrania} alt="Urânia" className="h-10" />
        <p className="text-xs text-sidebar-foreground/60 mt-1">Analytics</p>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto scrollbar-thin">
        <p className="text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider px-3 mb-2">Áreas</p>
        {AREAS.map((area) => {
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
                {hasChildren && (
                  isExp ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                )}
              </button>

              {hasChildren && isExp && (
                <div className="ml-5 mt-0.5 space-y-0.5 border-l border-sidebar-border/50 pl-3">
                  {area.children!.map((child) => (
                    <button
                      key={child.id}
                      onClick={() => navigate(child.path)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                        location.pathname.startsWith(child.path)
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                          : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                      }`}
                    >
                      {child.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-border">
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
