import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface FilterBarProps {
  children: ReactNode;
  /** Pushed to the far end of the row — Filter/Clear buttons, or a date picker that
   *  belongs on the right. Optional, so existing single-argument callers are unaffected. */
  right?: ReactNode;
  /** Heading above the controls, e.g. "Filter". */
  title?: string;
  className?: string;
}

// Filters sit in one row above the data they filter, so the relationship is
// positional rather than something the reader has to infer.
export function FilterBar({ children, right, title, className }: FilterBarProps) {
  return (
    <div className={cn('rounded-lg border border-border bg-card p-3', className)}>
      {title && <h2 className="mb-3 text-sm font-semibold text-card-foreground">{title}</h2>}
      <div className="flex flex-wrap items-end gap-3">
        {children}
        {/* `ml-auto` on the wrapper rather than on a child, so the right group stays
            together when the row wraps on a narrow viewport. */}
        {right && <div className="ml-auto flex flex-wrap items-end gap-2">{right}</div>}
      </div>
    </div>
  );
}

export interface FilterFieldProps {
  label: string;
  children: ReactNode;
  className?: string;
}

export function FilterField({ label, children, className }: FilterFieldProps) {
  return (
    <label className={className ?? 'flex flex-col gap-1'}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
