import { memo } from 'react';
import clsx from 'clsx';
import { Moon, Sun } from 'lucide-react';
import type { Shift, ZoomDef, ZoomLevel } from '../../types';
import { fmtShortDate, fmtWeekday, toTimeStr, zonedParts, HOUR, MIN } from '../../utils/time';

interface Props {
  from: number;
  to: number;
  width: number;
  zoom: ZoomLevel;
  zoomDef: ZoomDef;
  tz: string;
  segments: { shift: Shift; start: number; end: number; date: string }[];
}

export const TOP_H = 24;
const ddmm = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;
export const BOTTOM_H = 30;

function TimeHeaderImpl({ from, to, width, zoom, zoomDef, tz, segments }: Props) {
  const px = zoomDef.pxPerHour;
  const x = (t: number) => ((t - from) / HOUR) * px;
  const tickMs = zoomDef.tickMinutes * MIN;

  const ticks: { t: number; major: boolean; label: string | null }[] = [];
  if (zoom === 'hours') {
    for (let t = from; t < to; t += 15 * MIN) {
      const p = zonedParts(t, tz);
      ticks.push({ t, major: p.minute === 0, label: p.minute === 0 ? toTimeStr(t, tz) : p.minute === 30 ? ':30' : null });
    }
  } else {
    for (let t = from; t < to; t += tickMs) {
      const p = zonedParts(t, tz);
      ticks.push({ t, major: true, label: zoom === 'week' ? `${String(p.hour).padStart(2, '0')}h` : toTimeStr(t, tz) });
    }
  }

  return (
    <div className="relative" style={{ width, height: TOP_H + BOTTOM_H }}>
      {/* Fila superior: turnos */}
      <div className="absolute inset-x-0 top-0 border-b border-gray-200" style={{ height: TOP_H }}>
        {segments.map((s) => {
          const w = x(s.end) - x(s.start);
          const night = s.shift.code === 'NOCHE' || s.shift.start_time >= '18:00';
          const Icon = night ? Moon : Sun;
          return (
            <div
              key={`${s.date}-${s.shift.id}`}
              className={clsx(
                'absolute top-0 flex h-full items-center gap-1 overflow-hidden whitespace-nowrap border-l px-2 text-[11px] font-semibold',
                night ? 'border-slate-300 bg-slate-100 text-slate-700' : 'border-amber-200 bg-amber-50 text-amber-900',
              )}
              style={{ left: x(s.start), width: w }}
              title={`${s.shift.name} · ${fmtWeekday(s.start, tz)} ${fmtShortDate(s.start, tz)}`}
            >
              <Icon className="h-3 w-3 shrink-0" aria-hidden />
              {w > 150 ? `${s.shift.name} · ${fmtWeekday(s.date + 'T12:00:00Z', 'UTC', 'short')} ${ddmm(s.date)}` : w > 70 ? `${night ? 'Noche' : 'Día'} ${ddmm(s.date)}` : ''}
            </div>
          );
        })}
      </div>
      {/* Fila inferior: escala horaria */}
      <div className="absolute inset-x-0 bottom-0" style={{ height: BOTTOM_H }}>
        {ticks.map(({ t, major, label }) => (
          <div key={t} className="absolute bottom-0 top-0" style={{ left: x(t) }}>
            <div className={clsx('absolute bottom-0 w-px', major ? 'h-2.5 bg-gray-400' : 'h-1.5 bg-gray-300')} />
            {label && (
              <span
                className={clsx(
                  'absolute top-1.5 whitespace-nowrap tabular-nums',
                  t === from ? 'left-1' : '-translate-x-1/2',
                  major ? 'text-[11px] font-semibold text-gray-700' : 'text-[10px] text-gray-400',
                )}
              >
                {label}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export const TimeHeader = memo(TimeHeaderImpl);
