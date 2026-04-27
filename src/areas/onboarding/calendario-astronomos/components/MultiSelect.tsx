import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';

export interface MultiSelectOption {
  value: string;
  label: string;
  swatch?: string;
}

interface Props {
  label: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function MultiSelect({ label, options, value, onChange, placeholder, className }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const summary =
    value.length === 0
      ? placeholder ?? 'Todos'
      : value.length === 1
      ? options.find((o) => o.value === value[0])?.label ?? value[0]
      : `${value.length} selecionados`;

  return (
    <div ref={ref} className={`relative ${className ?? ''}`}>
      <label className="text-xs text-muted-foreground block mb-1">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm border rounded bg-background hover:bg-accent/50 transition-colors"
      >
        <span className={`flex-1 text-left truncate ${value.length === 0 ? 'text-muted-foreground' : ''}`}>
          {summary}
        </span>
        {value.length > 0 && (
          <span
            role="button"
            tabIndex={0}
            onClick={clear}
            className="text-muted-foreground hover:text-foreground p-0.5"
            title="Limpar"
          >
            <X size={12} />
          </span>
        )}
        <ChevronDown size={14} className={`text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 left-0 right-0 max-h-72 overflow-y-auto border rounded-md bg-popover shadow-lg">
          {options.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">Nenhuma opção</div>
          )}
          {options.map((o) => {
            const checked = value.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => toggle(o.value)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-accent transition-colors ${
                  checked ? 'bg-accent/40' : ''
                }`}
              >
                <span
                  className={`w-3.5 h-3.5 border rounded flex items-center justify-center ${
                    checked ? 'bg-primary border-primary text-primary-foreground' : 'bg-background'
                  }`}
                >
                  {checked && <Check size={10} />}
                </span>
                {o.swatch && (
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-none"
                    style={{ background: o.swatch }}
                  />
                )}
                <span className="flex-1 truncate">{o.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
