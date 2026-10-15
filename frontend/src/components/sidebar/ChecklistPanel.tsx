import { ClipboardCheck, Link2, Plus } from 'lucide-react';
import type { Checklist } from '../../types';

export function ChecklistPanel({ checklists, onEdit }: { checklists: Checklist[]; onEdit: (c: Checklist | null) => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="border-b border-gray-200 px-3 py-2 text-[12px] text-gray-500">
        Tarea estándar → Checklist → Ítems. Los resultados se registran en el detalle de cada tarea.
      </p>
      <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
        {checklists.map((c) => (
          <li key={c.id}>
            <button onClick={() => onEdit(c)} className="w-full rounded-lg border border-gray-200 bg-white p-2.5 text-left hover:border-primary-300 hover:shadow-sm">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-cyan-50 text-cyan-700">
                  <ClipboardCheck className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-gray-900">{c.name}</div>
                  <div className="text-[11px] text-gray-500">
                    {c.code && <span className="font-mono">{c.code} · </span>}
                    {c.items.length} ítems{c.equipment_type_name && ` · ${c.equipment_type_name}`}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px]">
                    <span className="flex items-center gap-0.5 text-gray-500">
                      <Link2 className="h-3 w-3" /> {c.standard_task_ids.length} tarea(s)
                    </span>
                    {!c.active && <span className="rounded bg-gray-200 px-1 text-[10px] font-semibold text-gray-600">INACTIVO</span>}
                  </div>
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>
      <div className="border-t border-gray-200 p-2">
        <button
          onClick={() => onEdit(null)}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-gray-300 py-1.5 text-[13px] font-medium text-gray-600 hover:border-primary-400 hover:text-primary-700"
        >
          <Plus className="h-4 w-4" /> Nuevo checklist
        </button>
      </div>
    </div>
  );
}
