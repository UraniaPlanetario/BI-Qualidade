import { useMemo, useState } from 'react';
import { Loader2, ExternalLink } from 'lucide-react';
import { DateRangePicker } from '@/components/DateRangePicker';
import { useMeusLeadsFechados, type MeuLeadFechado } from '../hooks/useMeuVendedor';

interface Props {
  vendedor: string;
}

type DateRef = 'fechamento' | 'criacao';

const DATE_REF_LABELS: Record<DateRef, string> = {
  fechamento: 'Data de Fechamento',
  criacao: 'Data de Criação',
};

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  // Parse string YYYY-MM-DD direto pra evitar timezone shift
  const ymd = iso.length >= 10 ? iso.slice(0, 10) : null;
  if (!ymd) return '—';
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function diariasOf(l: MeuLeadFechado): number {
  const n = parseInt(l.n_diarias || '0', 10);
  return isNaN(n) ? 0 : n;
}

function ymdFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dateInRange(ref: string | null, range: { from: Date | null; to: Date | null }): boolean {
  if (!ref) return false;
  const r = ref.slice(0, 10);
  if (range.from && r < ymdFromDate(range.from)) return false;
  if (range.to && r > ymdFromDate(range.to)) return false;
  return true;
}

export function VisaoGeralBlock({ vendedor: _v }: Props) {
  const { data: leads = [], isLoading } = useMeusLeadsFechados();
  const [dateRef, setDateRef] = useState<DateRef>('fechamento');
  // Default: ano atual até hoje
  const [dateRange, setDateRange] = useState<{ from: Date | null; to: Date | null }>({
    from: new Date(new Date().getFullYear(), 0, 1),
    to: new Date(),
  });

  // Ativos (não cancelados) filtrados pela data escolhida
  const ativos = useMemo(() => {
    return leads.filter((l) => {
      if (l.cancelado) return false;
      const ref = dateRef === 'criacao' ? l.lead_created_at : l.data_fechamento_fmt;
      return dateInRange(ref, dateRange);
    });
  }, [leads, dateRef, dateRange]);

  // Cancelados filtrados pela data de cancelamento (ou criação se modo criação)
  const cancelados = useMemo(() => {
    return leads.filter((l) => {
      if (!l.cancelado) return false;
      const ref = dateRef === 'criacao' ? l.lead_created_at : l.data_cancelamento_fmt;
      return dateInRange(ref, dateRange);
    });
  }, [leads, dateRef, dateRange]);

  const stats = useMemo(() => {
    const total = ativos.length;
    const totalDiarias = ativos.reduce((s, l) => s + diariasOf(l), 0);
    const receita = ativos.reduce((s, l) => s + (l.lead_price || 0), 0);
    const ticketMedio = totalDiarias > 0 ? receita / totalDiarias : 0;
    return { total, totalDiarias, receita, ticketMedio };
  }, [ativos]);

  // Tabela: ativos ordenados por data_fechamento_fmt DESC (mais recentes primeiro)
  const tabela = useMemo(() => {
    return [...ativos].sort((a, b) => {
      const da = a.data_fechamento_fmt ?? '';
      const db = b.data_fechamento_fmt ?? '';
      return db.localeCompare(da);
    });
  }, [ativos]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="animate-spin mr-2" size={18} /> Carregando seus leads...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="card-glass p-4 rounded-xl space-y-3">
        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <label className="text-xs text-muted-foreground shrink-0">Referência de Data:</label>
          <div className="flex gap-1 flex-wrap">
            {(['fechamento', 'criacao'] as DateRef[]).map((opt) => (
              <button
                key={opt}
                onClick={() => setDateRef(opt)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  dateRef === opt
                    ? 'bg-primary text-white font-medium'
                    : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80'
                }`}
              >
                {DATE_REF_LABELS[opt]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Período</label>
          <DateRangePicker
            from={dateRange.from}
            to={dateRange.to}
            onChange={setDateRange}
            showPresets
          />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card-glass p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Leads Fechados</p>
          <p className="text-3xl font-bold text-foreground">{stats.total.toLocaleString('pt-BR')}</p>
        </div>
        <div className="card-glass p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Diárias Fechadas</p>
          <p className="text-3xl font-bold text-foreground">{stats.totalDiarias.toLocaleString('pt-BR')}</p>
        </div>
        <div className="card-glass p-4 rounded-xl text-center border border-rose-500/30">
          <p className="text-sm text-muted-foreground">Cancelamentos</p>
          <p className="text-3xl font-bold text-rose-500">{cancelados.length.toLocaleString('pt-BR')}</p>
          <p className="text-[10px] text-muted-foreground/70 mt-1 italic">
            *Pela data de cancelamento
          </p>
        </div>
        <div className="card-glass p-4 rounded-xl text-center">
          <p className="text-sm text-muted-foreground" title="Receita / total de diárias">Ticket Médio</p>
          <p className="text-xl font-bold text-foreground">{formatCurrency(stats.ticketMedio)}</p>
        </div>
      </div>

      {/* Tabela */}
      <div className="card-glass rounded-xl overflow-hidden">
        <div className="px-4 pt-4 pb-2">
          <p className="text-sm font-semibold">Seus leads fechados</p>
          <p className="text-xs text-muted-foreground mt-1">
            Ordenados pela data de fechamento (mais recentes primeiro). {tabela.length} {tabela.length === 1 ? 'lead' : 'leads'} no recorte.
          </p>
        </div>
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card border-b z-10">
              <tr>
                <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Lead</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Data fechamento</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Data agendamento</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Funil</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Etapa atual</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {tabela.map((l) => (
                <tr key={`${l.lead_id}-${l.occurrence}`} className="border-b border-border/40 hover:bg-accent/40">
                  <td className="py-1.5 px-3 truncate max-w-[260px]" title={l.lead_name ?? ''}>
                    {l.lead_name ?? `Lead #${l.lead_id}`}
                  </td>
                  <td className="py-1.5 px-3 text-muted-foreground tabular-nums">
                    {formatDate(l.data_fechamento_fmt)}
                  </td>
                  <td className="py-1.5 px-3 text-muted-foreground tabular-nums">
                    {formatDateTime(l.data_agendamento_fmt)}
                  </td>
                  <td className="py-1.5 px-3 text-muted-foreground">{l.pipeline_atual ?? '—'}</td>
                  <td className="py-1.5 px-3 text-muted-foreground">{l.status_atual ?? '—'}</td>
                  <td className="py-1.5 px-3 text-right">
                    <a
                      href={`https://uraniaplanetario.kommo.com/leads/detail/${l.lead_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                      title="Abrir no Kommo"
                    >
                      <ExternalLink size={12} />
                    </a>
                  </td>
                </tr>
              ))}
              {tabela.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    Nenhum lead no período selecionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
