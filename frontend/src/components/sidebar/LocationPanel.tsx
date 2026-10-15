import { useMemo } from 'react';
import clsx from 'clsx';
import { Building2, Layers, MapPin, Mountain, Truck } from 'lucide-react';
import type { Location, Project, TaskExecution } from '../../types';
import { useDispatchStore } from '../../store/dispatchStore';
import { Field, Select } from '../ui/Field';
import { locationChain } from '../layout/FiltersBar';

interface Props {
  projects: Project[];
  locations: Location[];
  executions: TaskExecution[];
  now: number;
}

/** Selector Proyecto → Zona → Frente → Nivel. Filtra el Gantt por ubicación. */
export function LocationPanel({ projects, locations, executions, now }: Props) {
  const { projectId, setProject, filters, setFilter } = useDispatchStore();
  const chain = locationChain(locations, filters.locationId);
  const level = (depth: number) => chain[depth] ?? null;
  const children = (parent: Location | null) => (parent ? locations.filter((l) => l.parent_id === parent.id) : []);
  const roots = locations.filter((l) => l.parent_id === null);

  // Tareas y equipos activos por ubicación (incluye descendientes)
  const stats = useMemo(() => {
    const m = new Map<number, { tasks: number; active: Set<number> }>();
    const byId = new Map(locations.map((l) => [l.id, l]));
    for (const e of executions) {
      let cur = e.location_id ? byId.get(e.location_id) : undefined;
      const running = Date.parse(e.planned_start) <= now && Date.parse(e.planned_end) > now && e.status !== 'cancelada';
      while (cur) {
        const s = m.get(cur.id) ?? { tasks: 0, active: new Set<number>() };
        s.tasks += 1;
        if (running) s.active.add(e.equipment_id);
        m.set(cur.id, s);
        cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
      }
    }
    return m;
  }, [executions, locations, now]);

  const project = projects.find((p) => p.id === projectId);

  const selector = (depth: number, label: string, Icon: typeof MapPin, options: Location[]) => (
    <Field label={label}>
      <Select
        icon={Icon}
        compact
        value={level(depth)?.id ?? ''}
        disabled={!options.length}
        onChange={(e) => setFilter('locationId', e.target.value ? Number(e.target.value) : level(depth - 1)?.id ?? null)}
      >
        <option value="">{options.length ? 'Todos' : '—'}</option>
        {options.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </Select>
    </Field>
  );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <section className="space-y-3 border-b border-gray-200 p-3">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Ubicación de la operación</h3>
        <Field label="Proyecto">
          <Select icon={Building2} compact value={projectId ?? ''} onChange={(e) => setProject(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Todos los proyectos</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        {selector(0, 'Zona', Mountain, roots)}
        {selector(1, 'Frente', MapPin, children(level(0)))}
        {selector(2, 'Nivel', Layers, children(level(1)))}

        <div className="rounded-lg border border-primary-100 bg-primary-50/60 p-2.5 text-[12px]">
          <div className="text-[10px] font-bold uppercase tracking-wider text-primary-700">Seleccionado</div>
          <div className="mt-0.5 font-semibold text-gray-900">{project?.name ?? 'Todos los proyectos'}</div>
          <div className="text-gray-600">{chain.length ? chain.map((c) => c.name).join(' / ') : 'Todas las ubicaciones'}</div>
        </div>
      </section>

      <section className="p-2">
        <h3 className="px-1 pb-1 text-[11px] font-bold uppercase tracking-wider text-gray-500">Frentes de trabajo</h3>
        <ul className="text-[13px]">
          {locations.map((l) => {
            const s = stats.get(l.id);
            const selected = filters.locationId === l.id;
            return (
              <li key={l.id}>
                <button
                  onClick={() => setFilter('locationId', selected ? null : l.id)}
                  className={clsx('flex w-full items-center gap-1.5 rounded-md py-1 pr-1.5 text-left', selected ? 'bg-primary-50 text-primary-800' : 'hover:bg-gray-50')}
                  style={{ paddingLeft: 6 + l.depth * 14 }}
                >
                  <MapPin className={clsx('h-3.5 w-3.5 shrink-0', selected ? 'text-primary-700' : 'text-gray-400')} />
                  <span className={clsx('min-w-0 flex-1 truncate', l.depth === 0 && 'font-semibold')}>{l.name}</span>
                  {s && s.active.size > 0 && (
                    <span className="flex items-center gap-0.5 rounded bg-emerald-50 px-1 text-[10px] font-semibold text-emerald-700" title="Equipos trabajando ahora">
                      <Truck className="h-3 w-3" />
                      {s.active.size}
                    </span>
                  )}
                  <span className="w-6 text-right text-[10px] tabular-nums text-gray-400">{s?.tasks ?? 0}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
