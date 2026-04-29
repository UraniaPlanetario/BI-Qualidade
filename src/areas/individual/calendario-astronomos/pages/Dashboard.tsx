import { useMemo, useState } from 'react';
import { Loader2, Calendar, ListTodo, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useMeusAgendamentos } from '../hooks/useMeusAgendamentos';
import { ProximoAgendamento } from '../components/ProximoAgendamento';
import { CalendarioAgendamentos } from '@/areas/onboarding/calendario-astronomos/components/CalendarioAgendamentos';
import { MapaAgendamentos } from '@/areas/onboarding/calendario-astronomos/components/MapaAgendamentos';
import { ListaAgendamentos } from '@/areas/onboarding/calendario-astronomos/components/ListaAgendamentos';
import { AgendamentoModal } from '@/areas/onboarding/calendario-astronomos/components/AgendamentoModal';
import type { Agendamento } from '@/areas/onboarding/calendario-astronomos/types';

type TabId = 'agenda' | 'concluidas';

const TABS: { id: TabId; label: string; icon: any }[] = [
  { id: 'agenda', label: 'Agenda', icon: Calendar },
  { id: 'concluidas', label: 'Concluídas', icon: ListTodo },
];

export default function MeuCalendarioDashboard() {
  const { user } = useAuth();
  const { data: agendamentos = [], isLoading } = useMeusAgendamentos();
  const [tab, setTab] = useState<TabId>('agenda');
  const [selected, setSelected] = useState<Agendamento | null>(null);

  const abertos = useMemo(
    () => agendamentos.filter((a) => !a.is_completed),
    [agendamentos],
  );
  const concluidos = useMemo(
    () => agendamentos
      .filter((a) => a.is_completed)
      .sort((a, b) =>
        (b.data_conclusao ?? '').localeCompare(a.data_conclusao ?? '')
      ),
    [agendamentos],
  );

  // Caso o usuário não tenha o campo `astronomo` preenchido, a RPC retorna vazio.
  // Mostra mensagem amigável explicando.
  const semVinculo = !isLoading && agendamentos.length === 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="animate-spin mr-2" size={18} /> Carregando seus agendamentos…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Meus Agendamentos</h1>
        <p className="text-sm text-muted-foreground">
          {user?.full_name ? `Olá, ${user.full_name}. ` : ''}
          Suas visitas, pré-visitas e reservas.
        </p>
      </div>

      {semVinculo ? (
        <div className="card-glass p-8 rounded-xl flex items-start gap-3">
          <AlertCircle className="text-amber-500 flex-none" size={20} />
          <div>
            <p className="font-semibold">Seu usuário ainda não está vinculado a um astrônomo</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Pra ver seus agendamentos aqui, peça pro admin preencher o campo
              "Astrônomo" no seu perfil em /admin/usuarios. O nome precisa bater
              exatamente com o usado no Kommo (ex: "Aline", "Procópio",
              "Matheus Magalhães").
            </p>
          </div>
        </div>
      ) : (
        <>
          {tab === 'agenda' && <ProximoAgendamento agendamentos={abertos} />}

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
                <span className="text-[10px] text-muted-foreground/60">
                  ({id === 'agenda' ? abertos.length : concluidos.length})
                </span>
              </button>
            ))}
          </div>

          {tab === 'agenda' && (
            <div className="space-y-4">
              <CalendarioAgendamentos
                agendamentos={abertos}
                onSelect={setSelected}
                height={620}
              />
              <MapaAgendamentos
                agendamentos={abertos}
                onSelect={setSelected}
                height={500}
              />
              <div>
                <h3 className="text-sm font-semibold mb-2 text-muted-foreground">
                  Lista ({abertos.length})
                </h3>
                <ListaAgendamentos agendamentos={abertos} onSelect={setSelected} compact />
              </div>
            </div>
          )}

          {tab === 'concluidas' && (
            <ListaAgendamentos
              agendamentos={concluidos}
              onSelect={setSelected}
              compact
              emptyLabel="Você ainda não tem visitas concluídas no histórico."
            />
          )}

          <AgendamentoModal
            open={!!selected}
            agendamento={selected}
            onClose={() => setSelected(null)}
            compact
          />
        </>
      )}
    </div>
  );
}
