import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import clsx from 'clsx';
import { ChevronDown, type LucideIcon } from 'lucide-react';

/** Etiqueta en color de marca (VR-Analytics) y negrita */
export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={clsx('block', className)}>
      <span className="mb-1 block text-xs font-semibold text-primary-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-gray-500">{hint}</span>}
    </label>
  );
}

export const inputCls =
  'h-9 w-full rounded-md border border-gray-300 bg-white px-2.5 text-sm text-gray-900 placeholder:text-gray-400 ' +
  'focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:bg-gray-50 disabled:text-gray-500';

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx(inputCls, className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx(inputCls, 'h-auto py-2 leading-snug', className)} {...rest} />;
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  icon?: LucideIcon;
  compact?: boolean;
}

export function Select({ icon: Icon, compact, className, children, ...rest }: SelectProps) {
  return (
    <div className={clsx('relative', className)}>
      {Icon && <Icon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />}
      <select
        className={clsx(
          inputCls,
          'appearance-none pr-8 cursor-pointer',
          Icon && 'pl-8',
          compact && 'h-8 text-[13px]',
          rest.value === '' || rest.value == null ? 'text-gray-500' : '',
        )}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string; title?: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex h-8 rounded-md border border-gray-300 bg-gray-50 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={clsx(
            'rounded px-2.5 text-[13px] font-medium transition-colors',
            value === o.value ? 'bg-white text-primary-700 shadow-sm ring-1 ring-gray-200' : 'text-gray-600 hover:text-gray-900',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
