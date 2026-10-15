import type { TaskExecution } from '../types';

export interface PlacedExecution {
  exec: TaskExecution;
  start: number;
  end: number;
  lane: number;
  /** Se superpone con otra tarea activa del mismo equipo */
  overlap: boolean;
}

/**
 * Asigna carriles (lanes) para que las tareas superpuestas de un mismo equipo
 * no se tapen: algoritmo greedy por hora de inicio.
 */
export function assignLanes(items: { exec: TaskExecution; start: number; end: number }[]) {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const laneEnds: number[] = [];
  const placed: PlacedExecution[] = sorted.map((it) => {
    let lane = laneEnds.findIndex((end) => end <= it.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(it.end);
    } else laneEnds[lane] = it.end;
    return { ...it, lane, overlap: false };
  });

  // Marca superposiciones reales (las canceladas no cuentan)
  const active = placed.filter((p) => p.exec.status !== 'cancelada');
  for (let i = 0; i < active.length; i++)
    for (let j = i + 1; j < active.length && active[j].start < active[i].end; j++) {
      active[i].overlap = true;
      active[j].overlap = true;
    }

  return { placed, lanes: Math.max(1, laneEnds.length) };
}

/** ¿La tarea debería estar ejecutándose ahora y no lo está? */
export const isLateToStart = (e: TaskExecution, now: number) =>
  (e.status === 'planificada' || e.status === 'demorada') &&
  new Date(e.planned_start).getTime() <= now &&
  new Date(e.planned_end).getTime() > now;

/** ¿Está en ejecución y ya superó su fin planificado? */
export const isOverrun = (e: TaskExecution, now: number) =>
  e.status === 'en_ejecucion' && new Date(e.planned_end).getTime() < now;

export const checklistPercent = (e: TaskExecution) =>
  e.checklist_total ? Math.round(((e.checklist_answered ?? 0) / e.checklist_total) * 100) : null;
