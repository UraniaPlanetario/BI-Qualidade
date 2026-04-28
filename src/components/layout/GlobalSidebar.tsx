import { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  TrendingUp, Megaphone, DollarSign, GraduationCap, Cpu,
  ChevronDown, ChevronRight, LogOut, ShieldCheck, Star,
} from 'lucide-react';
import logoUrania from '@/assets/logo-urania.png';
import { useAuth } from '@/hooks/useAuth';
import { useRouteAccess } from '@/hooks/useRouteAccess';
import { useDepartmentAccess } from '@/hooks/useDepartmentAccess';
import { useUserPreferences } from '@/hooks/useUserPreferences';

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

interface AreaSection {
  id: string;
  label: string;
  /** Mostra a seção mesmo se vazia (com placeholder "Em breve"). */
  showWhenEmpty?: boolean;
  /** Visível apenas pra global admin (ex: Sistema > Admin). */
  adminOnly?: boolean;
  areas: AreaConfig[];
}

const COMERCIAL_AREA: AreaConfig = {
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
};

const SECTIONS: AreaSection[] = [
  {
    id: 'gestao',
    label: 'Gestão',
    areas: [
      COMERCIAL_AREA,
      { id: 'marketing', label: 'Marketing', icon: Megaphone, path: '/marketing' },
      { id: 'financeiro', label: 'Financeiro', icon: DollarSign, path: '/financeiro' },
      {
        id: 'onboarding',
        label: 'Onboarding',
        icon: GraduationCap,
        path: '/onboarding',
        children: [
          { id: 'calendario-astronomos', label: 'Calendário Astrônomos', path: '/onboarding/calendario-astronomos' },
        ],
      },
    ],
  },
  {
    id: 'acesso-individual',
    label: 'Acesso Individual',
    showWhenEmpty: true,
    areas: [],
  },
  {
    id: 'sistema',
    label: 'Sistema',
    areas: [
      { id: 'tecnologia', label: 'Tecnologia', icon: Cpu, path: '/tecnologia' },
    ],
  },
  {
    id: 'sistema-admin',
    label: '',
    adminOnly: true,
    areas: [
      {
        id: 'admin',
        label: 'Admin',
        icon: ShieldCheck,
        path: '/admin',
        children: [
          { id: 'admin-users', label: 'Usuários', path: '/admin/usuarios' },
          { id: 'admin-deptos', label: 'Departamentos', path: '/admin/departamentos' },
          { id: 'admin-acessos', label: 'Controle de Acesso', path: '/admin/acessos' },
          { id: 'admin-platforms', label: 'Plataformas', path: '/admin/plataformas' },
        ],
      },
    ],
  },
];

/** Componente sentinela que avalia `useRouteAccess` para uma rota específica e
 *  só renderiza o filho se `canAccess` for true. Usado para filtrar itens do menu. */
function RouteLink({
  path,
  children,
}: {
  path: string;
  children: (canAccess: boolean) => JSX.Element | null;
}) {
  const { canAccess, isLoading } = useRouteAccess({ route: path });
  return children(isLoading || canAccess);
}

export function GlobalSidebar({ onLogout }: GlobalSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isGlobalAdmin } = useAuth();
  const { isFavorite, toggleFavorite } = useUserPreferences(user?.id);
  const { canAccessRoute, isRestricted, isLoading: deptLoading } = useDepartmentAccess();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  const isActive = (path: string) => location.pathname.startsWith(path);

  // Container só aparece no sidebar se o usuário tem acesso a pelo menos UM
  // dos seus filhos (recursivo). Sem isso, "Comercial" aparecia mesmo pra
  // usuários restritos que não tinham acesso a nenhum dashboard comercial.
  // Enquanto a info de dept tá carregando, mostra tudo (UX > sigilo aqui).
  function hasAnyAccessibleLeaf(item: { path: string; children?: { path: string; children?: any }[] }): boolean {
    if (!isRestricted) return true;
    if (deptLoading) return true;
    if (!item.children?.length) return canAccessRoute(item.path);
    return item.children.some((child) => hasAnyAccessibleLeaf(child as any));
  }

  function renderNavItem(item: NavItem): JSX.Element {
    const hasChildren = !!item.children?.length;
    const isExp = expanded[item.id];
    const active = isActive(item.path);
    const fav = !hasChildren && isFavorite(item.path);

    const button = (
      <div
        className={`group w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
          active && !hasChildren
            ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
            : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
        }`}
        onClick={() => (hasChildren ? toggleExpand(item.id) : navigate(item.path))}
      >
        <span className="flex-1 text-left">{item.label}</span>
        {!hasChildren && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); toggleFavorite(item.path); }}
            className={`p-0.5 rounded transition-opacity ${
              fav ? 'text-primary' : 'text-sidebar-foreground/30 opacity-0 group-hover:opacity-100 hover:text-sidebar-foreground/70'
            }`}
            title={fav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            aria-label={fav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          >
            <Star size={12} className={fav ? 'fill-primary' : ''} />
          </button>
        )}
        {hasChildren && (isExp ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}
      </div>
    );

    const inner = (
      <div>
        {button}
        {hasChildren && isExp && (
          <div className="ml-3 mt-0.5 space-y-0.5 border-l border-sidebar-border/50 pl-3">
            {item.children!.map((child) => <div key={child.id}>{renderNavItem(child)}</div>)}
          </div>
        )}
      </div>
    );

    if (hasChildren) {
      if (!hasAnyAccessibleLeaf(item)) return <></>;
      return inner;
    }

    return (
      <RouteLink path={item.path}>
        {(canAccess) => (canAccess ? inner : null)}
      </RouteLink>
    );
  }

  const displayName = user?.full_name || user?.email?.split('@')[0] || '';

  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-sidebar border-r border-sidebar-border flex flex-col z-50">
      <button
        onClick={() => navigate('/')}
        className="p-5 border-b border-sidebar-border hover:bg-sidebar-accent/40 transition-colors flex items-center justify-center"
        aria-label="Ir para a tela inicial"
        title="Tela inicial"
      >
        <img src={logoUrania} alt="Urânia" className="h-20" />
      </button>

      <nav className="flex-1 p-3 overflow-y-auto scrollbar-thin">
        {SECTIONS.map((section, sIdx) => {
          if (section.adminOnly && !isGlobalAdmin) return null;

          // Renderiza cada area da seção e filtra as não-acessíveis
          const renderedAreas = section.areas.map((area) => {
            const Icon = area.icon;
            const hasChildren = !!area.children?.length;
            const isExp = expanded[area.id];
            const active = isActive(area.path);
            const fav = !hasChildren && isFavorite(area.path);

            const areaButton = (
              <div
                onClick={() => (hasChildren ? toggleExpand(area.id) : navigate(area.path))}
                className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer ${
                  active && !hasChildren
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                }`}
              >
                <Icon size={18} />
                <span className="flex-1 text-left">{area.label}</span>
                {!hasChildren && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(area.path); }}
                    className={`p-0.5 rounded transition-opacity ${
                      fav ? 'text-primary' : 'text-sidebar-foreground/30 opacity-0 group-hover:opacity-100 hover:text-sidebar-foreground/70'
                    }`}
                    title={fav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                  >
                    <Star size={12} className={fav ? 'fill-primary' : ''} />
                  </button>
                )}
                {hasChildren && (isExp ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
              </div>
            );

            const inner = (
              <div key={area.id}>
                {areaButton}
                {hasChildren && isExp && (
                  <div className="ml-5 mt-0.5 space-y-0.5 border-l border-sidebar-border/50 pl-3">
                    {area.children!.map((child) => <div key={child.id}>{renderNavItem(child)}</div>)}
                  </div>
                )}
              </div>
            );

            if (hasChildren) {
              if (!hasAnyAccessibleLeaf(area)) return null;
              return inner;
            }

            return (
              <RouteLink key={area.id} path={area.path}>
                {(canAccess) => (canAccess ? inner : null)}
              </RouteLink>
            );
          }).filter(Boolean) as JSX.Element[];

          // Pula a seção se vazia e não tem fallback de "em breve"
          const isEmpty = renderedAreas.length === 0;
          if (isEmpty && !section.showWhenEmpty) return null;

          return (
            <div key={section.id} className={sIdx > 0 ? 'mt-4' : ''}>
              {section.label && (
                <p className="text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider px-3 mb-2">
                  {section.label}
                </p>
              )}
              <div className="space-y-0.5">
                {renderedAreas.length > 0 ? renderedAreas : (
                  <p className="text-[11px] text-sidebar-foreground/30 italic px-3 py-1">Em breve</p>
                )}
              </div>
            </div>
          );
        })}

      </nav>

      <div className="p-3 border-t border-sidebar-border">
        {user && (
          <div className="px-3 pb-2 mb-2 border-b border-sidebar-border/30">
            <p className="text-xs text-sidebar-foreground/80 font-medium">{displayName}</p>
            <p className="text-[10px] text-sidebar-foreground/40 truncate">{user.email}</p>
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
