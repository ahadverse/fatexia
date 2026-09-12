import { cn } from '../lib/cn';

export interface RankedListItem {
  key: string;
  label: string;
  value: string;
  /** 0-1. Drives the bar width so the ranking is readable without reading numbers. */
  share: number;
}

export interface RankedListProps {
  title: string;
  items: RankedListItem[];
  emptyMessage?: string;
  className?: string;
}

// How many `--chart-N` slots theme.css defines. Rows past the eighth reuse the order
// from the start, which only happens on a list longer than the top-5 these render.
const SERIES_SLOTS = 8;

/**
 * Magnitude comparison within one list: more-is-longer carries the ranking, and the
 * row's own label carries its identity.
 *
 * Bars step through the categorical palette in its fixed order rather than sharing one
 * hue. The colour here is not an encoding — it does not mean "this offer" — so it is
 * assigned by position, and the adjacent-pair separation validated for that palette is
 * exactly the check that matters for bars stacked one above another. The text label
 * beside every bar is what distinguishes the rows, which is also what lets the three
 * lighter light-mode hues be used at all.
 */
export function RankedList({ title, items, emptyMessage = 'No data yet.', className }: RankedListProps) {
  return (
    <div className={cn('rounded-lg border border-border bg-card p-4', className)}>
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((item, index) => (
            <li key={item.key}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate text-card-foreground">{item.label}</span>
                <span className="shrink-0 text-muted-foreground [font-variant-numeric:tabular-nums]">{item.value}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(2, Math.min(100, item.share * 100))}%`,
                    backgroundColor: `var(--chart-${(index % SERIES_SLOTS) + 1})`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
