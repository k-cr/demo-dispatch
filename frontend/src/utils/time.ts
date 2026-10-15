/**
 * Utilidades de fecha/hora en la zona horaria de la operación (no la del navegador),
 * sin dependencias externas: se apoya en Intl.DateTimeFormat.
 */

export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string, opts: Intl.DateTimeFormatOptions, locale = 'es-AR') {
  const key = `${locale}|${tz}|${JSON.stringify(opts)}`;
  let f = fmtCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, { timeZone: tz, ...opts });
    fmtCache.set(key, f);
  }
  return f;
}

interface Parts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function zonedParts(d: Date | number | string, tz: string): Parts {
  const p: Record<string, string> = {};
  for (const x of fmt(tz, {
    hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }, 'en-US').formatToParts(new Date(d))) p[x.type] = x.value;
  return { year: +p.year, month: +p.month, day: +p.day, hour: +p.hour % 24, minute: +p.minute, second: +p.second };
}

function offsetMs(d: Date, tz: string) {
  const p = zonedParts(d, tz);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(d.getTime() / 1000) * 1000;
}

/** "2026-10-04" + "08:30" interpretados en tz → instante UTC */
export function zonedToDate(date: string, time: string, tz: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const off1 = offsetMs(new Date(guess), tz);
  let t = guess - off1;
  const off2 = offsetMs(new Date(t), tz);
  if (off2 !== off1) t = guess - off2;
  return new Date(t);
}

const pad = (n: number) => String(n).padStart(2, '0');

export const toDateStr = (d: Date | number | string, tz: string) => {
  const p = zonedParts(d, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
};
export const toTimeStr = (d: Date | number | string, tz: string) => {
  const p = zonedParts(d, tz);
  return `${pad(p.hour)}:${pad(p.minute)}`;
};
export const fmtDate = (d: Date | number | string, tz: string) => {
  const p = zonedParts(d, tz);
  return `${pad(p.day)}/${pad(p.month)}/${p.year}`;
};
export const fmtShortDate = (d: Date | number | string, tz: string) => {
  const p = zonedParts(d, tz);
  return `${pad(p.day)}/${pad(p.month)}`;
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const fmtWeekday = (d: Date | number | string, tz: string, style: 'long' | 'short' = 'long') =>
  cap(fmt(tz, { weekday: style }).format(new Date(d)).replace('.', ''));

export function fmtDuration(minutes: number) {
  const m = Math.round(minutes);
  if (Math.abs(m) < 60) return `${m} min`;
  const h = Math.trunc(m / 60);
  const r = Math.abs(m % 60);
  return r ? `${h} h ${r} min` : `${h} h`;
}

/** Fechas "YYYY-MM-DD" como días de calendario (sin zona horaria) */
export function addDays(date: string, n: number) {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function isoWeek(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  const dow = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dow);
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  return { week: Math.ceil(((t.getTime() - yearStart) / DAY + 1) / 7), year: t.getUTCFullYear() };
}

export const timeToMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export const roundTo = (t: number, step: number) => Math.round(t / step) * step;
