import { AlarmClock, Ban, CalendarClock, CheckCircle2, OctagonPause, Play, type LucideIcon } from 'lucide-react';
import type { ExecutionStatus } from '../types';

/**
 * Estilo visual por estado. Cada estado combina color + icono + patrón + etiqueta,
 * para no depender solo del color (accesibilidad).
 */
export interface StatusStyle {
  label: string;
  short: string;
  icon: LucideIcon;
  /** clases del bloque en el Gantt */
  block: string;
  /** clases de la etiqueta/badge */
  badge: string;
  dot: string;
  pattern?: 'stripes' | 'dashed';
}

export const STATUS: Record<ExecutionStatus, StatusStyle> = {
  planificada: {
    label: 'Planificada',
    short: 'PLAN',
    icon: CalendarClock,
    block: 'bg-white border-slate-300 text-slate-700',
    badge: 'bg-slate-100 text-slate-700 ring-slate-300',
    dot: 'bg-slate-400',
    pattern: 'dashed',
  },
  en_ejecucion: {
    label: 'En ejecución',
    short: 'EJEC',
    icon: Play,
    block: 'bg-primary-700 border-primary-800 text-white',
    badge: 'bg-primary-50 text-primary-700 ring-primary-200',
    dot: 'bg-primary-600',
  },
  finalizada: {
    label: 'Finalizada',
    short: 'FIN',
    icon: CheckCircle2,
    block: 'bg-emerald-50 border-emerald-500 text-emerald-900',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    dot: 'bg-emerald-600',
  },
  demorada: {
    label: 'Demorada',
    short: 'DEM',
    icon: AlarmClock,
    block: 'bg-amber-50 border-amber-500 text-amber-900',
    badge: 'bg-amber-50 text-amber-800 ring-amber-300',
    dot: 'bg-amber-500',
  },
  detenida: {
    label: 'Detenida',
    short: 'DET',
    icon: OctagonPause,
    block: 'bg-red-50 border-red-500 text-red-800',
    badge: 'bg-red-50 text-red-700 ring-red-200',
    dot: 'bg-red-600',
    pattern: 'stripes',
  },
  cancelada: {
    label: 'Cancelada',
    short: 'CANC',
    icon: Ban,
    block: 'bg-gray-100 border-gray-300 text-gray-500',
    badge: 'bg-gray-100 text-gray-600 ring-gray-300',
    dot: 'bg-gray-400',
    pattern: 'stripes',
  },
};

export const STATUS_ORDER: ExecutionStatus[] = [
  'planificada',
  'en_ejecucion',
  'finalizada',
  'demorada',
  'detenida',
  'cancelada',
];

/** Estados que no se pueden mover/redimensionar en el Gantt */
export const LOCKED_STATUSES: ExecutionStatus[] = ['finalizada', 'cancelada'];

export const EQUIPMENT_STATUS: Record<string, { label: string; cls: string }> = {
  operativo: { label: 'Operativo', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  mantenimiento: { label: 'Mantenimiento', cls: 'bg-amber-50 text-amber-800 ring-amber-200' },
  standby: { label: 'Standby', cls: 'bg-slate-100 text-slate-600 ring-slate-300' },
  fuera_servicio: { label: 'Fuera de servicio', cls: 'bg-red-50 text-red-700 ring-red-200' },
};
