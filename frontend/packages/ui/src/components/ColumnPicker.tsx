'use client';

import { cn } from '../lib/cn';

export interface ColumnOption {
  key: string;
  label: string;
}

export interface ColumnPickerProps {
  options: ColumnOption[];
  /** Keys currently visible. */
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
  className?: string;
}

/**
 * Which columns the table shows.
 *
 * A wrapped row of checkboxes rather than a dropdown: with ~20 options the whole set
 * needs to be visible at once to be usable, and hiding it behind a menu turns "show me
 * sub-ID 4" into three interactions.
 */
export function ColumnPicker({ options, value, onChange, label = 'Columns', className }: ColumnPickerProps) {
  const selected = new Set(value);

  function toggle(key: string) {
    // Order follows `options`, not click order, so the table's column order is stable
    // however the reader arrives at a selection.
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(options.filter((option) => next.has(option.key)).map((option) => option.key));
  }

  return (
    <div className={cn('rounded-lg border border-border bg-card p-3', className)}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => onChange(options.map((option) => option.key))}
            className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Select all
          </button>
          <span aria-hidden className="text-border">
            |
          </span>
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Deselect all
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = selected.has(option.key);
          return (
            <label
              key={option.key}
              className={cn(
                'flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors',
                active
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border text-muted-foreground hover:border-muted-foreground',
              )}
            >
              <input
                type="checkbox"
                checked={active}
                onChange={() => toggle(option.key)}
                className="size-3.5 accent-[hsl(var(--primary))]"
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}
