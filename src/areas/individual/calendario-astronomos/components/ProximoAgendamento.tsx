import { useMemo } from 'react';
import { MapPin, Phone, Users as UsersIcon, Tag, GraduationCap, ExternalLink } from 'lucide-react';
import type { Agendamento } from '@/areas/onboarding/calendario-astronomos/types';
import {
  formatDateTime, formatCurrency, statusLabel, statusColorClass,
  colorForAstronomo, kommoLeadUrl, formatPhone, googleMapsUrl,
} from '@/areas/onboarding/calendario-astronomos/types';

interface Props {
  agendamentos: Agendamento[];
}

/** Card de destaque com o próximo agendamento (data ≥ hoje, mais próxima). */
export function ProximoAgendamento({ agendamentos }: Props) {
  const proximo = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const candidatos = agendamentos
      .filter((a) => !a.is_completed && a.data_conclusao)
      .filter((a) => new Date(a.data_conclusao!) >= startOfToday)
      .sort(
        (a, b) =>
          new Date(a.data_conclusao!).getTime() - new Date(b.data_conclusao!).getTime(),
      );
    return candidatos[0] ?? null;
  }, [agendamentos]);

  if (!proximo) {
    return (
      <div className="card-glass p-6 rounded-xl text-center">
        <p className="text-sm text-muted-foreground">Você não tem nenhum agendamento futuro pendente. 🎉</p>
      </div>
    );
  }

  const a = proximo;
  const dias = diasAteHoje(a.data_conclusao!);
  const destaque =
    dias === 0 ? 'HOJE'
      : dias === 1 ? 'AMANHÃ'
      : `EM ${dias} DIAS`;

  return (
    <div
      className="card-glass rounded-xl p-6 border-l-8"
      style={{ borderLeftColor: colorForAstronomo(a.astronomo) }}
    >
      <div className="flex items-start gap-6 flex-wrap">
        {/* Bloco do destaque (HOJE / AMANHÃ / EM N DIAS) */}
        <div className="flex-none">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Próximo agendamento</p>
          <p
            className="text-4xl md:text-5xl font-extrabold tracking-tight leading-none"
            style={{ color: colorForAstronomo(a.astronomo) }}
          >
            {destaque}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {formatDateTime(a.data_conclusao)}
          </p>
          <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full border ${statusColorClass(a.status_tarefa)}`}>
            {statusLabel(a.status_tarefa)} · {a.desc_tarefa ?? '—'}
          </span>
        </div>

        {/* Bloco das informações principais */}
        <div className="flex-1 min-w-[280px] space-y-3">
          <div>
            <h2 className="text-xl font-bold leading-tight">{a.nome_escola ?? '(escola não vinculada)'}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {a.cidade_estado ?? '—'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <Field icon={Tag} label="Turno" value={a.turno} />
            <Field icon={Tag} label="Nº de diárias" value={a.numero_diarias} />
            <Field icon={UsersIcon} label="Nº de alunos" value={a.numero_alunos} />
            <Field icon={Tag} label="Cúpula" value={a.cupula} />
            <Field icon={Tag} label="Produtos" value={a.produtos} colSpan />
            <Field icon={Tag} label="Conteúdo da apresentação" value={a.conteudo_apresentacao} colSpan />
            <Field icon={MapPin} label="Endereço / local" value={a.local_instalacao ?? a.endereco} colSpan />
            <Field icon={GraduationCap} label="Responsável da escola" value={a.responsavel_evento} />
            <Field icon={Phone} label="Telefone" value={formatPhone(a.telefone_responsavel)} />
            <Field icon={Tag} label="Cliente desde" value={a.cliente_desde} />
            <Field icon={Tag} label="Produtos já contratados" value={a.produtos_contratados} colSpan />
            <Field icon={Tag} label="Brinde" value={a.brinde} />
            <Field icon={Tag} label="Valor" value={formatCurrency(a.valor_venda)} />
          </div>

          <div className="flex items-center gap-3 mt-2">
            {googleMapsUrl(a) && (
              <a
                href={googleMapsUrl(a)!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
              >
                <MapPin size={11} /> Ver no mapa
              </a>
            )}
            {kommoLeadUrl(a.lead_id) && (
              <a
                href={kommoLeadUrl(a.lead_id)!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
              >
                Abrir no Kommo <ExternalLink size={11} />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
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

function diasAteHoje(iso: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(iso);
  alvo.setHours(0, 0, 0, 0);
  return Math.round((alvo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}
