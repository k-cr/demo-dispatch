import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { ChevronDown, ChevronRight, ClipboardCheck, Filter, GitBranch, GripVertical, Pencil, Plus, Search } from 'lucide-react';
import type { DispatchConfig, StandardTask, TaskExecution } from '../../types';
import { useDispatchStore } from '../../store/dispatchStore';
import { fmtDuration } from '../../utils/time';
import { DND_MIME } from '../gantt/Gantt';
import { categoryIcon } from './categoryIcons';

interface Props {
  config: DispatchConfig;
  tasks: StandardTask[];
  executions: TaskExecution[];
  onEdit: (task: StandardTask | null, categoryId?: number) => void;
}

export function StandardTaskTree({ config, tasks, executions, onEdit }: Props) {
  const { filters, setFilter } = useDispatchStore();
  const [q, setQ] = useState('');
  const [rootOpen, setRootOpen] = useState(true);
  const [closed, setClosed] = useState<Record<number, boolean>>({});

  const execCount = useMemo(() => {
    const m = new Map<number, number>();
    executions.forEach((e) => m.set(e.standard_task_id, (m.get(e.standard_task_id) ?? 0) + 1));
    return m;
  }, [executions]);

  const term = q.trim().toLowerCase();
  const categories = [...config.categories].sort((a, b) => a.sort_order - b.sort_order);
  const visible = (t: StandardTask) => !term || `${t.name} ${t.code} ${t.category_name}`.toLowerCase().includes(term);
  const allOpen = categories.every((c) => !closed[c.id]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2 border-b border-gray-200 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar tarea o código…"
            className="h-8 w-full rounded-md border border-gray-300 pl-8 pr-2 text-[13px] focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-gray-500">
          <span>Arrastre una tarea al Gantt para planificarla</span>
          <button
            className="font-medium text-primary-700 hover:underline"
            onClick={() => setClosed(allOpen ? Object.fromEntries(categories.map((c) => [c.id, true])) : {})}
          >
            {allOpen ? 'Contraer' : 'Expandir'}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 text-[13px]" role="tree" aria-label="Tareas estándar">
        <button
          role="treeitem"
          aria-expanded={rootOpen}
          onClick={() => setRootOpen((o) => !o)}
          className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1.5 font-bold text-gray-800 hover:bg-gray-50"
        >
          {rootOpen ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
          <GitBranch className="h-4 w-4 text-primary-700" aria-hidden />
          {config.ciclosOperativos.rootLabel}
          <span className="ml-auto text-[11px] font-normal text-gray-400">{tasks.length} tareas</span>
        </button>

        {rootOpen && (
          <div className="ml-[13px] border-l border-gray-200 pl-1.5" role="group">
            {categories.map((c) => {
              const list = tasks.filter((t) => t.category_id === c.id && visible(t));
              if (term && !list.length) return null;
              const open = !closed[c.id] || Boolean(term);
              const Icon = categoryIcon(c.icon);
              const n = list.reduce((acc, t) => acc + (execCount.get(t.id) ?? 0), 0);
              return (
                <div key={c.id} role="treeitem" aria-expanded={open} className="mt-0.5">
                  <div className="group flex items-center gap-1.5 rounded-md px-1 py-1 hover:bg-gray-50">
                    <button onClick={() => setClosed((s) => ({ ...s, [c.id]: !s[c.id] }))} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
                      {open ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: `${c.color}1F`, color: c.color }}>
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                      </span>
                      <span className="truncate font-semibold text-gray-800">{c.name}</span>
                    </button>
                    {n > 0 && (
                      <span className="rounded-full bg-gray-100 px-1.5 text-[10px] font-semibold text-gray-600" title={`${n} ejecuciones en el período`}>
                        {n}
                      </span>
                    )}
                    <button
                      onClick={() => setFilter('categoryId', filters.categoryId === c.id ? null : c.id)}
                      title={`Filtrar Gantt por ${c.name}`}
                      className={clsx(
                        'rounded p-1',
                        filters.categoryId === c.id ? 'bg-primary-100 text-primary-700' : 'text-gray-400 opacity-0 hover:bg-gray-100 group-hover:opacity-100',
                      )}
                    >
                      <Filter className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => onEdit(null, c.id)} title="Nueva tarea estándar" className="rounded p-1 text-gray-400 opacity-0 hover:bg-gray-100 group-hover:opacity-100">
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {open && (
                    <ul className="ml-[18px] border-l border-gray-200" role="group">
                      {list.map((t) => (
                        <TaskRow
                          key={t.id}
                          task={t}
                          count={execCount.get(t.id) ?? 0}
                          filtered={filters.standardTaskId === t.id}
                          onFilter={() => setFilter('standardTaskId', filters.standardTaskId === t.id ? null : t.id)}
                          onEdit={() => onEdit(t)}
                        />
                      ))}
                      {!list.length && <li className="py-1 pl-3 text-[12px] italic text-gray-400">Sin tareas</li>}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="border-t border-gray-200 p-2">
        <button
          onClick={() => onEdit(null)}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-gray-300 py-1.5 text-[13px] font-medium text-gray-600 hover:border-primary-400 hover:text-primary-700"
        >
          <Plus className="h-4 w-4" /> Nueva tarea estándar
        </button>
      </div>
    </div>
  );
}

function TaskRow({ task: t, count, filtered, onFilter, onEdit }: { task: StandardTask; count: number; filtered: boolean; onFilter: () => void; onEdit: () => void }) {
  return (
    <li
      role="treeitem"
      draggable={t.active}
      onDragStart={(e) => {
        e.dataTransfer.setData(DND_MIME, String(t.id));
        e.dataTransfer.setData('text/plain', t.name);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      className={clsx(
        'group relative ml-0 flex items-center gap-1 rounded-md py-1 pl-2 pr-1',
        'before:absolute before:left-0 before:top-1/2 before:h-px before:w-1.5 before:bg-gray-200',
        filtered ? 'bg-primary-50 ring-1 ring-primary-200' : 'hover:bg-gray-50',
        !t.active && 'opacity-50',
        t.active && 'cursor-grab active:cursor-grabbing',
      )}
    >
      <GripVertical className="h-3.5 w-3.5 shrink-0 text-gray-300 group-hover:text-gray-500" aria-hidden />
      <button onClick={onEdit} className="min-w-0 flex-1 text-left" title="Editar tarea estándar">
        <span className="flex items-center gap-1">
          <span className="truncate font-medium text-gray-800">{t.name}</span>
          {t.checklist_ids.length > 0 && <ClipboardCheck className="h-3 w-3 shrink-0 text-cyan-600" aria-label="Con checklist" />}
          {!t.active && <span className="rounded bg-gray-200 px-1 text-[9px] font-semibold uppercase text-gray-600">Inactiva</span>}
        </span>
        <span className="block truncate text-[11px] text-gray-500">
          <span className="font-mono">{t.code}</span> · {fmtDuration(t.standard_duration_min)}
          {t.required_equipment_type_name && ` · ${t.required_equipment_type_name}`}
        </span>
      </button>
      {count > 0 && <span className="text-[10px] tabular-nums text-gray-400">{count}</span>}
      <button
        onClick={onFilter}
        title="Mostrar solo esta tarea en el Gantt"
        className={clsx('rounded p-1', filtered ? 'text-primary-700' : 'text-gray-400 opacity-0 hover:bg-gray-100 group-hover:opacity-100')}
      >
        <Filter className="h-3.5 w-3.5" />
      </button>
      <button onClick={onEdit} title="Editar" className="rounded p-1 text-gray-400 opacity-0 hover:bg-gray-100 group-hover:opacity-100">
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}
