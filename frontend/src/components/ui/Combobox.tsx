import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import clsx from 'clsx';
import { Check, ChevronDown, Search, X, type LucideIcon } from 'lucide-react';
import { inputCls } from './Field';

export interface ComboOption {
  value: number;
  label: string;
  sublabel?: string;
  group?: string;
  disabled?: boolean;
}

interface Props {
  options: ComboOption[];
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  icon?: LucideIcon;
  allowClear?: boolean;
  compact?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

/** Dropdown con buscador (operadores, equipos, tareas...). Navegable con teclado. */
export function Combobox({ options, value, onChange, placeholder = 'Seleccionar…', icon: Icon, allowClear, compact, disabled, ariaLabel, className }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const listId = useId();
  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return options;
    return options.filter((o) => `${o.label} ${o.sublabel ?? ''} ${o.group ?? ''}`.toLowerCase().includes(term));
  }, [options, q]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    setTimeout(() => search.current?.focus(), 0);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => setActive(0), [q, open]);

  const choose = (o: ComboOption) => {
    if (o.disabled) return;
    onChange(o.value);
    setOpen(false);
    setQ('');
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[active]) choose(filtered[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  let lastGroup: string | undefined;

  return (
    <div ref={root} className={clsx('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className={clsx(inputCls, 'flex items-center gap-2 pr-2 text-left', compact && 'h-8 text-[13px]', Icon && 'pl-2.5')}
      >
        {Icon && <Icon className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />}
        <span className={clsx('min-w-0 flex-1 truncate', !selected && 'text-gray-500')}>
          {selected ? (
            <>
              {selected.label}
              {selected.sublabel && !compact && <span className="ml-1.5 text-xs text-gray-400">{selected.sublabel}</span>}
            </>
          ) : (
            placeholder
          )}
        </span>
        {allowClear && selected && !disabled ? (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Quitar selección"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
        )}
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-1 w-full min-w-[240px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl">
          <div className="flex items-center gap-2 border-b border-gray-100 px-2.5">
            <Search className="h-4 w-4 text-gray-400" aria-hidden />
            <input
              ref={search}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKey}
              placeholder="Buscar…"
              aria-controls={listId}
              className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
            />
          </div>
          <ul id={listId} role="listbox" className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 && <li className="px-3 py-2 text-sm text-gray-500">Sin resultados</li>}
            {filtered.map((o, i) => {
              const header = o.group && o.group !== lastGroup ? o.group : null;
              lastGroup = o.group;
              return (
                <li key={o.value} role="presentation">
                  {header && <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{header}</div>}
                  <div
                    role="option"
                    aria-selected={o.value === value}
                    aria-disabled={o.disabled}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(o)}
                    className={clsx(
                      'mx-1 flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm',
                      i === active && 'bg-primary-50',
                      o.disabled && 'cursor-not-allowed opacity-40',
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-gray-900">{o.label}</span>
                      {o.sublabel && <span className="block truncate text-[11px] text-gray-500">{o.sublabel}</span>}
                    </span>
                    {o.value === value && <Check className="h-4 w-4 text-primary-700" aria-hidden />}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
