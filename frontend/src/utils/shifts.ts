import type { RangeMode, Shift } from '../types';
import { addDays, fmtDate, fmtWeekday, isoWeek, timeToMinutes, toDateStr, toTimeStr, zonedParts, zonedToDate, DAY } from './time';

const sorted = (shifts: Shift[]) => [...shifts].sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));

/** Minutos desde medianoche en que comienza la jornada operativa (primer turno) */
export const dayStartMinutes = (shifts: Shift[]) => (shifts.length ? timeToMinutes(sorted(shifts)[0].start_time) : 0);

export function shiftContains(shift: Shift, minutes: number) {
  const s = timeToMinutes(shift.start_time);
  const e = timeToMinutes(shift.end_time);
  return e > s ? minutes >= s && minutes < e : minutes >= s || minutes < e;
}

export function currentShift(shifts: Shift[], tz: string, at = new Date()) {
  const p = zonedParts(at, tz);
  return shifts.find((s) => shiftContains(s, p.hour * 60 + p.minute)) ?? null;
}

/** Fecha operativa: antes del inicio del primer turno pertenece a la jornada anterior */
export function operationalDate(shifts: Shift[], tz: string, at = new Date()) {
  return toDateStr(at.getTime() - dayStartMinutes(shifts) * 60_000, tz);
}

/** Paso de navegación anterior/siguiente según el rango */
export function stepPeriod(
  range: RangeMode,
  date: string,
  shiftId: number | null,
  shifts: Shift[],
  dir: 1 | -1,
): { date: string; shiftId: number | null } {
  if (range === 'shift') {
    const list = sorted(shifts);
    const idx = Math.max(0, list.findIndex((s) => s.id === shiftId));
    const next = idx + dir;
    if (next >= list.length) return { date: addDays(date, 1), shiftId: list[0].id };
    if (next < 0) return { date: addDays(date, -1), shiftId: list[list.length - 1].id };
    return { date, shiftId: list[next].id };
  }
  const days = { day: 1, week: 7, '2weeks': 14, '4weeks': 28 }[range];
  return { date: addDays(date, days * dir), shiftId };
}

/** Segmentos de turno que cubren la ventana [from, to) — para encabezado y sombreado */
export function shiftSegments(shifts: Shift[], tz: string, from: number, to: number) {
  const segs: { shift: Shift; start: number; end: number; date: string }[] = [];
  let date = addDays(toDateStr(from, tz), -1);
  const last = toDateStr(to, tz);
  // Recorremos días y armamos cada turno con su hora local
  for (let guard = 0; guard < 40 && date <= last; guard++, date = addDays(date, 1)) {
    for (const s of sorted(shifts)) {
      const start = localInstant(date, s.start_time, tz);
      let end = localInstant(date, s.end_time, tz);
      if (end <= start) end += DAY;
      if (end > from && start < to) segs.push({ shift: s, start: Math.max(start, from), end: Math.min(end, to), date });
    }
  }
  return segs;
}

const localInstant = (date: string, time: string, tz: string) => zonedToDate(date, time, tz).getTime();

/** Título del período ("Semana 40 - 2026", "Lunes 28/09/2026 - Domingo 04/10/2026") */
export function periodLabel(range: RangeMode, from: string, to: string, tz: string, shift?: Shift | null) {
  const f = new Date(from);
  const date = toDateStr(f, tz);
  const { week, year } = isoWeek(date);

  if (range === 'shift') {
    return {
      title: `${shift?.name ?? 'Turno'} · ${fmtWeekday(f, tz)} ${fmtDate(f, tz)}`,
      subtitle: `${toTimeStr(f, tz)} → ${toTimeStr(to, tz)}${toDateStr(to, tz) !== date ? ` (${fmtWeekday(to, tz, 'short')} ${fmtDate(to, tz).slice(0, 5)})` : ''} · Semana ${week} - ${year}`,
    };
  }
  if (range === 'day') {
    return {
      title: `${fmtWeekday(f, tz)} ${fmtDate(f, tz)}`,
      subtitle: `Jornada ${toTimeStr(f, tz)} → ${toTimeStr(to, tz)} del ${fmtDate(to, tz).slice(0, 5)} · Semana ${week} - ${year}`,
    };
  }
  // Rango semanal: días operativos (la jornada del domingo termina el lunes 07:00)
  const days = Math.round((new Date(to).getTime() - f.getTime()) / DAY);
  const lastDate = addDays(date, days - 1);
  const noon = (d: string) => `${d}T12:00:00Z`;
  const lastWeek = isoWeek(lastDate).week;
  return {
    title: week === lastWeek ? `Semana ${week} - ${year}` : `Semanas ${week}–${lastWeek} - ${year}`,
    subtitle: `${fmtWeekday(noon(date), 'UTC')} ${fmtDate(noon(date), 'UTC')} - ${fmtWeekday(noon(lastDate), 'UTC')} ${fmtDate(noon(lastDate), 'UTC')}`,
  };
}
