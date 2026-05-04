import { useState, useMemo } from 'react';
import { startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { DateRangePicker } from '@/components/DateRangePicker';
import {
  useLeadsVendedor, useTempoResposta,
} from '@/areas/comercial/desempenho-vendedor/hooks/useDesempenhoVendedor';
import {
  useAlteracoesResumo, useAlteracoesMensal,
} from '@/areas/comercial/desempenho-sdr/hooks/useDesempenhoSDR';
import { BlocoTempoResposta } from '@/areas/comercial/desempenho-vendedor/components/BlocoTempoResposta';
import { BlocoCamposAlterados } from '@/areas/comercial/desempenho-vendedor/components/BlocoCamposAlterados';
import { BlocoFechamentos } from '@/areas/comercial/desempenho-vendedor/components/BlocoFechamentos';
import { BlocoDiarias } from '@/areas/comercial/desempenho-vendedor/components/BlocoDiarias';
import { BlocoFaturamento } from '@/areas/comercial/desempenho-vendedor/components/BlocoFaturamento';
import { BlocoCancelamentos } from '@/areas/comercial/desempenho-vendedor/components/BlocoCancelamentos';

interface Props {
  vendedor: string;
}

const TABS = [
  { id: 'tempo',         label: 'Tempo Resposta' },
  { id: 'campos',        label: 'Campos Alterados' },
  { id: 'fechamentos',   label: 'Fechamentos' },
  { id: 'diarias',       label: 'Diárias' },
  { id: 'faturamento',   label: 'Faturamento' },
  { id: 'cancelamentos', label: 'Cancelamentos' },
] as const;

type TabId = typeof TABS[number]['id'];

function toISO(d: Date | null): string | null {
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Espelho do dashboard /comercial/desempenho-vendedor — mesmos blocos
 *  de Tempo Resposta, Campos Alterados, Fechamentos, Diárias, Faturamento e
 *  Cancelamentos — mas com filtro de vendedor FIXO no logado.
 *
 *  Reutiliza os componentes BlocoXxx do gerencial e os mesmos hooks de dados,
 *  filtrando localmente pelo nome do vendedor (que aqui é único). */
export function DesempenhoBlock({ vendedor }: Props) {
  const today = new Date();
  // Default = "Último mês completo": começo a meio do mês, dados ainda esparsos;
  // pegar o mês anterior como referência inicial dá visualização útil já no abrir.
  // Usuário pode expandir/restringir no DateRangePicker.
  const lastMonthStart = startOfMonth(subMonths(today, 1));
  const lastMonthEnd = endOfMonth(subMonths(today, 1));
  const [dateRange, setDateRange] = useState<{ from: Date | null; to: Date | null }>({
    from: lastMonthStart,
    to: lastMonthEnd,
  });
  const [tab, setTab] = useState<TabId>('tempo');

  const dateFromISO = toISO(dateRange.from);
  const dateToISO = toISO(dateRange.to);

  const { data: leads = [], isLoading: lLoading, error: lErr } = useLeadsVendedor();
  const { data: mensagens = [], isLoading: mLoading, error: mErr } = useTempoResposta(dateFromISO, dateToISO);
  const { data: alteracoesResumo = [], isLoading: arLoading, error: arErr } = useAlteracoesResumo(dateFromISO, dateToISO);
  const { data: alteracoesMensal = [], isLoading: amLoading, error: amErr } = useAlteracoesMensal(dateFromISO, dateToISO);

  // Filtra TUDO pelo vendedor logado
  const filteredLeads = useMemo(() => leads.filter((l) => l.vendedor === vendedor), [leads, vendedor]);
  const filteredMensagens = useMemo(
    () => mensagens.filter((m) => m.responder_user_name === vendedor),
    [mensagens, vendedor],
  );
  const filteredAltResumo = useMemo(
    () => alteracoesResumo.filter((r) => r.user_name === vendedor),
    [alteracoesResumo, vendedor],
  );
  const filteredAltMensal = useMemo(
    () => alteracoesMensal.filter((r) => r.user_name === vendedor),
    [alteracoesMensal, vendedor],
  );

  // Pra blocos que filtram por data de fechamento (Fechamentos / Diárias)
  const leadsFilteredByDate = useMemo(() => {
    if (!dateFromISO && !dateToISO) return filteredLeads;
    return filteredLeads.filter((l) => {
      if (!l.data_de_fechamento) return false;
      const d = l.data_de_fechamento.slice(0, 10);
      if (dateFromISO && d < dateFromISO) return false;
      if (dateToISO && d > dateToISO) return false;
      return true;
    });
  }, [filteredLeads, dateFromISO, dateToISO]);

  const isLoading = lLoading || mLoading || arLoading || amLoading;
  const error = lErr || mErr || arErr || amErr;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="animate-spin mr-2" size={18} /> Carregando seu desempenho...
      </div>
    );
  }

  if (error) {
    return (
      <div className="card-glass p-8 rounded-xl text-center">
        <p className="text-destructive font-medium">Erro ao carregar dados</p>
        <p className="text-sm text-muted-foreground mt-2">{(error as Error).message}</p>
      </div>
    );
  }

  const applyQuick = (from: Date, to: Date) => setDateRange({ from, to });

  const quickFilters = [
    { label: 'Este Mês', action: () => applyQuick(startOfMonth(today), today) },
    { label: 'Último Mês', action: () => { const prev = subMonths(today, 1); applyQuick(startOfMonth(prev), endOfMonth(prev)); } },
    { label: 'Este Ano', action: () => applyQuick(new Date(today.getFullYear(), 0, 1), today) },
  ];

  return (
    <div className="space-y-5">
      {/* Filtro de data */}
      <div className="card-glass p-4 rounded-xl">
        <label className="text-xs text-muted-foreground block mb-1">Período</label>
        <DateRangePicker
          from={dateRange.from}
          to={dateRange.to}
          onChange={setDateRange}
        />
        <div className="flex flex-wrap gap-1 mt-2">
          {quickFilters.map((qf) => (
            <button
              key={qf.label}
              type="button"
              onClick={qf.action}
              className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/80 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            >
              {qf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="card-glass p-1 rounded-xl flex flex-wrap gap-1">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              tab === id
                ? 'bg-primary text-white font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="max-w-6xl">
        {tab === 'tempo' && <BlocoTempoResposta mensagens={filteredMensagens} />}
        {tab === 'campos' && <BlocoCamposAlterados resumo={filteredAltResumo} mensal={filteredAltMensal} />}
        {tab === 'fechamentos' && <BlocoFechamentos leads={leadsFilteredByDate} />}
        {tab === 'diarias' && <BlocoDiarias leads={leadsFilteredByDate} />}
        {tab === 'faturamento' && (
          <BlocoFaturamento
            leads={filteredLeads}
            dateFrom={dateRange.from}
            dateTo={dateRange.to}
          />
        )}
        {tab === 'cancelamentos' && (
          <BlocoCancelamentos
            leads={filteredLeads}
            dateFrom={dateRange.from}
            dateTo={dateRange.to}
          />
        )}
      </div>
    </div>
  );
}
