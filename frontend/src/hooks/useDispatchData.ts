import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { DispatchApi, type ExecutionPayload, type TimelineParams } from '../services/dispatch.api';
import { ApiError } from '../services/api';
import { useDispatchStore } from '../store/dispatchStore';
import { toast } from '../store/toastStore';
import type { Checklist, StandardTask, TaskExecution, TimelineResponse } from '../types';

const STATIC = { staleTime: 5 * 60_000 };

export const useConfig = () => useQuery({ queryKey: ['config'], queryFn: DispatchApi.config, ...STATIC });
export const useProjects = () => useQuery({ queryKey: ['projects'], queryFn: DispatchApi.projects, ...STATIC });
export const useLocations = (projectId: number | null) =>
  useQuery({ queryKey: ['locations', projectId], queryFn: () => DispatchApi.locations(projectId), ...STATIC });
export const useEquipment = (projectId: number | null) =>
  useQuery({ queryKey: ['equipment', projectId], queryFn: () => DispatchApi.equipment(projectId), ...STATIC });
export const useOperators = (projectId: number | null) =>
  useQuery({ queryKey: ['operators', projectId], queryFn: () => DispatchApi.operators(projectId), ...STATIC });
export const useStandardTasks = () => useQuery({ queryKey: ['standard-tasks'], queryFn: DispatchApi.standardTasks, ...STATIC });
export const useChecklists = () => useQuery({ queryKey: ['checklists'], queryFn: DispatchApi.checklists, ...STATIC });

/** Parámetros actuales del timeline derivados del store */
export function useTimelineParams(): TimelineParams {
  const { date, range, shiftId, projectId, filters } = useDispatchStore();
  return { date, range, shiftId, projectId, ...filters };
}

export function useTimeline() {
  const params = useTimelineParams();
  const { data: config } = useConfig();
  return useQuery({
    queryKey: ['timeline', params],
    queryFn: () => DispatchApi.timeline(params),
    enabled: Boolean(params.date),
    placeholderData: keepPreviousData, // los filtros no "parpadean" el Gantt
    refetchInterval: (config?.realtime.fullRefreshSeconds ?? 60) * 1000,
  });
}

export const useExecutionChecklist = (id: number | null) =>
  useQuery({
    queryKey: ['execution-checklist', id],
    queryFn: () => DispatchApi.executionChecklist(id!),
    enabled: id != null,
  });

// ---------------------------------------------------------------------------
//  Mutaciones
// ---------------------------------------------------------------------------

/** Aplica un cambio local a la ejecución en todos los timelines cacheados */
function patchTimelines(qc: QueryClient, id: number, patch: Partial<TaskExecution>) {
  qc.setQueriesData<TimelineResponse>({ queryKey: ['timeline'] }, (old) =>
    old ? { ...old, executions: old.executions.map((e) => (e.id === id ? { ...e, ...patch } : e)) } : old,
  );
}

function reportWarnings(warnings: { message: string }[]) {
  if (warnings.length) toast.warning('Guardado con advertencias', warnings.map((w) => w.message));
}

function reportError(err: unknown, fallback: string) {
  if (err instanceof ApiError) {
    const details = Array.isArray(err.details)
      ? (err.details as { path?: string; message: string }[]).map((d) => (d.path ? `${d.path}: ${d.message}` : d.message))
      : undefined;
    toast.error(err.status === 409 ? 'Conflicto de edición' : fallback, [err.message, ...(details ?? [])]);
  } else toast.error(fallback);
}

export function useUpdateExecution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: ExecutionPayload; optimistic?: Partial<TaskExecution> }) =>
      DispatchApi.updateExecution(id, body),
    onMutate: async ({ id, optimistic }) => {
      if (!optimistic) return;
      await qc.cancelQueries({ queryKey: ['timeline'] });
      const snapshot = qc.getQueriesData<TimelineResponse>({ queryKey: ['timeline'] });
      patchTimelines(qc, id, optimistic);
      return { snapshot };
    },
    onError: (err, _v, ctx) => {
      ctx?.snapshot?.forEach(([key, data]) => qc.setQueryData(key, data));
      reportError(err, 'No se pudo guardar la tarea');
    },
    onSuccess: (res) => {
      patchTimelines(qc, res.data.id, res.data);
      reportWarnings(res.warnings);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['timeline'] }),
  });
}

export function useCreateExecution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ExecutionPayload) => DispatchApi.createExecution(body),
    onError: (err) => reportError(err, 'No se pudo crear la tarea'),
    onSuccess: (res) => {
      toast.success(`Tarea "${res.data.task_name}" planificada en ${res.data.equipment_code}`);
      reportWarnings(res.warnings);
      qc.invalidateQueries({ queryKey: ['timeline'] });
    },
  });
}

export function useDeleteExecution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => DispatchApi.deleteExecution(id),
    onError: (err) => reportError(err, 'No se pudo eliminar la tarea'),
    onSuccess: () => {
      toast.success('Tarea eliminada');
      qc.invalidateQueries({ queryKey: ['timeline'] });
    },
  });
}

export function useSaveExecutionChecklist(executionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Parameters<typeof DispatchApi.saveExecutionChecklist>[1]) =>
      DispatchApi.saveExecutionChecklist(executionId, body),
    onError: (err) => reportError(err, 'No se pudo guardar el checklist'),
    onSuccess: (res) => {
      qc.setQueryData(['execution-checklist', executionId], res);
      toast.success('Checklist guardado');
      qc.invalidateQueries({ queryKey: ['timeline'] });
    },
  });
}

export function useSaveStandardTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: number; body: Partial<StandardTask> }) =>
      id ? DispatchApi.updateStandardTask(id, body) : DispatchApi.createStandardTask(body),
    onError: (err) => reportError(err, 'No se pudo guardar la tarea estándar'),
    onSuccess: (t) => {
      toast.success(`Tarea estándar ${t.code} guardada`);
      qc.invalidateQueries({ queryKey: ['standard-tasks'] });
      qc.invalidateQueries({ queryKey: ['checklists'] });
    },
  });
}

export function useSaveChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: number; body: Partial<Checklist> }) =>
      id ? DispatchApi.updateChecklist(id, body) : DispatchApi.createChecklist(body),
    onError: (err) => reportError(err, 'No se pudo guardar el checklist'),
    onSuccess: (c) => {
      toast.success(`Checklist "${c.name}" guardado`);
      qc.invalidateQueries({ queryKey: ['checklists'] });
      qc.invalidateQueries({ queryKey: ['standard-tasks'] });
      qc.invalidateQueries({ queryKey: ['execution-checklist'] });
    },
  });
}
