import { forwardRef, type ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'xs' | 'sm' | 'md';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary-700 text-white hover:bg-primary-800 border-transparent shadow-sm hover:shadow-vr-glow active:scale-[0.98] transition-all duration-150',
  secondary: 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300 shadow-sm active:scale-[0.98]',
  ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 border-transparent',
  danger: 'bg-white text-red-600 hover:bg-red-50 border-red-200 active:scale-[0.98]',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 border-transparent shadow-sm active:scale-[0.98]',
};
const SIZES: Record<Size, string> = {
  xs: 'h-7 px-2 text-xs gap-1',
  sm: 'h-8 px-2.5 text-[13px] gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'secondary', size = 'sm', icon: Icon, iconRight: IconRight, loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center rounded-md border font-medium transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1',
        'disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {Icon && <Icon className={clsx('shrink-0', size === 'xs' ? 'h-3.5 w-3.5' : 'h-4 w-4', loading && 'animate-spin')} aria-hidden />}
      {children}
      {IconRight && <IconRight className="h-4 w-4 shrink-0" aria-hidden />}
    </button>
  );
});

export function IconButton({
  icon: Icon,
  label,
  className,
  active,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string; active?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={clsx(
        'inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors',
        'hover:bg-gray-100 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
        active && 'bg-primary-50 text-primary-700',
        className,
      )}
      {...rest}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}
