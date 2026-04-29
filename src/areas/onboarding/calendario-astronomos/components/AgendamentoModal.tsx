import { createPortal } from 'react-dom';
import { X, MapPin, Calendar as CalIcon, GraduationCap, Tag, Phone, Users as UsersIcon, ExternalLink } from 'lucide-react';
import {
  Agendamento, AuditFlags, formatDateTime, formatDate, formatCurrency, statusLabel, statusColorClass,
  colorForAstronomo, astronomoDisplay, nomesBatem, datasBatem, auditoriaTarefaSuspeita,
  kommoLeadUrl, getFlags,
} from '../types';

interface Props {
  open: boolean;
  agendamento: Agendamento | null;
  onClose: () => void;
  auditFlags?: Map<number, AuditFlags>;
}

export function AgendamentoModal({ open, agendamento, onClose, auditFlags }: Props) {
  if (!open || !agendamento) return null;
  const a = agendamento;
  const f = auditFlags
    ? getFlags(auditFlags, a.task_id)
    : {
        nome: !nomesBatem(a.astronomo, a.astronomo_card),
        data: !datasBatem(a.data_conclusao, a.data_agendamento),
        tarefa: auditoriaTarefaSuspeita(a),
      };
  const flagNome = f.nome, flagData = f.data, flagTarefa = f.tarefa;

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div
        className="bg-card border rounded-lg shadow-xl w-full max-w-2xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-4 border-b">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ background: colorForAstronomo(a.astronomo) }}
              />
              <span className="text-xs font-semibold tracking-wide text-muted-foreground">
                {astronomoDisplay(a.astronomo)} · {a.desc_tarefa ?? '—'}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColorClass(a.status_tarefa)}`}>
                {statusLabel(a.status_tarefa)}
              </span>
            </div>
            <h2 className="text-lg font-semibold leading-tight">{a.nome_escola ?? '(escola não vinculada)'}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{a.cidade_estado ?? '—'}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent text-muted-foreground">
            <X size={18} />
          </button>
        </div>

        {(flagNome || flagData || flagTarefa) && (
          <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-xs text-amber-900 dark:text-amber-200 flex flex-wrap gap-3">
            {flagNome && <span>⚠ Nome do responsável diverge do astrônomo da tarefa</span>}
            {flagData && <span>⚠ Data da tarefa diverge da data agendada no lead</span>}
            {flagTarefa && <span>⚠ Tarefa ≠ VISITA, mas há data agendada no lead</span>}
          </div>
        )}

        <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Field icon={CalIcon} label="Tarefa programada para" value={formatDateTime(a.data_conclusao)} />
          <Field icon={CalIcon} label="Data agendada (lead)" value={formatDateTime(a.data_agendamento)} />
          <Field icon={Tag} label="Turno" value={a.turno} />
          <Field icon={Tag} label="Nº de diárias" value={a.numero_diarias} />
          <Field icon={UsersIcon} label="Nº de alunos" value={a.numero_alunos} />
          <Field icon={Tag} label="Cúpula" value={a.cupula} />
          <Field icon={Tag} label="Segmento" value={a.segmento} />
          <Field icon={Tag} label="Produtos" value={a.produtos} />
          <Field icon={Tag} label="Conteúdo da apresentação" value={a.conteudo_apresentacao} colSpan />
          <Field icon={MapPin} label="Endereço" value={a.endereco} colSpan />
          <Field icon={MapPin} label="Local de instalação" value={a.local_instalacao} colSpan />
          <Field icon={GraduationCap} label="Astrônomo (no card do lead)" value={a.astronomo_card} />
          <Field icon={GraduationCap} label="Responsável da escola" value={a.responsavel_evento} />
          <Field icon={Phone} label="Telefone" value={a.telefone_responsavel} />
          <Field icon={Tag} label="Brinde" value={a.brinde} />
          <Field icon={Tag} label="Valor da venda" value={formatCurrency(a.valor_venda)} />
          <Field icon={Tag} label="Cliente desde" value={a.cliente_desde} />
          <Field icon={Tag} label="Produtos já contratados" value={a.produtos_contratados} colSpan />
          {(a.nps || a.nota_nps) && (
            <Field icon={Tag} label="NPS" value={(a.nps ?? a.nota_nps) ?? '—'} />
          )}
          {a.avaliacao_geral && <Field icon={Tag} label="Avaliação geral" value={a.avaliacao_geral} />}
          {a.avaliacao_astronomo && <Field icon={Tag} label="Avaliação astrônomo" value={a.avaliacao_astronomo} colSpan />}
        </div>

        <div className="px-4 py-2 border-t text-[10px] text-muted-foreground flex justify-between items-center">
          <span>Tarefa #{a.task_id}</span>
          <span className="flex items-center gap-2">
            {kommoLeadUrl(a.lead_id) && (
              <a
                href={kommoLeadUrl(a.lead_id)!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Abrir no Kommo <ExternalLink size={10} />
              </a>
            )}
            <span>Lead #{a.lead_id ?? '—'} · criado em {formatDate(a.data_criacao)}</span>
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Field({
  icon: Icon, label, value, colSpan,
}: {
  icon: any; label: string; value: string | number | null | undefined; colSpan?: boolean;
}) {
  if (value == null || value === '' || value === '—') {
    return (
      <div className={colSpan ? 'col-span-2' : ''}>
        <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Icon size={11} /> {label}</p>
        <p className="text-sm text-muted-foreground/60">—</p>
      </div>
    );
  }
  return (
    <div className={colSpan ? 'col-span-2' : ''}>
      <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Icon size={11} /> {label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}
