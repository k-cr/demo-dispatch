import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from 'lucide-react';
import type { Checklist, ChecklistItem, DispatchConfig, StandardTask } from '../../types';
import { useSaveChecklist } from '../../hooks/useDispatchData';
import { Modal } from '../ui/Modal';
import { Button, IconButton } from '../ui/Button';
import { Field, Input, Select, Textarea } from '../ui/Field';

interface Props {
  open: boolean;
  checklist: Checklist | null;
  config: DispatchConfig;
  standardTasks: StandardTask[];
  onClose: () => void;
}

type Form = Pick<Checklist, 'code' | 'name' | 'description' | 'equipment_type_id' | 'active' | 'standard_task_ids'> & { items: ChecklistItem[] };

export function ChecklistModal({ open, checklist, config, standardTasks, onClose }: Props) {
  const save = useSaveChecklist();
  const [f, setF] = useState<Form | null>(null);

  useEffect(() => {
    if (!open) return;
    setF(
      checklist
        ? { ...checklist, items: checklist.items.map((i) => ({ ...i })) }
        : { code: '', name: '', description: '', equipment_type_id: null, active: true, standard_task_ids: [], items: [] },
    );
  }, [open, checklist]);

  if (!f) return null;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF({ ...f, [k]: v });
  const setItem = (i: number, patch: Partial<ChecklistItem>) => set('items', f.items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const move = (i: number, d: -1 | 1) => {
    const items = [...f.items];
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]];
    set('items', items);
  };
  const addItem = () =>
    set('items', [...f.items, { section: f.items[f.items.length - 1]?.section ?? null, description: '', sort_order: f.items.length + 1, required: true }]);

  const submit = () =>
    save.mutate(
      {
        id: checklist?.id,
        body: {
          ...f,
          code: f.code || null,
          description: f.description || null,
          items: f.items.filter((i) => i.description.trim()).map((i, k) => ({ ...i, sort_order: k + 1 })),
        },
      },
      { onSuccess: onClose },
    );

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="xl"
      title={checklist ? `Editar checklist · ${checklist.name}` : 'Nuevo checklist'}
      subtitle="Ítems que el operador verifica al ejecutar la tarea"
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" icon={Save} loading={save.isPending} disabled={!f.name.trim()} onClick={submit}>
            Guardar checklist
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-12 gap-3">
        <Field label="Código" className="col-span-2">
          <Input value={f.code ?? ''} onChange={(e) => set('code', e.target.value)} className="font-mono" placeholder="PD-004" />
        </Field>
        <Field label="Nombre" className="col-span-5">
          <Input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Checklist Diario CAT 777G" />
        </Field>
        <Field label="Tipo de equipo" className="col-span-3">
          <Select value={f.equipment_type_id ?? ''} onChange={(e) => set('equipment_type_id', e.target.value ? Number(e.target.value) : null)}>
            <option value="">Cualquiera</option>
            {config.equipmentTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Estado" className="col-span-2">
          <Select value={f.active ? '1' : '0'} onChange={(e) => set('active', e.target.value === '1')}>
            <option value="1">Activo</option>
            <option value="0">Inactivo</option>
          </Select>
        </Field>
        <Field label="Descripción" className="col-span-12">
          <Textarea rows={2} value={f.description ?? ''} onChange={(e) => set('description', e.target.value)} />
        </Field>

        <div className="col-span-8">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-semibold text-primary-700">Ítems ({f.items.length})</span>
            <Button size="xs" icon={Plus} onClick={addItem}>
              Agregar ítem
            </Button>
          </div>
          <div className="max-h-[46vh] overflow-y-auto rounded-md border border-gray-200">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 bg-gray-50 text-left text-[11px] uppercase text-gray-500">
                <tr>
                  <th className="w-8 px-2 py-1.5">#</th>
                  <th className="w-40 px-1 py-1.5">Sección</th>
                  <th className="px-1 py-1.5">Descripción</th>
                  <th className="w-12 px-1 py-1.5 text-center">Oblig.</th>
                  <th className="w-24" />
                </tr>
              </thead>
              <tbody>
                {f.items.map((it, i) => (
                  <tr key={it.id ?? `n${i}`} className="border-t border-gray-100">
                    <td className="px-2 text-[11px] text-gray-400">{i + 1}</td>
                    <td className="px-1 py-1">
                      <input value={it.section ?? ''} onChange={(e) => setItem(i, { section: e.target.value || null })} className="h-7 w-full rounded border border-gray-200 px-1.5 text-[12px]" />
                    </td>
                    <td className="px-1 py-1">
                      <input value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} className="h-7 w-full rounded border border-gray-200 px-1.5" />
                    </td>
                    <td className="text-center">
                      <input type="checkbox" className="accent-primary-700" checked={it.required} onChange={(e) => setItem(i, { required: e.target.checked })} aria-label="Obligatorio" />
                    </td>
                    <td className="whitespace-nowrap px-1 text-right">
                      <IconButton icon={ArrowUp} label="Subir" className="h-6 w-6" onClick={() => move(i, -1)} />
                      <IconButton icon={ArrowDown} label="Bajar" className="h-6 w-6" onClick={() => move(i, 1)} />
                      <IconButton icon={Trash2} label="Quitar" className="h-6 w-6 hover:text-red-600" onClick={() => set('items', f.items.filter((_, j) => j !== i))} />
                    </td>
                  </tr>
                ))}
                {!f.items.length && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
                      Sin ítems. Agregue los puntos de control.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="col-span-4">
          <span className="mb-1 block text-xs font-semibold text-primary-700">Vinculado a tareas estándar</span>
          <div className="max-h-[46vh] space-y-0.5 overflow-y-auto rounded-md border border-gray-200 p-1.5">
            {standardTasks.map((t) => (
              <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[13px] hover:bg-gray-50">
                <input
                  type="checkbox"
                  className="accent-primary-700"
                  checked={f.standard_task_ids.includes(t.id)}
                  onChange={() =>
                    set('standard_task_ids', f.standard_task_ids.includes(t.id) ? f.standard_task_ids.filter((x) => x !== t.id) : [...f.standard_task_ids, t.id])
                  }
                />
                <span className="font-mono text-[11px] text-gray-500">{t.code}</span>
                <span className="truncate">{t.name}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
