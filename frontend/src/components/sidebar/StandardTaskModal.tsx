import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import type { Checklist, DispatchConfig, StandardTask, TaskType } from '../../types';
import { useSaveStandardTask } from '../../hooks/useDispatchData';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, Input, Select, Textarea } from '../ui/Field';
import { TASK_TYPE_LABEL } from './categoryIcons';

interface Props {
  open: boolean;
  task: StandardTask | null;
  defaultCategoryId?: number;
  config: DispatchConfig;
  checklists: Checklist[];
  onClose: () => void;
}

type Form = {
  code: string;
  name: string;
  category_id: number;
  task_type: TaskType;
  standard_duration_min: number;
  description: string;
  required_equipment_type_id: number | null;
  requires_operator: boolean;
  active: boolean;
  checklist_ids: number[];
  metrics: { metric_id: number; default_value: number | null }[];
};

export function StandardTaskModal({ open, task, defaultCategoryId, config, checklists, onClose }: Props) {
  const save = useSaveStandardTask();
  const [f, setF] = useState<Form | null>(null);

  useEffect(() => {
    if (!open) return;
    setF(
      task
        ? {
            code: task.code,
            name: task.name,
            category_id: task.category_id,
            task_type: task.task_type,
            standard_duration_min: task.standard_duration_min,
            description: task.description ?? '',
            required_equipment_type_id: task.required_equipment_type_id,
            requires_operator: task.requires_operator,
            active: task.active,
            checklist_ids: task.checklist_ids,
            metrics: task.metrics.map((m) => ({ metric_id: m.metric_id, default_value: m.default_value })),
          }
        : {
            code: '',
            name: '',
            category_id: defaultCategoryId ?? config.categories[0]?.id,
            task_type: 'productiva',
            standard_duration_min: 30,
            description: '',
            required_equipment_type_id: null,
            requires_operator: true,
            active: true,
            checklist_ids: [],
            metrics: [],
          },
    );
  }, [open, task, defaultCategoryId, config.categories]);

  if (!f) return null;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF({ ...f, [k]: v });
  const toggleChecklist = (id: number) =>
    set('checklist_ids', f.checklist_ids.includes(id) ? f.checklist_ids.filter((x) => x !== id) : [...f.checklist_ids, id]);
  const metricOf = (id: number) => f.metrics.find((m) => m.metric_id === id);
  const toggleMetric = (id: number) =>
    set('metrics', metricOf(id) ? f.metrics.filter((m) => m.metric_id !== id) : [...f.metrics, { metric_id: id, default_value: null }]);

  const submit = () =>
    save.mutate(
      { id: task?.id, body: { ...f, description: f.description || null } as Partial<StandardTask> },
      { onSuccess: onClose },
    );

  const valid = f.code.trim() && f.name.trim() && f.standard_duration_min > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={task ? `Editar tarea estándar · ${task.code}` : 'Nueva tarea estándar'}
      subtitle="Definición del catálogo de tareas del ciclo operativo"
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" icon={Save} loading={save.isPending} disabled={!valid} onClick={submit}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-6 gap-3">
        <Field label="Código" className="col-span-2">
          <Input value={f.code} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="ACA-05" className="font-mono" />
        </Field>
        <Field label="Nombre" className="col-span-4">
          <Input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Traslado cargado" />
        </Field>
        <Field label="Categoría" className="col-span-3">
          <Select value={f.category_id} onChange={(e) => set('category_id', Number(e.target.value))}>
            {config.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tipo de tarea" className="col-span-3">
          <Select value={f.task_type} onChange={(e) => set('task_type', e.target.value as TaskType)}>
            {Object.entries(TASK_TYPE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Duración estándar (min)" className="col-span-2">
          <Input type="number" min={1} value={f.standard_duration_min} onChange={(e) => set('standard_duration_min', Number(e.target.value))} />
        </Field>
        <Field label="Equipo requerido" className="col-span-2">
          <Select value={f.required_equipment_type_id ?? ''} onChange={(e) => set('required_equipment_type_id', e.target.value ? Number(e.target.value) : null)}>
            <option value="">Cualquier equipo</option>
            {config.equipmentTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Estado" className="col-span-2">
          <Select value={f.active ? '1' : '0'} onChange={(e) => set('active', e.target.value === '1')}>
            <option value="1">Activa</option>
            <option value="0">Inactiva</option>
          </Select>
        </Field>
        <label className="col-span-6 flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" className="h-4 w-4 accent-primary-700" checked={f.requires_operator} onChange={(e) => set('requires_operator', e.target.checked)} />
          Requiere operador asignado
        </label>
        <Field label="Descripción" className="col-span-6">
          <Textarea rows={2} value={f.description} onChange={(e) => set('description', e.target.value)} />
        </Field>

        <div className="col-span-3">
          <span className="mb-1 block text-xs font-semibold text-primary-700">Checklists asociados</span>
          <div className="max-h-44 space-y-0.5 overflow-y-auto rounded-md border border-gray-200 p-1.5">
            {checklists.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-start gap-2 rounded px-1.5 py-1 text-[13px] hover:bg-gray-50">
                <input type="checkbox" className="mt-0.5 accent-primary-700" checked={f.checklist_ids.includes(c.id)} onChange={() => toggleChecklist(c.id)} />
                <span>
                  {c.name}
                  <span className="block text-[11px] text-gray-500">{c.items.length} ítems{c.equipment_type_name && ` · ${c.equipment_type_name}`}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="col-span-3">
          <span className="mb-1 block text-xs font-semibold text-primary-700">Magnitudes plan vs real</span>
          <div className="space-y-1 rounded-md border border-gray-200 p-1.5">
            {config.metrics.map((m) => {
              const sel = metricOf(m.id);
              return (
                <div key={m.id} className="flex items-center gap-2 px-1.5 py-0.5 text-[13px]">
                  <input type="checkbox" className="accent-primary-700" checked={!!sel} onChange={() => toggleMetric(m.id)} aria-label={m.name} />
                  <span className="flex-1">{m.name}</span>
                  {sel && (
                    <input
                      type="number"
                      step="any"
                      placeholder="Plan"
                      value={sel.default_value ?? ''}
                      onChange={(e) =>
                        set('metrics', f.metrics.map((x) => (x.metric_id === m.id ? { ...x, default_value: e.target.value === '' ? null : Number(e.target.value) } : x)))
                      }
                      className="h-7 w-20 rounded border border-gray-300 px-1.5 text-right text-[12px]"
                    />
                  )}
                  <span className="w-6 text-[11px] text-gray-400">{m.unit}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}
