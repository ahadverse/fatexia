import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '../lib/cn';

export interface QuickStatItem {
  key: string;
  label: string;
  value: string;
  icon?: ReactNode;
  /** Renders the row as a button with a chevron. Omit for a read-only row. */
  onClick?: () => void;
}

export interface QuickStatsProps {
  title?: string;
  items: QuickStatItem[];
  className?: string;
}

/**
 * Current-state counts, not windowed measurements — which is why no row here carries a
 * period delta. Sits beside the dashboard's date-filtered tiles, so the distinction
 * matters: changing the date range does not change these numbers.
 */
export function QuickStats({ title = 'Quick Stats', items, className }: QuickStatsProps) {
  return (
    <div className={cn('rounded-lg border border-border bg-card', className)}>
      <h3 className="border-b border-border px-4 py-3 text-sm font-medium text-card-foreground">{title}</h3>
      <ul className="divide-y divide-border">
        {items.map((item) => {
          const content = (
            <>
              {item.icon && (
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  {item.icon}
                </span>
              )}
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-xs text-muted-foreground">{item.label}</p>
                <p className="truncate text-base font-semibold text-card-foreground">{item.value}</p>
              </div>
              {item.onClick && <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
            </>
          );

          return (
            <li key={item.key}>
              {item.onClick ? (
                <button
                  type="button"
                  onClick={item.onClick}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {content}
                </button>
              ) : (
                <div className="flex items-center gap-3 px-4 py-3">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
