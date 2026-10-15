import clsx from 'clsx';
import type { ExecutionStatus } from '../../types';
import { STATUS } from '../../utils/status';

export function StatusBadge({ status, size = 'sm' }: { status: ExecutionStatus; size?: 'xs' | 'sm' }) {
  const s = STATUS[status];
  const Icon = s.icon;
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full font-semibold ring-1 ring-inset',
        size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs',
        s.badge,
      )}
    >
      <Icon className={size === 'xs' ? 'h-3 w-3' : 'h-3.5 w-3.5'} aria-hidden />
      {s.label}
    </span>
  );
}
