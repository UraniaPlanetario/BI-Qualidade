import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isWithinInterval,
  setMonth,
  setYear,
  format,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, X, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import {
  useLeadsVendedor,
  useTempoResposta,
  useAlteracoesCampos,
} from '../hooks/useDesempenhoVendedor';
import { VendedorFilters, normalizeUserName } from '../types';
import { BlocoTempoResposta } from '../components/BlocoTempoResposta';
import { BlocoCamposAlterados } from '../components/BlocoCamposAlterados';
import { BlocoFechamentos } from '../components/BlocoFechamentos';
import { BlocoDiarias } from '../components/BlocoDiarias';
import { BlocoFaturamento } from '../components/BlocoFaturamento';
import { BlocoCancelamentos } from '../components/BlocoCancelamentos';

// --- Calendar sub-components ---

type ViewMode = 'days' | 'months' | 'years';

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const WEEKDAY_NAMES = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function CalendarMonth({
  month,
  rangeFrom,
  rangeTo,
  onDayClick,
  onCaptionClick,
  onPrev,
  onNext,
  showNav,
}: {
  month: Date;
  rangeFrom: Date | null;
  rangeTo: Date | null;
  onDayClick: (date: Date) => void;
  onCaptionClick: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  showNav: 'left' | 'right' | 'both';
}) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);

  const weeks: Date[][] = [];
  let day = calStart;
  while (day <= calEnd) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDays(day, 1);
    }
    weeks.push(week);
  }

  const isInRange = (d: Date) => {
    if (!rangeFrom || !rangeTo) return false;
    return isWithinInterval(d, { start: rangeFrom, end: rangeTo });
  };

  const isStart = (d: Date) => rangeFrom && isSameDay(d, rangeFrom);
  const isEnd = (d: Date) => rangeTo && isSameDay(d, rangeTo);

  return (
    <div className="w-[220px]">
      <div className="flex items-center justify-between mb-2 px-1">
        {(showNav === 'left' || showNav === 'both') ? (
          <button onClick={onPrev} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground">
            <ChevronLeft size={14} />
          </button>
        ) : <div className="w-6" />}

        <button onClick={onCaptionClick} className="text-sm font-medium text-foreground hover:text-primary transition-colors capitalize">
          {format(month, 'MMMM yyyy', { locale: ptBR })}
        </button>

        {(showNav === 'right' || showNav === 'both') ? (
          <button onClick={onNext} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground">
            <ChevronRight size={14} />
          </button>
        ) : <div className="w-6" />}
      </div>

      <div className="grid grid-cols-7 mb-1">
        {WEEKDAY_NAMES.map((d, i) => (
          <div key={i} className="text-center text-[10px] text-muted-foreground font-medium py-1">{d}</div>
        ))}
      </div>

      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7">
          {week.map((d, di) => {
            const inMonth = isSameMonth(d, month);
            const selected = isStart(d) || isEnd(d);
            const inRange = isInRange(d);
            const today = isSameDay(d, new Date());

            return (
              <button
                key={di}
                onClick={() => inMonth && onDayClick(d)}
                className={`h-7 text-xs rounded transition-colors ${
                  !inMonth ? 'text-muted-foreground/30 cursor-default' :
                  selected ? 'bg-primary text-white font-medium' :
                  inRange ? 'bg-primary/20 text-foreground' :
                  today ? 'text-primary font-bold hover:bg-primary/20' :
                  'text-foreground hover:bg-secondary'
                }`}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function MonthPicker({ year, onSelect, onYearClick }: { year: number; onSelect: (month: number) => void; onYearClick: () => void }) {
  return (
    <div className="w-[460px]">
      <div className="flex items-center justify-center mb-3">
        <button onClick={onYearClick} className="text-sm font-medium text-foreground hover:text-primary transition-colors">
          {year}
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {MONTH_NAMES.map((name, i) => (
          <button
            key={i}
            onClick={() => onSelect(i)}
            className="py-2 px-3 rounded-lg text-sm text-foreground hover:bg-primary/20 hover:text-primary transition-colors"
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

function YearPicker({ currentYear, onSelect }: { currentYear: number; onSelect: (year: number) => void }) {
  const [decade, setDecade] = useState(Math.floor(currentYear / 10) * 10);

  return (
    <div className="w-[460px]">
      <div className="flex items-center justify-between mb-3 px-1">
        <button onClick={() => setDecade(decade - 10)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground">
          <ChevronLeft size={14} />
        </button>
        <span className="text-sm font-medium text-foreground">{decade} - {decade + 9}</span>
        <button onClick={() => setDecade(decade + 10)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground">
          <ChevronRight size={14} />
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 12 }, (_, i) => decade - 1 + i).map((yr) => (
          <button
            key={yr}
            onClick={() => onSelect(yr)}
            className={`py-2 px-3 rounded-lg text-sm transition-colors ${
              yr === currentYear ? 'bg-primary text-white' :
              yr < decade || yr > decade + 9 ? 'text-muted-foreground/50 hover:bg-secondary' :
              'text-foreground hover:bg-primary/20 hover:text-primary'
            }`}
          >
            {yr}
          </button>
        ))}
      </div>
    </div>
  );
}

function DateRangePicker({
  from,
  to,
  onChange,
}: {
  from: Date | null;
  to: Date | null;
  onChange: (range: { from: Date | null; to: Date | null }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('days');
  const [baseMonth, setBaseMonth] = useState(() => from ?? new Date());
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const [localFrom, setLocalFrom] = useState<Date | null>(from);
  const [localTo, setLocalTo] = useState<Date | null>(to);

  useEffect(() => { setLocalFrom(from); }, [from]);
  useEffect(() => { setLocalTo(to); }, [to]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) return;
      setOpen(false);
      setViewMode('days');
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleDayClick = useCallback((date: Date) => {
    if (!localFrom || (localFrom && localTo)) {
      setLocalFrom(date);
      setLocalTo(null);
      onChange({ from: date, to: null });
    } else {
      const start = date < localFrom ? date : localFrom;
      const end = date < localFrom ? localFrom : date;
      setLocalFrom(start);
      setLocalTo(end);
      onChange({ from: start, to: end });
      setTimeout(() => {
        setOpen(false);
        setViewMode('days');
      }, 300);
    }
  }, [localFrom, localTo, onChange]);

  const displayText = localFrom && localTo
    ? `${format(localFrom, 'dd/MM/yyyy')} - ${format(localTo, 'dd/MM/yyyy')}`
    : localFrom
    ? `${format(localFrom, 'dd/MM/yyyy')} - ...`
    : null;

  const hasValue = localFrom || localTo;
  const secondMonth = addMonths(baseMonth, 1);

  return (
    <div className="relative" ref={triggerRef}>
      <button
        type="button"
        onClick={() => { setOpen(!open); setViewMode('days'); }}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground text-left"
      >
        <Calendar size={14} className="text-muted-foreground shrink-0" />
        {displayText ? (
          <span className="text-foreground">{displayText}</span>
        ) : (
          <span className="text-muted-foreground/70 italic">Selecionar período...</span>
        )}
        {hasValue && (
          <X size={12} className="ml-auto text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
            onClick={(e) => { e.stopPropagation(); onChange({ from: null, to: null }); }}
          />
        )}
      </button>

      {open && createPortal(
        <div
          ref={popoverRef}
          className="fixed p-4 rounded-xl shadow-2xl border border-border"
          style={{
            top: triggerRef.current ? triggerRef.current.getBoundingClientRect().bottom + 4 : 0,
            left: triggerRef.current ? triggerRef.current.getBoundingClientRect().left : 0,
            background: 'hsl(260, 30%, 10%)',
            zIndex: 9999,
          }}
        >
          {viewMode === 'days' && (
            <div className="flex gap-4">
              <CalendarMonth
                month={baseMonth}
                rangeFrom={localFrom}
                rangeTo={localTo}
                onDayClick={handleDayClick}
                onCaptionClick={() => setViewMode('months')}
                onPrev={() => setBaseMonth(subMonths(baseMonth, 1))}
                showNav="left"
              />
              <CalendarMonth
                month={secondMonth}
                rangeFrom={localFrom}
                rangeTo={localTo}
                onDayClick={handleDayClick}
                onCaptionClick={() => setViewMode('months')}
                onNext={() => setBaseMonth(addMonths(baseMonth, 1))}
                showNav="right"
              />
            </div>
          )}

          {viewMode === 'months' && (
            <MonthPicker
              year={baseMonth.getFullYear()}
              onSelect={(m) => {
                setBaseMonth(setMonth(baseMonth, m));
                setViewMode('days');
              }}
              onYearClick={() => setViewMode('years')}
            />
          )}

          {viewMode === 'years' && (
            <YearPicker
              currentYear={baseMonth.getFullYear()}
              onSelect={(yr) => {
                setBaseMonth(setYear(baseMonth, yr));
                setViewMode('months');
              }}
            />
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

// --- Main Dashboard ---

const TABS = [
  { id: 'tempo', label: 'Tempo Resposta' },
  { id: 'campos', label: 'Campos Alterados' },
  { id: 'fechamentos', label: 'Fechamentos' },
  { id: 'diarias', label: 'Diárias' },
  { id: 'faturamento', label: 'Faturamento' },
  { id: 'cancelamentos', label: 'Cancelamentos' },
];

function toISO(d: Date | null): string | null {
  if (!d) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function DesempenhoVendedorDashboard() {
  const today = new Date();
  const [filters, setFilters] = useState<VendedorFilters>({
    vendedores: [],
    dateRange: {
      from: startOfMonth(today),
      to: today,
    },
  });
  const [activeTab, setActiveTab] = useState('tempo');

  const dateFromISO = toISO(filters.dateRange.from);
  const dateToISO = toISO(filters.dateRange.to);

  const { data: leads = [], isLoading: loadingLeads, error: errorLeads } = useLeadsVendedor();
  const { data: mensagens = [], isLoading: loadingMensagens, error: errorMensagens } = useTempoResposta(dateFromISO, dateToISO);
  const { data: alteracoes = [], isLoading: loadingAlteracoes, error: errorAlteracoes } = useAlteracoesCampos(dateFromISO, dateToISO);

  // Lista de vendedores disponíveis (dos leads)
  const vendedoresDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const l of leads) {
      if (l.vendedor) set.add(l.vendedor);
    }
    return Array.from(set).sort();
  }, [leads]);

  // Filtra leads pelo filtro de vendedor e dateRange (aplicado no próprio bloco para fechamento/agendamento/cancelamento)
  const filteredLeads = useMemo(() => {
    let list = leads;
    if (filters.vendedores.length > 0) {
      list = list.filter((l) => l.vendedor && filters.vendedores.includes(l.vendedor));
    }
    return list;
  }, [leads, filters.vendedores]);

  // Tempo resposta filtrado por vendedor (via responder_user_name normalizado)
  const filteredMensagens = useMemo(() => {
    if (filters.vendedores.length === 0) return mensagens;
    const normSet = new Set(filters.vendedores.map((v) => normalizeUserName(v)));
    return mensagens.filter((m) => normSet.has(normalizeUserName(m.responder_user_name)));
  }, [mensagens, filters.vendedores]);

  // Alterações filtradas por vendedor (via criado_por normalizado)
  const filteredAlteracoes = useMemo(() => {
    if (filters.vendedores.length === 0) return alteracoes;
    const normSet = new Set(filters.vendedores.map((v) => normalizeUserName(v)));
    return alteracoes.filter((a) => normSet.has(normalizeUserName(a.criado_por)));
  }, [alteracoes, filters.vendedores]);

  // Leads filtrados por data (para blocos de fechamento/diárias — usam data_de_fechamento)
  const leadsFilteredByDate = useMemo(() => {
    const from = filters.dateRange.from;
    const to = filters.dateRange.to;
    if (!from && !to) return filteredLeads;
    return filteredLeads.filter((l) => {
      if (!l.data_de_fechamento) return false;
      const d = new Date(l.data_de_fechamento);
      if (isNaN(d.getTime())) return false;
      if (from && d < from) return false;
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        if (d > end) return false;
      }
      return true;
    });
  }, [filteredLeads, filters.dateRange]);

  const toggleVendedor = (v: string) => {
    const next = filters.vendedores.includes(v)
      ? filters.vendedores.filter((x) => x !== v)
      : [...filters.vendedores, v];
    setFilters({ ...filters, vendedores: next });
  };

  const applyQuick = (from: Date, to: Date) => {
    setFilters({ ...filters, dateRange: { from, to } });
  };

  const quickFilters = [
    { label: 'Este Mês', action: () => applyQuick(startOfMonth(today), today) },
    { label: 'Último Mês', action: () => { const prev = subMonths(today, 1); applyQuick(startOfMonth(prev), endOfMonth(prev)); } },
    { label: 'Este Ano', action: () => applyQuick(new Date(today.getFullYear(), 0, 1), today) },
  ];

  const hasFilters = filters.vendedores.length > 0 || filters.dateRange.from || filters.dateRange.to;

  const isLoading = loadingLeads || loadingMensagens || loadingAlteracoes;
  const error = errorLeads || errorMensagens || errorAlteracoes;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="card-glass p-8 text-center">
          <p className="text-destructive font-medium">Erro ao carregar dados</p>
          <p className="text-sm text-muted-foreground mt-2">{(error as Error).message}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-foreground">Desempenho por Vendedor</h1>
        <p className="text-sm text-muted-foreground mt-1">Métricas individuais e comparativos de performance</p>
      </div>

      {/* Filtros */}
      <div className="card-glass p-4 mb-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">Filtros</h3>
          {hasFilters && (
            <button
              onClick={() => setFilters({ vendedores: [], dateRange: { from: null, to: null } })}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <X size={12} /> Limpar
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Vendedor multiselect */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Vendedor</label>
            <select
              className="w-full px-2 py-1.5 rounded-lg bg-secondary border border-border text-sm text-foreground"
              value=""
              onChange={(e) => e.target.value && toggleVendedor(e.target.value)}
            >
              <option value="">Selecionar vendedor...</option>
              {vendedoresDisponiveis.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            {filters.vendedores.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {filters.vendedores.map((v) => (
                  <span key={v} className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                    {v} <X size={10} className="cursor-pointer" onClick={() => toggleVendedor(v)} />
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Date range */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Período</label>
            <DateRangePicker
              from={filters.dateRange.from}
              to={filters.dateRange.to}
              onChange={(range) => setFilters({ ...filters, dateRange: range })}
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
        </div>
      </div>

      {/* Tabs */}
      <div className="card-glass p-1 rounded-xl mb-6 flex flex-wrap gap-1">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              activeTab === id
                ? 'bg-primary text-white font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="max-w-6xl">
        {activeTab === 'tempo' && <BlocoTempoResposta mensagens={filteredMensagens} />}
        {activeTab === 'campos' && <BlocoCamposAlterados alteracoes={filteredAlteracoes} />}
        {activeTab === 'fechamentos' && <BlocoFechamentos leads={leadsFilteredByDate} />}
        {activeTab === 'diarias' && <BlocoDiarias leads={leadsFilteredByDate} />}
        {activeTab === 'faturamento' && (
          <BlocoFaturamento
            leads={filteredLeads}
            dateFrom={filters.dateRange.from}
            dateTo={filters.dateRange.to}
          />
        )}
        {activeTab === 'cancelamentos' && (
          <BlocoCancelamentos
            leads={filteredLeads}
            dateFrom={filters.dateRange.from}
            dateTo={filters.dateRange.to}
          />
        )}
      </div>
    </div>
  );
}
