import { useId, type ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '../lib/cn';

/**
 * Accent colours for the tile's icon chip and top edge.
 *
 * Named by role rather than colour ("money", "traffic") so a palette change is one
 * edit here instead of a hunt through every dashboard.
 */
export type StatTone =
  | 'default'
  | 'traffic'
  | 'money'
  | 'profit'
  | 'warning'
  | 'danger'
  | 'info'
  | 'teal'
  | 'pink'
  | 'orange';

const TONE: Record<StatTone, { chip: string; bar: string; line: string }> = {
  default: { chip: 'bg-muted text-muted-foreground', bar: 'bg-border', line: 'text-muted-foreground' },
  traffic: { chip: 'bg-sky-500/15 text-sky-400', bar: 'bg-sky-500', line: 'text-sky-500' },
  money: { chip: 'bg-emerald-500/15 text-emerald-400', bar: 'bg-emerald-500', line: 'text-emerald-500' },
  profit: { chip: 'bg-violet-500/15 text-violet-400', bar: 'bg-violet-500', line: 'text-violet-500' },
  warning: { chip: 'bg-amber-500/15 text-amber-400', bar: 'bg-amber-500', line: 'text-amber-500' },
  danger: { chip: 'bg-rose-500/15 text-rose-400', bar: 'bg-rose-500', line: 'text-rose-500' },
  info: { chip: 'bg-indigo-500/15 text-indigo-400', bar: 'bg-indigo-500', line: 'text-indigo-500' },
  // The last three are named by hue rather than by role: they exist so a row of tiles
  // can be told apart at a glance, not because "teal" means anything. Roles above keep
  // their meaning — `danger` in particular stays reserved for the fraud counters.
  teal: { chip: 'bg-teal-500/15 text-teal-400', bar: 'bg-teal-500', line: 'text-teal-500' },
  pink: { chip: 'bg-pink-500/15 text-pink-400', bar: 'bg-pink-500', line: 'text-pink-500' },
  orange: { chip: 'bg-orange-500/15 text-orange-400', bar: 'bg-orange-500', line: 'text-orange-500' },
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
  /**
   * Per-day values for this metric across the selected window, oldest first. Renders a
   * sparkline showing the shape of the period the single headline figure flattens.
   * Fewer than two points draws nothing — a line needs two ends.
   */
  sparkline?: number[];
  className?: string;
}

const SPARK_WIDTH = 96;
const SPARK_HEIGHT = 32;

// preserveAspectRatio="none" lets the viewBox stretch to whatever width the card gives
// it, so the line always spans the full window rather than ending early on a wide card.
// The stroke is exempted from that stretch (vectorEffect) or it would render thicker
// horizontally than vertically.
function Sparkline({ points, className }: { points: number[]; className?: string }) {
  // Scoped per instance: several sparklines share a page and a fixed gradient id would
  // make every one of them paint with the first card's colour.
  const gradientId = useId();

  if (points.length < 2) return null;

  const max = Math.max(...points);
  const min = Math.min(...points);
  // A flat series has zero span; dividing by it would put every point at NaN, so it
  // collapses to a centred straight line instead.
  const span = max - min || 1;
  const step = SPARK_WIDTH / (points.length - 1);

  const coords = points.map<[number, number]>((point, index) => [
    index * step,
    SPARK_HEIGHT - ((point - min) / span) * SPARK_HEIGHT,
  ]);
  const line = coords.map(([x, y]) => `${x},${y}`).join(' ');
  // Same path closed along the baseline, so the fill sits under the line rather than
  // between its own endpoints.
  const area = `0,${SPARK_HEIGHT} ${line} ${SPARK_WIDTH},${SPARK_HEIGHT}`;

  return (
    <svg
      viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
      preserveAspectRatio="none"
      // Fills whatever the delta block leaves rather than a fixed width: the card is
      // two-up on a laptop and four-up on a wide monitor, and a fixed chart leaves a
      // dead gap at one size or crowds the text at the other. `min-w-0` lets it shrink
      // below its intrinsic size instead of forcing the row wider than the card.
      className={cn('h-10 w-full min-w-0 flex-1', className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.28} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gradientId})`} />
      <polyline
        points={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
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
  sparkline,
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

      <div className="flex items-center gap-2">
        {icon && (
          <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-md', palette.chip)}>{icon}</span>
        )}
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>

      {/* The value gets the full card width on its own row. Sharing a row with the
          sparkline left it ~50px on a four-up grid, which truncated every figure to
          "$…" — and a headline number that can't be read is the one thing this
          component exists to show. */}
      <p className="mt-2 whitespace-nowrap text-2xl font-semibold text-card-foreground">{value}</p>

      {(delta !== null && delta !== undefined) || sparkline ? (
        <div className="mt-1 flex items-end gap-3">
          <div className="shrink-0">
            {delta !== null && delta !== undefined && (
              <DeltaBadge delta={delta} higherIsBetter={higherIsBetter} label={deltaLabel} />
            )}
            {/* nowrap so it stays one line — wrapped, it read as "vs. / previous /
                period" stacked three deep. */}
            {delta !== null && delta !== undefined && deltaLabel && (
              <p className="whitespace-nowrap text-xs text-muted-foreground">{deltaLabel}</p>
            )}
          </div>
          {sparkline && <Sparkline points={sparkline} className={palette.line} />}
        </div>
      ) : null}
    </div>
  );
}
