import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '../lib/cn';

/**
 * Accent colours for the tile's icon chip and top edge.
 *
 * Named by role rather than colour ("money", "traffic") so a palette change is one
 * edit here instead of a hunt through every dashboard.
 */
export type StatTone = 'default' | 'traffic' | 'money' | 'profit' | 'warning' | 'danger' | 'info';

const TONE: Record<StatTone, { chip: string; bar: string }> = {
  default: { chip: 'bg-muted text-muted-foreground', bar: 'bg-border' },
  traffic: { chip: 'bg-sky-500/15 text-sky-400', bar: 'bg-sky-500' },
  money: { chip: 'bg-emerald-500/15 text-emerald-400', bar: 'bg-emerald-500' },
  profit: { chip: 'bg-violet-500/15 text-violet-400', bar: 'bg-violet-500' },
  warning: { chip: 'bg-amber-500/15 text-amber-400', bar: 'bg-amber-500' },
  danger: { chip: 'bg-rose-500/15 text-rose-400', bar: 'bg-rose-500' },
  info: { chip: 'bg-indigo-500/15 text-indigo-400', bar: 'bg-indigo-500' },
};

export interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  tone?: StatTone;
  /**
   * Percent change vs the previous period of equal length. `null`/`undefined` renders
   * no indicator at all — that is the honest reading when there is no baseline to
   * compare against, and it is why this is not defaulted to 0.
   */
  delta?: number | null;
  /**
   * Whether a rise is good. False for metrics where up is bad (blocked clicks,
   * payout-as-cost), so the colour reflects meaning rather than direction.
   */
  higherIsBetter?: boolean;
  /** Describes what the delta is measured against, e.g. "vs previous 30 days". */
  deltaLabel?: string;
  className?: string;
}

function DeltaBadge({ delta, higherIsBetter, label }: { delta: number; higherIsBetter: boolean; label?: string }) {
  const flat = Math.abs(delta) < 0.05;
  const good = higherIsBetter ? delta > 0 : delta < 0;

  const Icon = flat ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;
  const colour = flat ? 'text-muted-foreground' : good ? 'text-emerald-400' : 'text-rose-400';

  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-semibold', colour)} title={label}>
      <Icon className="size-3.5" aria-hidden />
      {/* Sign is carried by the arrow, so the number itself stays unsigned. */}
      {flat ? '0%' : `${Math.abs(delta).toFixed(1)}%`}
    </span>
  );
}

export function StatCard({
  label,
  value,
  icon,
  tone = 'default',
  delta,
  higherIsBetter = true,
  deltaLabel,
  className,
}: StatCardProps) {
  const palette = TONE[tone];

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border border-border bg-card p-4 transition-colors hover:border-border/80',
        className,
      )}
    >
      {/* Thin top edge — carries the tone without tinting the whole surface, which
          would fight the text contrast in both themes. */}
      <span className={cn('absolute inset-x-0 top-0 h-0.5', palette.bar)} aria-hidden />

      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        {icon && (
          <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-md', palette.chip)}>{icon}</span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className="text-2xl font-semibold text-card-foreground">{value}</p>
        {delta !== null && delta !== undefined && (
          <DeltaBadge delta={delta} higherIsBetter={higherIsBetter} label={deltaLabel} />
        )}
      </div>
    </div>
  );
}
