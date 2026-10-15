import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { CheckCheck, ClipboardCheck, Loader2, Plus, Save } from 'lucide-react';
import type { Checklist, ChecklistResult, ExecutionChecklist as ExecChecklist } from '../../types';
import { useExecutionChecklist, useSaveExecutionChecklist } from '../../hooks/useDispatchData';
import { Button } from '../ui/Button';
import { Select } from '../ui/Field';
import { fmtDate, toTimeStr } from '../../utils/time';

const RESULT: { value: ChecklistResult; label: string; cls: string; on: string }[] = [
  { value: 'ok', label: 'OK', cls: 'hover:bg-emerald-50', on: 'bg-emerald-600 text-white border-emerald-600' },
  { value: 'no_ok', label: 'NO OK', cls: 'hover:bg-red-50', on: 'bg-red-600 text-white border-red-600' },
  { value: 'na', label: 'N/A', cls: 'hover:bg-gray-100', on: 'bg-gray-500 text-white border-gray-500' },
];

const STATUS_LABEL: Record<ExecChecklist['status'], { label: string; cls: string }> = {
  pendiente: { label: 'Pendiente', cls: 'bg-gray-100 text-gray-600' },
  en_progreso: { label: 'En progreso', cls: 'bg-amber-50 text-amber-800' },
  completado: { label: 'Completado', cls: 'bg-emerald-50 text-emerald-700' },
  rechazado: { label: 'Rechazado', cls: 'bg-red-50 text-red-700' },
};

/** Registro y consulta del checklist asociado a una ejecución de tarea */
export function ExecutionChecklist({ executionId, allChecklists, tz }: { executionId: number; allChecklists: Checklist[]; tz: string }) {
  const { data, isLoading } = useExecutionChecklist(executionId);
  const save = useSaveExecutionChecklist(executionId);
  const [extra, setExtra] = useState('');

  if (isLoading) return <div className="flex items-center gap-2 p-6 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Cargando checklist…</div>;
  const lists = data?.checklists ?? [];
  const available = allChecklists.filter((c) => c.active && !lists.some((l) => l.checklist_id === c.id));

  return (
    <div className="space-y-4">
      {lists.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 p-5 text-center text-sm text-gray-500">
          <ClipboardCheck className="mx-auto mb-1 h-6 w-6 text-gray-300" />
          Esta tarea no tiene checklists vinculados.
        </div>
      )}
      {lists.map((c) => (
        <ChecklistCard key={c.checklist_id} checklist={c} tz={tz} saving={save.isPending} onSave={(items) => save.mutate({ checklist_id: c.checklist_id, items })} />
      ))}

      {available.length > 0 && (
        <div className="flex items-end gap-2 rounded-lg bg-gray-50 p-3">
          <div className="flex-1">
            <span className="mb-1 block text-xs font-semibold text-primary-700">Asociar otro checklist a esta ejecución</span>
            <Select compact value={extra} onChange={(e) => setExtra(e.target.value)}>
              <option value="">Seleccionar checklist…</option>
              {available.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <Button
            icon={Plus}
            disabled={!extra}
            loading={save.isPending}
            onClick={() => save.mutate({ checklist_id: Number(extra), items: [] }, { onSuccess: () => setExtra('') })}
          >
            Asociar
          </Button>
        </div>
      )}
    </div>
  );
}

type Answers = Record<number, { result: ChecklistResult | null; observation: string }>;

function ChecklistCard({ checklist: c, tz, saving, onSave }: { checklist: ExecChecklist; tz: string; saving: boolean; onSave: (items: { checklist_item_id: number; result: ChecklistResult | null; observation: string | null }[]) => void }) {
  const initial = useMemo<Answers>(
    () => Object.fromEntries(c.items.map((i) => [i.checklist_item_id, { result: i.result, observation: i.observation ?? '' }])),
    [c],
  );
  const [answers, setAnswers] = useState<Answers>(initial);
  useEffect(() => setAnswers(initial), [initial]);

  const answered = Object.values(answers).filter((a) => a.result).length;
  const failed = Object.values(answers).filter((a) => a.result === 'no_ok').length;
  const pct = c.items.length ? Math.round((answered / c.items.length) * 100) : 0;
  const dirty = JSON.stringify(answers) !== JSON.stringify(initial);
  const st = STATUS_LABEL[c.status];

  const set = (id: number, patch: Partial<Answers[number]>) => setAnswers((a) => ({ ...a, [id]: { ...a[id], ...patch } }));
  const allOk = () => setAnswers((a) => Object.fromEntries(Object.entries(a).map(([k, v]) => [k, { ...v, result: v.result ?? 'ok' }])));

  let section: string | null | undefined;
  return (
    <section className="overflow-hidden rounded-lg border border-gray-200">
      <header className="border-b border-gray-200 bg-gray-50 px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-gray-900">{c.name}</div>
            <div className="text-[11px] text-gray-500">
              {c.code && <span className="font-mono">{c.code} · </span>}
              {c.items.length} ítems
              {c.completed_at && ` · completado ${fmtDate(c.completed_at, tz)} ${toTimeStr(c.completed_at, tz)}`}
            </div>
          </div>
          <span className={clsx('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold', st.cls)}>{st.label}</span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className={clsx('h-full rounded-full', failed ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[12px] font-semibold tabular-nums text-gray-700">{pct}% completado</span>
          {failed > 0 && <span className="text-[12px] font-semibold text-red-600">{failed} NO OK</span>}
        </div>
      </header>

      <ul className="max-h-[38vh] divide-y divide-gray-100 overflow-y-auto">
        {c.items.map((it) => {
          const a = answers[it.checklist_item_id];
          const header = it.section !== section ? it.section : null;
          section = it.section;
          return (
            <li key={it.checklist_item_id}>
              {header && <div className="bg-white px-3 pb-1 pt-2.5 text-[10px] font-bold uppercase tracking-wider text-primary-700">{header}</div>}
              <div className="flex items-center gap-2 px-3 py-1.5">
                <span className="flex-1 text-[13px] text-gray-800">
                  {it.description}
                  {it.required && <span className="ml-0.5 text-red-500" title="Obligatorio">*</span>}
                </span>
                <div className="flex shrink-0 gap-1" role="radiogroup" aria-label={it.description}>
                  {RESULT.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      role="radio"
                      aria-checked={a?.result === r.value}
                      onClick={() => set(it.checklist_item_id, { result: a?.result === r.value ? null : r.value })}
                      className={clsx('h-6 rounded border px-1.5 text-[10px] font-bold', a?.result === r.value ? r.on : clsx('border-gray-300 text-gray-500', r.cls))}
                    >
                      {r.value === 'ok' && a?.result === 'ok' ? '☑ OK' : r.label}
                    </button>
                  ))}
                </div>
              </div>
              {a?.result === 'no_ok' && (
                <div className="px-3 pb-2">
                  <input
                    value={a.observation}
                    onChange={(e) => set(it.checklist_item_id, { observation: e.target.value })}
                    placeholder="Observación del hallazgo…"
                    className="h-7 w-full rounded border border-red-200 bg-red-50/40 px-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-red-100"
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <footer className="flex items-center justify-between gap-2 border-t border-gray-200 bg-gray-50 px-3 py-2">
        <Button size="xs" icon={CheckCheck} onClick={allOk}>
          Marcar pendientes como OK
        </Button>
        <Button
          size="sm"
          variant="primary"
          icon={Save}
          disabled={!dirty}
          loading={saving}
          onClick={() =>
            onSave(
              Object.entries(answers).map(([id, v]) => ({
                checklist_item_id: Number(id),
                result: v.result,
                observation: v.result === 'no_ok' ? v.observation || null : null,
              })),
            )
          }
        >
          Guardar checklist
        </Button>
      </footer>
    </section>
  );
}
