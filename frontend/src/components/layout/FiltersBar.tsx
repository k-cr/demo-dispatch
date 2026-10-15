import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { ChevronDown, ClipboardList, Filter, MapPin, Mountain, Tag, Truck, User, X } from 'lucide-react';
import type { DispatchConfig, Equipment, Location, Operator, StandardTask } from '../../types';
import { activeFilterCount, useDispatchStore } from '../../store/dispatchStore';
import { STATUS, STATUS_ORDER } from '../../utils/status';
import { Combobox } from '../ui/Combobox';
import { Select } from '../ui/Field';

interface Props {
  config: DispatchConfig;
  locations: Location[];
  equipment: Equipment[];
  operators: Operator[];
  standardTasks: StandardTask[];
}

/** Devuelve la cadena de ancestros de una ubicación (raíz → hoja) */
export function locationChain(locations: Location[], id: number | null) {
  const chain: Location[] = [];
  let cur = locations.find((l) => l.id === id);
  while (cur) {
    chain.unshift(cur);
    cur = locations.find((l) => l.id === cur!.parent_id);
  }
  return chain;
}

export function FiltersBar({ config, locations, equipment, operators, standardTasks }: Props) {
  const { filters, setFilter, toggleStatus, clearFilters } = useDispatchStore();
  const chain = locationChain(locations, filters.locationId);
  const zone = chain[0] ?? null;
  const front = chain[1] ?? null;
  const zones = locations.filter((l) => l.parent_id === null);
  const fronts = zone ? locations.filter((l) => l.parent_id === zone.id) : [];
  const count = activeFilterCount(filters);

  const eqOptions = useMemo(
    () => equipment.map((e) => ({ value: e.id, label: e.code, sublabel: e.name, group: e.equipment_type_name })),
    [equipment],
  );
  const opOptions = useMemo(
    () => operators.map((o) => ({ value: o.id, label: o.full_name, sublabel: `${o.employee_code}${o.project_name ? ` · ${o.project_name}` : ''}` })),
    [operators],
  );
  const taskOptions = useMemo(
    () => standardTasks.map((t) => ({ value: t.id, label: t.name, sublabel: t.code, group: t.category_name })),
    [standardTasks],
  );

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-4 py-2">
      <span className="mr-1 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-gray-500">
        <Filter className="h-3.5 w-3.5" aria-hidden />
        Filtros
        {count > 0 && <span className="rounded-full bg-primary-700 px-1.5 text-[10px] font-bold text-white">{count}</span>}
      </span>

      <Select
        icon={Mountain}
        compact
        aria-label="Ubicación / zona"
        className="w-44"
        value={zone?.id ?? ''}
        onChange={(e) => setFilter('locationId', e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">Ubicación: todas</option>
        {zones.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </Select>

      <Select
        icon={MapPin}
        compact
        aria-label="Frente"
        className="w-40"
        disabled={!fronts.length}
        value={front?.id ?? ''}
        onChange={(e) => setFilter('locationId', e.target.value ? Number(e.target.value) : zone?.id ?? null)}
      >
        <option value="">Frente: todos</option>
        {fronts.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </Select>

      <Combobox
        compact
        allowClear
        icon={Truck}
        ariaLabel="Equipo"
        placeholder="Equipo"
        className="w-36"
        options={eqOptions}
        value={filters.equipmentId}
        onChange={(v) => setFilter('equipmentId', v)}
      />

      <Select
        icon={Tag}
        compact
        aria-label="Tipo de equipo"
        className="w-48"
        value={filters.equipmentTypeId ?? ''}
        onChange={(e) => setFilter('equipmentTypeId', e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">Tipo: todos</option>
        {config.equipmentTypes.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </Select>

      <Combobox
        compact
        allowClear
        icon={User}
        ariaLabel="Operador"
        placeholder="Operador"
        className="w-44"
        options={opOptions}
        value={filters.operatorId}
        onChange={(v) => setFilter('operatorId', v)}
      />

      <Combobox
        compact
        allowClear
        icon={ClipboardList}
        ariaLabel="Tarea"
        placeholder="Tarea"
        className="w-44"
        options={taskOptions}
        value={filters.standardTaskId}
        onChange={(v) => setFilter('standardTaskId', v)}
      />

      <StatusFilter selected={filters.statuses} onToggle={toggleStatus} />

      {count > 0 && (
        <button onClick={clearFilters} className="ml-1 flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-primary-700 hover:bg-primary-50">
          <X className="h-3.5 w-3.5" /> Limpiar filtros
        </button>
      )}
    </div>
  );
}

function StatusFilter({ selected, onToggle }: { selected: string[]; onToggle: (s: (typeof STATUS_ORDER)[number]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          'flex h-8 items-center gap-1.5 rounded-md border bg-white px-2.5 text-[13px]',
          selected.length ? 'border-primary-300 text-primary-700' : 'border-gray-300 text-gray-500',
        )}
      >
        Estado{selected.length ? `: ${selected.length}` : ': todos'}
        <ChevronDown className="h-4 w-4 text-gray-400" />
      </button>
      {open && (
        <div className="absolute left-0 z-50 mt-1 w-52 rounded-lg border border-gray-200 bg-white p-1 shadow-xl">
          {STATUS_ORDER.map((s) => {
            const st = STATUS[s];
            const Icon = st.icon;
            return (
              <label key={s} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-50">
                <input type="checkbox" className="accent-primary-700" checked={selected.includes(s)} onChange={() => onToggle(s)} />
                <Icon className="h-3.5 w-3.5 text-gray-500" aria-hidden />
                {st.label}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
