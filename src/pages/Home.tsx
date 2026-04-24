import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Clock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { DASHBOARDS, getDashboardByPath } from '@/lib/dashboards';

function greetingByHour(h: number): string {
  if (h >= 6 && h < 12) return 'Bom dia';
  if (h >= 12 && h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `${diffMin} min atrás`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} h atrás`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD} ${diffD === 1 ? 'dia' : 'dias'} atrás`;
  return d.toLocaleDateString('pt-BR');
}

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { favorites, recents } = useUserPreferences(user?.id);

  const firstName = useMemo(() => {
    const name = user?.full_name || user?.email?.split('@')[0] || '';
    return name.split(' ')[0];
  }, [user]);

  const greeting = greetingByHour(new Date().getHours());

  const favEntries = favorites
    .map((p) => getDashboardByPath(p))
    .filter((d): d is NonNullable<typeof d> => !!d);

  const recentEntries = recents
    .map((r) => ({ ...r, entry: getDashboardByPath(r.path) }))
    .filter((r): r is { path: string; at: string; entry: NonNullable<ReturnType<typeof getDashboardByPath>> } => !!r.entry);

  return (
    <div className="max-w-5xl">
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground">
          {greeting}, <span className="text-primary">{firstName}</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-2">Bem-vindo ao BI Urânia.</p>
      </div>

      {/* Favoritos */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Star className="text-primary fill-primary" size={18} />
          <h2 className="text-base font-semibold text-foreground">Favoritos</h2>
          {favEntries.length > 0 && (
            <span className="text-xs text-muted-foreground">({favEntries.length})</span>
          )}
        </div>
        {favEntries.length === 0 ? (
          <div className="card-glass p-6 rounded-xl text-sm text-muted-foreground">
            Você ainda não favoritou nenhum dashboard. Clique na estrela ao lado do nome do dashboard no menu lateral para adicioná-lo aqui.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {favEntries.map((d) => {
              const Icon = d.icon;
              return (
                <button
                  key={d.path}
                  onClick={() => navigate(d.path)}
                  className="card-glass p-4 rounded-xl text-left hover:border-primary/50 border border-transparent transition-colors group"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/15 text-primary shrink-0 group-hover:bg-primary/25 transition-colors">
                      <Icon size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">{d.area}</p>
                      <p className="text-sm font-medium text-foreground truncate">{d.label}</p>
                      {d.description && (
                        <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{d.description}</p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Últimas acessadas */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="text-muted-foreground" size={18} />
          <h2 className="text-base font-semibold text-foreground">Últimas acessadas</h2>
        </div>
        {recentEntries.length === 0 ? (
          <div className="card-glass p-6 rounded-xl text-sm text-muted-foreground">
            Nenhum dashboard acessado recentemente.
          </div>
        ) : (
          <div className="card-glass rounded-xl overflow-hidden">
            {recentEntries.map((r, i) => {
              const Icon = r.entry.icon;
              return (
                <button
                  key={r.path}
                  onClick={() => navigate(r.path)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/10 transition-colors ${
                    i > 0 ? 'border-t border-border/50' : ''
                  }`}
                >
                  <Icon size={16} className="text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{r.entry.label}</p>
                    <p className="text-[11px] text-muted-foreground">{r.entry.area}</p>
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0">{formatRelative(r.at)}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
