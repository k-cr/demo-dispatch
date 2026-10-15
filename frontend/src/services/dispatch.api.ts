import { http } from './api';
import type {
  Checklist,
  DispatchConfig,
  Equipment,
  ExecutionChecklist,
  Location,
  MutationResult,
  Operator,
  Project,
  RangeMode,
  StandardTask,
  TaskExecution,
  TimelineFilters,
  TimelineResponse,
} from '../types';
import {
  mockConfig,
  mockProjects,
  mockLocations,
  mockEquipment,
  mockOperators,
  mockStandardTasks,
  mockChecklists,
  getMockTimeline,
  updateMockExecution,
  createMockExecution,
  deleteMockExecution,
  getMockExecutionChecklist,
} from './mockData';

export interface TimelineParams extends TimelineFilters {
  date: string;
  range: RangeMode;
  shiftId: number | null;
  projectId: number | null;
}

export type ExecutionPayload = Partial<{
  standard_task_id: number;
  project_id: number;
  location_id: number | null;
  equipment_id: number;
  operator_id: number | null;
  shift_id: number | null;
  planned_start: string;
  planned_end: string;
  duration_min: number;
  actual_start: string | null;
  actual_end: string | null;
  status: TaskExecution['status'];
  observations: string | null;
  values: { metric_id: number; planned_value: number | null; actual_value: number | null }[];
  version: number;
}>;

async function tryFallback<T>(fn: () => Promise<T>, fallback: () => T | Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    return await fallback();
  }
}

export const DispatchApi = {
  config: () => tryFallback(() => http.get<DispatchConfig>('/dispatch/config'), () => mockConfig),
  timeline: (p: TimelineParams) =>
    tryFallback(
      () =>
        http.get<TimelineResponse>('/dispatch/timeline', {
          date: p.date,
          range: p.range,
          shift_id: p.shiftId,
          project_id: p.projectId,
          location_id: p.locationId,
          equipment_id: p.equipmentId,
          equipment_type_id: p.equipmentTypeId,
          operator_id: p.operatorId,
          standard_task_id: p.standardTaskId,
          category_id: p.categoryId,
          status: p.statuses,
        }),
      () => getMockTimeline(p.date),
    ),
  changes: (since: number) =>
    tryFallback(
      () =>
        http.get<{ lastEventId: number; events: { id: number; entity_id: number; action: string }[]; serverTime: string }>(
          '/dispatch/changes',
          { since },
        ),
      () => ({ lastEventId: since, events: [], serverTime: new Date().toISOString() }),
    ),

  projects: () => tryFallback(() => http.get<Project[]>('/projects'), () => mockProjects),
  locations: (projectId?: number | null) =>
    tryFallback(
      () => http.get<Location[]>('/locations', { project_id: projectId }),
      () => (projectId ? mockLocations.filter((l) => l.project_id === projectId) : mockLocations),
    ),
  equipment: (projectId?: number | null) =>
    tryFallback(
      () => http.get<Equipment[]>('/equipment', { project_id: projectId }),
      () => (projectId ? mockEquipment.filter((e) => e.project_id === projectId) : mockEquipment),
    ),
  operators: (projectId?: number | null) =>
    tryFallback(
      () => http.get<Operator[]>('/operators', { project_id: projectId }),
      () => (projectId ? mockOperators.filter((o) => o.project_id === projectId) : mockOperators),
    ),

  standardTasks: () => tryFallback(() => http.get<StandardTask[]>('/standard-tasks'), () => mockStandardTasks),
  createStandardTask: (body: Partial<StandardTask>) =>
    tryFallback(
      () => http.post<StandardTask>('/standard-tasks', body),
      () => ({ ...mockStandardTasks[0], ...body, id: Date.now() }),
    ),
  updateStandardTask: (id: number, body: Partial<StandardTask>) =>
    tryFallback(
      () => http.put<StandardTask>(`/standard-tasks/${id}`, body),
      () => {
        const found = mockStandardTasks.find((t) => t.id === id);
        return { ...(found ?? mockStandardTasks[0]), ...body };
      },
    ),

  execution: (id: number) =>
    tryFallback(
      () => http.get<TaskExecution>(`/task-executions/${id}`),
      () => {
        const timeline = getMockTimeline('');
        const exec = timeline.executions.find((e) => e.id === id) ?? timeline.executions[0];
        return exec;
      },
    ),
  createExecution: (body: ExecutionPayload) =>
    tryFallback(
      () => http.post<MutationResult>('/task-executions', body),
      () => ({ data: createMockExecution(body), warnings: [] }),
    ),
  updateExecution: (id: number, body: ExecutionPayload) =>
    tryFallback(
      () => http.put<MutationResult>(`/task-executions/${id}`, body),
      () => ({ data: updateMockExecution(id, body), warnings: [] }),
    ),
  deleteExecution: (id: number) =>
    tryFallback(
      () => http.del<{ id: number }>(`/task-executions/${id}`),
      () => {
        deleteMockExecution(id);
        return { id };
      },
    ),

  checklists: () => tryFallback(() => http.get<Checklist[]>('/checklists'), () => mockChecklists),
  createChecklist: (body: Partial<Checklist>) =>
    tryFallback(
      () => http.post<Checklist>('/checklists', body),
      () => ({ ...mockChecklists[0], ...body, id: Date.now() }),
    ),
  updateChecklist: (id: number, body: Partial<Checklist>) =>
    tryFallback(
      () => http.put<Checklist>(`/checklists/${id}`, body),
      () => {
        const found = mockChecklists.find((c) => c.id === id);
        return { ...(found ?? mockChecklists[0]), ...body };
      },
    ),

  executionChecklist: (id: number) =>
    tryFallback(
      () => http.get<{ task_execution_id: number; checklists: ExecutionChecklist[] }>(`/task-executions/${id}/checklist`),
      () => ({ task_execution_id: id, checklists: [getMockExecutionChecklist(id)] }),
    ),
  saveExecutionChecklist: (
    id: number,
    body: { checklist_id: number; items: { checklist_item_id: number; result: string | null; observation?: string | null }[] },
  ) =>
    tryFallback(
      () =>
        http.put<{ task_execution_id: number; checklists: ExecutionChecklist[] }>(
          `/task-executions/${id}/checklist`,
          body,
        ),
      () => ({ task_execution_id: id, checklists: [getMockExecutionChecklist(id)] }),
    ),
};
