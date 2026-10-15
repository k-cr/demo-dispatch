import { CircleDot, ClipboardCheck, Coffee, Construction, Drill, Shovel, Truck, Wrench, type LucideIcon } from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  shovel: Shovel,
  drill: Drill,
  truck: Truck,
  construction: Construction,
  'clipboard-check': ClipboardCheck,
  wrench: Wrench,
  coffee: Coffee,
};

export const categoryIcon = (name: string): LucideIcon => ICONS[name] ?? CircleDot;

export const TASK_TYPE_LABEL: Record<string, string> = {
  productiva: 'Productiva',
  soporte: 'Soporte',
  inspeccion: 'Inspección',
  mantenimiento: 'Mantenimiento',
  demora: 'Demora',
};
