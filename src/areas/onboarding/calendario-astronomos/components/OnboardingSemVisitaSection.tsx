import { useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import type { LeadOnboardingSemVisita } from '../types';
import { kommoLeadUrl, formatDate } from '../types';

interface Props {
  items: LeadOnboardingSemVisita[];
}

type Grupo = 'criticos' | 'com_visita_completa' | 'vazios';

const GRUPOS: { id: Grupo; label: string; description: string }[] = [
  {
    id: 'criticos',
    label: 'Críticos — agendamento futuro sem tarefa VISITA',
    description: 'O card do lead já tem data de agendamento marcada e astrônomo definido, mas nenhuma tarefa de VISITA foi criada. O astrônomo não vai receber o aviso pra ir.',
  },
  {
    id: 'com_visita_completa',
    label: 'VISITA já realizada (em fechamento administrativo)',
    description: 'Esses leads tiveram a tarefa de VISITA concluída e seguem no funil pra fechamento. Ok, mas vale conferir se realmente saíram do operacional do astrônomo.',
  },
  {
    id: 'vazios',
    label: 'Leads vazios — provavelmente movidos por engano',
    description: 'Sem escola e sem astrônomo no card. Costumam ser leads-teste ou movimentações erradas pro funil.',
  },
];

export function OnboardingSemVisitaSection({ items }: Props) {
  const [expanded, setExpanded] = useState<Record<Grupo, boolean>>({
    criticos: true,
    com_visita_completa: false,
    vazios: false,
  });

  const grupos = useMemo(() => {
    const out: Record<Grupo, LeadOnboardingSemVisita[]> = {
      criticos: [], com_visita_completa: [], vazios: [],
    };
    for (const l of items) {
      if (l.lead_vazio) out.vazios.push(l);
      else if (l.ja_teve_visita_completa) out.com_visita_completa.push(l);
      else if (l.tem_agendamento_futuro) out.criticos.push(l);
      else out.com_visita_completa.push(l); // sem agendamento futuro nem VISITA pendente — fica no balde "OK administrativo"
    }
    return out;
  }, [items]);

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <AlertTriangle size={14} className="text-amber-600" />
          Onboarding sem tarefa de VISITA
          <span className="text-xs font-normal text-muted-foreground">({items.length})</span>
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Leads ativos nos funis "Onboarding Escolas" / "Onboarding SME" sem nenhuma tarefa
          de VISITA aberta atribuída a um astrônomo. O cenário ideal é toda passagem pra
          onboarding criar uma VISITA — quem aparece aqui precisa de revisão manual.
        </p>
      </div>

      {GRUPOS.map((g) => {
        const list = grupos[g.id];
        if (list.length === 0) return null;
        const isOpen = expanded[g.id];
        return (
          <div key={g.id} className="bg-card border rounded-lg">
            <button
              onClick={() => setExpanded((p) => ({ ...p, [g.id]: !p[g.id] }))}
              className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-accent/40 transition-colors"
            >
              {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <div className="flex-1">
                <p className="text-sm font-medium">{g.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{g.description}</p>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                g.id === 'criticos'
                  ? 'bg-rose-500/15 text-rose-700 border border-rose-500/30'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {list.length}
              </span>
            </button>
            {isOpen && (
              <div className="border-t divide-y">
                {list.map((l) => (
                  <LeadRow key={l.lead_id} lead={l} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function LeadRow({ lead }: { lead: LeadOnboardingSemVisita }) {
  return (
    <div className="px-4 py-3 hover:bg-accent/30 transition-colors">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs uppercase font-semibold text-muted-foreground">
              {lead.pipeline_name}
            </span>
            {lead.astronomo_card && (
              <span className="text-xs px-1.5 py-0.5 rounded-full border bg-primary/10 text-primary border-primary/30">
                {lead.astronomo_card}
              </span>
            )}
            {lead.tem_agendamento_futuro && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-amber-500/10 text-amber-700 border-amber-500/40">
                agendamento {formatDate(lead.data_agendamento)}
              </span>
            )}
          </div>
          <p className="text-sm font-medium mt-0.5 truncate">
            {lead.nome_escola ?? <span className="text-muted-foreground italic">(sem escola)</span>}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {lead.cidade_estado ?? '—'}
            {lead.responsavel_evento && ' · ' + lead.responsavel_evento}
          </p>
          {lead.tarefas_no_lead && (
            <p className="text-[11px] text-muted-foreground/80 mt-1 line-clamp-2">
              <span className="font-semibold">Tarefas:</span> {lead.tarefas_no_lead}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-none">
          <span className="text-[10px] text-muted-foreground">#{lead.lead_id}</span>
          {kommoLeadUrl(lead.lead_id) && (
            <a
              href={kommoLeadUrl(lead.lead_id)!}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline text-xs inline-flex items-center gap-1"
            >
              Kommo <ExternalLink size={10} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
