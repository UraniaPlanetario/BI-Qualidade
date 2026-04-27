import { Search, X } from 'lucide-react';
import type { Filtros, TipoTarefa, StatusTarefa } from '../types';
import { TIPOS_TAREFA, colorForAstronomo, astronomoDisplay } from '../types';
import { MultiSelect } from './MultiSelect';
import { DateRangePicker } from '@/components/DateRangePicker';

interface Props {
  filtros: Filtros;
  onChange: (next: Filtros) => void;
  astronomos: string[];
  showAuditoriaToggles?: boolean;
  showStatusFilter?: boolean;
}

const STATUS_OPTS: { value: StatusTarefa; label: string }[] = [
  { value: 'aberta', label: 'Abertas' },
  { value: 'atrasada', label: 'Atrasadas' },
  { value: 'completa', label: 'Concluídas' },
];

export function FilterBar({ filtros, onChange, astronomos, showAuditoriaToggles, showStatusFilter }: Props) {
  const tipoOpts = TIPOS_TAREFA.map((t) => ({ value: t, label: t }));
  const astronomoOpts = astronomos.map((a) => ({
    value: a,
    label: astronomoDisplay(a),
    swatch: colorForAstronomo(a),
  }));

  return (
    <div className="bg-card border rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
        <div className="md:col-span-3">
          <label className="text-xs text-muted-foreground block mb-1">Buscar (escola / cidade)</label>
          <div className="relative">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={filtros.busca}
              onChange={(e) => onChange({ ...filtros, busca: e.target.value })}
              placeholder="ex: Colégio Santa..."
              className="w-full pl-7 pr-2 py-1.5 text-sm border rounded bg-background"
            />
          </div>
        </div>

        <div className="md:col-span-2">
          <MultiSelect
            label="Tipo de tarefa"
            options={tipoOpts}
            value={filtros.tiposTarefa}
            onChange={(v) => onChange({ ...filtros, tiposTarefa: v as TipoTarefa[] })}
            placeholder="Todos"
          />
        </div>

        {showStatusFilter && (
          <div className="md:col-span-2">
            <MultiSelect
              label="Status"
              options={STATUS_OPTS}
              value={filtros.status}
              onChange={(v) => onChange({ ...filtros, status: v as StatusTarefa[] })}
              placeholder="Todos"
            />
          </div>
        )}

        <div className={showStatusFilter ? 'md:col-span-2' : 'md:col-span-3'}>
          <MultiSelect
            label="Astrônomo"
            options={astronomoOpts}
            value={filtros.astronomos}
            onChange={(v) => onChange({ ...filtros, astronomos: v })}
            placeholder="Todos"
          />
        </div>

        <div className="md:col-span-2">
          <label className="text-xs text-muted-foreground block mb-1">Período</label>
          <DateRangePicker
            from={filtros.dateRange.from}
            to={filtros.dateRange.to}
            onChange={(range) => onChange({ ...filtros, dateRange: range })}
            showPresets
          />
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={() => onChange({
              astronomos: [], tiposTarefa: [], status: [],
              dateRange: { from: null, to: null }, busca: '',
              flagAuditoriaNome: false, flagAuditoriaData: false, flagAuditoriaTarefa: false,
            })}
            className="w-full px-3 py-1.5 text-xs border rounded text-muted-foreground hover:bg-accent flex items-center justify-center gap-1"
          >
            <X size={12} /> Limpar
          </button>
        </div>
      </div>

      {showAuditoriaToggles && (
        <div className="pt-3 border-t">
          <p className="text-xs text-muted-foreground mb-1.5">Flags de auditoria</p>
          <div className="flex flex-wrap gap-3 text-xs">
            <label className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={filtros.flagAuditoriaNome}
                onChange={(e) => onChange({ ...filtros, flagAuditoriaNome: e.target.checked })}
              />
              Auditoria Nome (astrônomo no card ≠ astrônomo da tarefa)
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={filtros.flagAuditoriaData}
                onChange={(e) => onChange({ ...filtros, flagAuditoriaData: e.target.checked })}
              />
              Auditoria Data (data tarefa ≠ data agendamento)
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={filtros.flagAuditoriaTarefa}
                onChange={(e) => onChange({ ...filtros, flagAuditoriaTarefa: e.target.checked })}
              />
              Auditoria Tarefa (tipo ≠ VISITA com agendamento)
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
