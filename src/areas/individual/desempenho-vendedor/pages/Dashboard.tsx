import { useState, useMemo } from 'react';
import { Loader2, AlertCircle, TrendingUp, Activity, BarChart3, Eye, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  useMeuVendedor, useMeuKommoUserId, useListaVendedoresImpersonar,
} from '../hooks/useMeuVendedor';
import { VisaoGeralBlock } from '../components/VisaoGeralBlock';
import { AuditoriaBlock } from '../components/AuditoriaBlock';
import { DesempenhoBlock } from '../components/DesempenhoBlock';

type TabId = 'visao' | 'auditoria' | 'desempenho';

const TABS: { id: TabId; label: string; icon: any }[] = [
  { id: 'visao',      label: 'Visão Geral',                 icon: TrendingUp },
  { id: 'auditoria',  label: 'Auditoria Funil de Vendas',   icon: Activity },
  { id: 'desempenho', label: 'Desempenho',                  icon: BarChart3 },
];

/** "Bom dia / tarde / noite" baseado na hora local. Padrão pt-BR. */
function saudacao(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function MeuDesempenhoVendedorDashboard() {
  const { user, isGlobalAdmin } = useAuth();
  const [tab, setTab] = useState<TabId>('visao');

  // Modo "Visualizar como" (admin only) — quando ativo, override é passado
  // pras 4 RPCs que aceitam parâmetro. Backend valida que o caller é admin
  // antes de respeitar o override.
  const [impersonado, setImpersonado] = useState<{ vendedor: string; kommoUserId: number | null } | null>(null);
  const { data: listaImpersonar = [] } = useListaVendedoresImpersonar(isGlobalAdmin);

  const { data: vendedor, isLoading: vLoading } = useMeuVendedor(impersonado?.vendedor);
  const { data: kommoUserId, isLoading: kLoading } = useMeuKommoUserId(impersonado?.kommoUserId);

  const opcoesImpersonar = useMemo(
    () => [...listaImpersonar].sort((a, b) => a.vendedor.localeCompare(b.vendedor)),
    [listaImpersonar],
  );

  if (vLoading || kLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="animate-spin mr-2" size={18} /> Carregando...
      </div>
    );
  }

  // Sem vínculo (e não é admin impersonando): mostra mensagem amigável
  if (!vendedor) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold">Painel do Vendedor</h1>
          <p className="text-sm text-muted-foreground">Acesso individual do vendedor</p>
        </div>
        <div className="card-glass p-8 rounded-xl flex items-start gap-3">
          <AlertCircle className="text-amber-500 flex-none" size={20} />
          <div>
            <p className="font-semibold">Seu usuário ainda não está vinculado a um vendedor</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Pra ver seus leads e desempenho, peça pro admin preencher o campo
              "Vendedor/Consultor" no seu perfil em /admin/usuarios. O nome precisa bater
              exatamente com o usado no Kommo (ex: "Karen Medeiros", "Fred Peixoto",
              "Juliana Rodrigues").
            </p>
          </div>
        </div>
        {isGlobalAdmin && (
          <ImpersonarSelector
            opcoes={opcoesImpersonar}
            atual={impersonado}
            onChange={setImpersonado}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">
          {saudacao()}, {vendedor}!
        </h1>
        <p className="text-sm text-muted-foreground">
          Painel do Vendedor
          {impersonado && <span className="ml-2 text-amber-500 italic">(visualizando como)</span>}
          {user?.full_name && !impersonado && user.full_name !== vendedor
            ? <span className="ml-2 text-muted-foreground/70">— logado como {user.full_name}</span>
            : null}
        </p>
      </div>

      {isGlobalAdmin && (
        <ImpersonarSelector
          opcoes={opcoesImpersonar}
          atual={impersonado}
          onChange={setImpersonado}
        />
      )}

      <div className="border-b flex">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm border-b-2 transition-colors flex items-center gap-2 ${
              tab === id
                ? 'border-primary text-primary font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === 'visao' && <VisaoGeralBlock vendedor={vendedor} vendedorOverride={impersonado?.vendedor} />}
      {tab === 'auditoria' && (
        kommoUserId
          ? <AuditoriaBlock kommoUserId={kommoUserId} kommoUserIdOverride={impersonado?.kommoUserId ?? null} />
          : <div className="card-glass p-8 rounded-xl">
              <p className="text-sm text-muted-foreground">
                {impersonado
                  ? 'Esse vendedor não tem kommo_user_id sincronizado em bronze.kommo_users (provavelmente inativo no Kommo).'
                  : 'Pra ver a Auditoria, seu kommo_user_id precisa estar mapeado também. Peça pro admin rodar o sync de usuários do Kommo em /admin/usuarios.'}
              </p>
            </div>
      )}
      {tab === 'desempenho' && <DesempenhoBlock vendedor={vendedor} vendedorOverride={impersonado?.vendedor} />}
    </div>
  );
}

interface ImpersonarSelectorProps {
  opcoes: { vendedor: string; kommo_user_id: number | null }[];
  atual: { vendedor: string; kommoUserId: number | null } | null;
  onChange: (next: { vendedor: string; kommoUserId: number | null } | null) => void;
}

function ImpersonarSelector({ opcoes, atual, onChange }: ImpersonarSelectorProps) {
  return (
    <div className="card-glass p-3 rounded-xl border border-amber-500/30 bg-amber-500/5">
      <div className="flex items-center gap-2 flex-wrap">
        <Eye size={14} className="text-amber-500" />
        <span className="text-xs text-amber-500 font-medium uppercase tracking-wider">Modo admin · Visualizar como vendedor</span>
        <select
          value={atual?.vendedor ?? ''}
          onChange={(e) => {
            const sel = opcoes.find((o) => o.vendedor === e.target.value);
            if (!sel) onChange(null);
            else onChange({ vendedor: sel.vendedor, kommoUserId: sel.kommo_user_id });
          }}
          className="px-2 py-1 rounded bg-secondary border border-border text-xs text-foreground"
        >
          <option value="">— sair do modo (ver minha conta) —</option>
          {opcoes.map((o) => (
            <option key={o.vendedor} value={o.vendedor}>
              {o.vendedor}
            </option>
          ))}
        </select>
        {atual && (
          <button
            onClick={() => onChange(null)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <X size={12} /> sair
          </button>
        )}
      </div>
    </div>
  );
}
