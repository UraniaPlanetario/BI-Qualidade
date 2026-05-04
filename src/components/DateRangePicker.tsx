import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, subWeeks, isSameMonth, isSameDay,
  isWithinInterval, setMonth, setYear, format,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, X, ChevronLeft, ChevronRight } from 'lucide-react';

type ViewMode = 'days' | 'months' | 'years';

const MONTH_NAMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const WEEKDAY_NAMES = ['D','S','T','Q','Q','S','S'];

function CalendarMonth({
  month, rangeFrom, rangeTo, onDayClick, onCaptionClick, onPrev, onNext, showNav,
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
    for (let i = 0; i < 7; i++) { week.push(day); day = addDays(day, 1); }
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
        {showNav === 'left' || showNav === 'both' ? (
          <button onClick={onPrev} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"><ChevronLeft size={14} /></button>
        ) : <div className="w-6" />}
        <button onClick={onCaptionClick} className="text-sm font-medium text-foreground hover:text-primary transition-colors capitalize">
          {format(month, 'MMMM yyyy', { locale: ptBR })}
        </button>
        {showNav === 'right' || showNav === 'both' ? (
          <button onClick={onNext} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"><ChevronRight size={14} /></button>
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
                  !inMonth ? 'text-muted-foreground/30 cursor-default'
                    : selected ? 'bg-primary text-white font-medium'
                    : inRange ? 'bg-primary/20 text-foreground'
                    : today ? 'text-primary font-bold hover:bg-primary/20'
                    : 'text-foreground hover:bg-secondary'
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

function MonthPicker({ year, onSelect, onYearClick }: {
  year: number; onSelect: (month: number) => void; onYearClick: () => void;
}) {
  return (
    <div className="w-[460px]">
      <div className="flex items-center justify-center mb-3">
        <button onClick={onYearClick} className="text-sm font-medium text-foreground hover:text-primary transition-colors">{year}</button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {MONTH_NAMES.map((name, i) => (
          <button key={i} onClick={() => onSelect(i)} className="py-2 px-3 rounded-lg text-sm text-foreground hover:bg-primary/20 hover:text-primary transition-colors">
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

function YearPicker({ currentYear, onSelect }: { currentYear: number; onSelect: (year: number) => void; }) {
  const [decade, setDecade] = useState(Math.floor(currentYear / 10) * 10);
  return (
    <div className="w-[460px]">
      <div className="flex items-center justify-between mb-3 px-1">
        <button onClick={() => setDecade(decade - 10)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"><ChevronLeft size={14} /></button>
        <span className="text-sm font-medium text-foreground">{decade} - {decade + 9}</span>
        <button onClick={() => setDecade(decade + 10)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"><ChevronRight size={14} /></button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 12 }, (_, i) => decade - 1 + i).map((yr) => (
          <button
            key={yr}
            onClick={() => onSelect(yr)}
            className={`py-2 px-3 rounded-lg text-sm transition-colors ${
              yr === currentYear ? 'bg-primary text-white'
                : yr < decade || yr > decade + 9 ? 'text-muted-foreground/50 hover:bg-secondary'
                : 'text-foreground hover:bg-primary/20 hover:text-primary'
            }`}
          >
            {yr}
          </button>
        ))}
      </div>
    </div>
  );
}

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

interface DateRangePickerProps {
  from: Date | null;
  to: Date | null;
  onChange: (range: DateRange) => void;
  className?: string;
  placeholder?: string;
  /** Quando true, mostra uma linha de atalhos (Esta semana / Último mês / etc) abaixo do botão. */
  showPresets?: boolean;
}

/** DateRangePicker padrão dos dashboards: dois meses lado a lado, com clique no
 *  título do mês alterna pra picker de mês/ano. Renderiza no portal pra evitar
 *  clipping em containers com overflow. */
export function DateRangePicker({ from, to, onChange, className, placeholder, showPresets }: DateRangePickerProps) {
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
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
      setViewMode('days');
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const applyPreset = useCallback((from: Date, to: Date) => {
    setLocalFrom(from);
    setLocalTo(to);
    setBaseMonth(from);
    onChange({ from, to });
    setTimeout(() => { setOpen(false); setViewMode('days'); }, 150);
  }, [onChange]);

  const presets = useMemo(() => {
    const today = new Date();
    return [
      { label: 'Esta semana',    from: startOfWeek(today),                       to: endOfWeek(today) },
      { label: 'Última semana',  from: startOfWeek(subWeeks(today, 1)),          to: endOfWeek(subWeeks(today, 1)) },
      { label: 'Este mês',       from: startOfMonth(today),                      to: endOfMonth(today) },
      { label: 'Último mês',     from: startOfMonth(subMonths(today, 1)),        to: endOfMonth(subMonths(today, 1)) },
      { label: 'Este ano',       from: new Date(today.getFullYear(), 0, 1),      to: today },
    ];
  }, []);

  const handleDayClick = useCallback((date: Date) => {
    if (!localFrom || (localFrom && localTo)) {
      setLocalFrom(date); setLocalTo(null);
      onChange({ from: date, to: null });
    } else {
      const start = date < localFrom ? date : localFrom;
      const end = date < localFrom ? localFrom : date;
      setLocalFrom(start); setLocalTo(end);
      onChange({ from: start, to: end });
      setTimeout(() => { setOpen(false); setViewMode('days'); }, 300);
    }
  }, [localFrom, localTo, onChange]);

  const displayText =
    localFrom && localTo
      ? `${format(localFrom, 'dd/MM/yyyy')} - ${format(localTo, 'dd/MM/yyyy')}`
      : localFrom
      ? `${format(localFrom, 'dd/MM/yyyy')} - ...`
      : null;

  const hasValue = localFrom || localTo;
  const secondMonth = addMonths(baseMonth, 1);

  return (
    <div className={`relative ${className ?? ''}`} ref={triggerRef}>
      <button
        type="button"
        onClick={() => { setOpen(!open); setViewMode('days'); }}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground text-left"
      >
        <Calendar size={14} className="text-muted-foreground shrink-0" />
        {displayText
          ? <span className="text-foreground">{displayText}</span>
          : <span className="text-muted-foreground/70 italic">{placeholder ?? 'Selecionar período...'}</span>}
        {hasValue && (
          <X
            size={12}
            className="ml-auto text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
            onClick={(e) => { e.stopPropagation(); onChange({ from: null, to: null }); }}
          />
        )}
      </button>

      {showPresets && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p.from, p.to)}
              className="text-[11px] px-2 py-0.5 rounded-full border border-border text-muted-foreground hover:bg-primary/20 hover:text-primary hover:border-primary/40 transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {open && createPortal(
        <div
          ref={popoverRef}
          className="fixed p-4 rounded-xl shadow-2xl border border-border flex gap-4"
          style={(() => {
            const rect = triggerRef.current?.getBoundingClientRect();
            if (!rect) return { background: 'hsl(260, 30%, 10%)', zIndex: 9999 };
            // Largura estimada: view 'days' tem atalhos + 2 calendários (~640px);
            // 'months'/'years' são menores (~492px). Estimativa conservadora
            // pra não vazar da viewport quando o trigger está no canto direito.
            const popoverWidth = viewMode === 'days' ? 640 : 492;
            const margin = 8;
            const maxLeft = window.innerWidth - popoverWidth - margin;
            const left = Math.max(margin, Math.min(rect.left, maxLeft));
            return {
              top: rect.bottom + 4,
              left,
              background: 'hsl(260, 30%, 10%)',
              zIndex: 9999,
            };
          })()}
        >
          {viewMode === 'days' && (
            <div className="flex flex-col gap-1 pr-3 border-r border-border min-w-[120px]">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 mb-1">Atalhos</p>
              {presets.map((p) => (
                <button
                  key={p.label}
                  onClick={() => applyPreset(p.from, p.to)}
                  className="text-left text-xs text-foreground hover:bg-primary/20 hover:text-primary rounded-md px-2 py-1.5 transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
          {viewMode === 'days' && (
            <div className="flex gap-4">
              <CalendarMonth
                month={baseMonth} rangeFrom={localFrom} rangeTo={localTo}
                onDayClick={handleDayClick}
                onCaptionClick={() => setViewMode('months')}
                onPrev={() => setBaseMonth(subMonths(baseMonth, 1))}
                showNav="left"
              />
              <CalendarMonth
                month={secondMonth} rangeFrom={localFrom} rangeTo={localTo}
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
              onSelect={(m) => { setBaseMonth(setMonth(baseMonth, m)); setViewMode('days'); }}
              onYearClick={() => setViewMode('years')}
            />
          )}
          {viewMode === 'years' && (
            <YearPicker
              currentYear={baseMonth.getFullYear()}
              onSelect={(yr) => { setBaseMonth(setYear(baseMonth, yr)); setViewMode('months'); }}
            />
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
