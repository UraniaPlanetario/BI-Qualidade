import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, subWeeks, isSameMonth, isSameDay, isWithinInterval, setMonth, setYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { LeadClosed, ClosedFilters, DateRefField, DATE_REF_LABELS } from '../types';

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
        <span className="text-sm font-medium text-foreground">{decade} – {decade + 9}</span>
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

// --- Date Range Picker ---

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
    ? `${format(localFrom, 'dd/MM/yyyy')} – ${format(localTo, 'dd/MM/yyyy')}`
    : localFrom
    ? `${format(localFrom, 'dd/MM/yyyy')} – ...`
    : null;

  const hasValue = localFrom || localTo;
  const secondMonth = addMonths(baseMonth, 1);

  const applyQuick = (from: Date, to: Date) => {
    setLocalFrom(from);
    setLocalTo(to);
    setBaseMonth(from);
    onChange({ from, to });
  };

  const today = new Date();
  const quickFilters = [
    { label: 'Esta Semana', action: () => { applyQuick(startOfWeek(today), endOfWeek(today)); } },
    { label: 'Última Semana', action: () => { const prev = subWeeks(today, 1); applyQuick(startOfWeek(prev), endOfWeek(prev)); } },
    { label: 'Este Mês', action: () => { applyQuick(startOfMonth(today), today); } },
    { label: 'Último Mês', action: () => { const prev = subMonths(today, 1); applyQuick(startOfMonth(prev), endOfMonth(prev)); } },
    { label: 'Este Ano', action: () => { applyQuick(new Date(today.getFullYear(), 0, 1), today); } },
  ];

  return (
    <div className="relative" ref={triggerRef}>
      <label className="text-xs text-muted-foreground mb-1 block">Data</label>
      <button
        type="button"
        onClick={() => { setOpen(!open); setViewMode('days'); }}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg bg-secondary border border-border text-xs text-foreground text-left"
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
      <div className="flex flex-wrap gap-1 mt-1">
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

// --- Main Filter Bar ---

interface Props {
  leads: LeadClosed[];
  filters: ClosedFilters;
  onFiltersChange: (f: ClosedFilters) => void;
}

export function ClosedFilterBar({ leads, filters, onFiltersChange }: Props) {
  const vendedores = useMemo(() => {
    return Array.from(new Set(leads.map((l) => l.vendedor).filter(Boolean) as string[])).sort();
  }, [leads]);

  const astronomos = useMemo(() => {
    return Array.from(new Set(leads.map((l) => l.astronomo).filter(Boolean) as string[])).sort();
  }, [leads]);

  const hasFilters = filters.vendedores.length > 0 || filters.astronomos.length > 0 || filters.cancelado !== 'all' ||
    filters.dateRange.from || filters.dateRange.to || filters.dateRef !== 'fechamento';

  const toggleVendedor = (v: string) => {
    const next = filters.vendedores.includes(v)
      ? filters.vendedores.filter((x) => x !== v)
      : [...filters.vendedores, v];
    onFiltersChange({ ...filters, vendedores: next });
  };

  const toggleAstronomo = (v: string) => {
    const next = filters.astronomos.includes(v)
      ? filters.astronomos.filter((x) => x !== v)
      : [...filters.astronomos, v];
    onFiltersChange({ ...filters, astronomos: next });
  };

  const statusOptions: { value: ClosedFilters['cancelado']; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'nao', label: 'Ativos' },
    { value: 'sim', label: 'Cancelados' },
  ];

  const dateRefOptions: { value: DateRefField; label: string }[] = [
    { value: 'fechamento', label: DATE_REF_LABELS.fechamento },
    { value: 'criacao', label: DATE_REF_LABELS.criacao },
  ];

  return (
    <div className="card-glass p-4 mb-6 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Filtros</h3>
        {hasFilters && (
          <button
            onClick={() => onFiltersChange({ vendedores: [], astronomos: [], cancelado: 'all', dateRange: { from: null, to: null }, dateRef: 'fechamento' })}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <X size={12} /> Limpar
          </button>
        )}
      </div>

      {/* Referência de Data — meta-filtro que muda como o filtro de período é interpretado */}
      <div className="flex flex-col md:flex-row md:items-center gap-2 pb-2 border-b border-border/50">
        <label className="text-xs text-muted-foreground shrink-0">Referência de Data:</label>
        <div className="flex gap-1 flex-wrap">
          {dateRefOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onFiltersChange({ ...filters, dateRef: opt.value })}
              className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                filters.dateRef === opt.value
                  ? 'bg-primary text-white font-medium'
                  : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-muted-foreground/70 italic md:ml-2">
          {filters.dateRef === 'fechamento'
            ? 'Filtra por data de fechamento (ou cancelamento, se cancelado).'
            : 'Filtra por data de criação do lead no CRM.'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Vendedor multiselect */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Vendedor</label>
          <select
            className="w-full px-2 py-1.5 rounded-lg bg-secondary border border-border text-sm text-foreground"
            value=""
            onChange={(e) => e.target.value && toggleVendedor(e.target.value)}
          >
            <option value="">Selecionar vendedor...</option>
            {vendedores.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          {filters.vendedores.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {filters.vendedores.map((v) => (
                <span key={v} className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                  {v} <X size={10} className="cursor-pointer" onClick={() => toggleVendedor(v)} />
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Status radio-like buttons */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Status</label>
          <div className="flex gap-1">
            {statusOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onFiltersChange({ ...filters, cancelado: opt.value })}
                className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  filters.cancelado === opt.value
                    ? 'bg-primary text-white font-medium'
                    : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Astrônomo multiselect */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Astrônomo</label>
          <select
            className="w-full px-2 py-1.5 rounded-lg bg-secondary border border-border text-sm text-foreground"
            value=""
            onChange={(e) => e.target.value && toggleAstronomo(e.target.value)}
          >
            <option value="">Selecionar astrônomo...</option>
            {astronomos.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          {filters.astronomos.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {filters.astronomos.map((v) => (
                <span key={v} className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                  {v} <X size={10} className="cursor-pointer" onClick={() => toggleAstronomo(v)} />
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Date range */}
        <DateRangePicker
          from={filters.dateRange.from}
          to={filters.dateRange.to}
          onChange={(range) => onFiltersChange({ ...filters, dateRange: range })}
        />
      </div>
    </div>
  );
}
