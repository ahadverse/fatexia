'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../lib/cn';

/**
 * Two-series time trend, drawn as inline SVG.
 *
 * No charting library: the only form the Admin portal needs is a line over time, and
 * a dependency would ship a whole layout engine plus its own colors to draw two
 * polylines. Series colors come from the validated --chart-1/--chart-2 theme tokens
 * (see theme.css) so light and dark are each correct rather than one being a flip of
 * the other.
 */

export interface TrendPoint {
  label: string;
  values: number[];
}

export interface TrendChartProps {
  points: TrendPoint[];
  seriesNames: string[];
  formatValue?: (value: number) => string;
  height?: number;
  className?: string;
  emptyMessage?: string;
}

const SERIES_VARS = ['var(--chart-1)', 'var(--chart-2)'];

// The left gutter holds the y-axis labels, so it scales with the room available: 52px
// out of a 311px phone card is a sixth of the plot spent on "$3.75". The narrow value
// still clears a 10px tick label and its 8px offset.
const NARROW = 420;
function paddingFor(width: number) {
  return { top: 16, right: 16, bottom: 26, left: width < NARROW ? 38 : 52 };
}

// Below this a plot stops being a chart and becomes a few pixels of ink between two
// axes, so it stops shrinking and the wrapper clips instead. A 320px phone still leaves
// the card ~256px of inner width, so in practice the clip never engages — the floor is
// here for a narrow rail or a split pane, not for a handset.
const MIN_PLOT_WIDTH = 220;

function niceCeiling(max: number): number {
  if (max <= 0) return 1;
  // Round the axis top to a clean 1/2/5 × 10^n so ticks read as round numbers
  // rather than as whatever the data's maximum happened to be.
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const normalized = max / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

function defaultFormat(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.round(value * 100) / 100);
}

export function TrendChart({
  points,
  seriesNames,
  formatValue = defaultFormat,
  height = 260,
  className,
  emptyMessage = 'No data for this period.',
}: TrendChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Null until measured, and nothing is plotted before then. A non-null seed was a
  // layout bug rather than a cosmetic one: an <svg width> is an intrinsic size, so on
  // first paint a 720px chart widened the auto-sized grid track it sits in, the
  // observer then measured that widened track and kept the chart at 720px on a 375px
  // screen — carrying the stat grid and the ranked lists, which share the track, off
  // the right edge with it.
  const [width, setWidth] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // The SVG is sized in real pixels rather than scaled with preserveAspectRatio,
  // which would stretch stroke widths and text along with the geometry.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      // The floor is a legibility limit, not a layout one — past it the wrapper clips
      // rather than the card growing, so it can sit well under a phone's width.
      if (entry) setWidth(Math.max(MIN_PLOT_WIDTH, entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const chart = useMemo(() => {
    const plotWidth = width ?? MIN_PLOT_WIDTH;
    const padding = paddingFor(plotWidth);
    const seriesCount = seriesNames.length;
    const max = niceCeiling(Math.max(0, ...points.flatMap((point) => point.values)));
    const innerWidth = plotWidth - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;

    const xFor = (index: number) =>
      padding.left + (points.length <= 1 ? innerWidth / 2 : (index / (points.length - 1)) * innerWidth);
    const yFor = (value: number) => padding.top + innerHeight - (value / max) * innerHeight;

    const paths = Array.from({ length: seriesCount }, (_, seriesIndex) =>
      points.map((point, index) => `${index === 0 ? 'M' : 'L'}${xFor(index)},${yFor(point.values[seriesIndex] ?? 0)}`).join(' '),
    );

    const ticks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => ({
      value: max * fraction,
      y: padding.top + innerHeight - fraction * innerHeight,
    }));

    // Roughly six x labels regardless of range, so a 60-day window doesn't render
    // sixty overlapping dates — and four rather than six on a phone, where six "09-12"
    // labels want ~180px of an axis that is only ~250px long and render touching.
    const labelSlots = plotWidth < NARROW ? 4 : 6;
    const labelStride = Math.max(1, Math.ceil(points.length / labelSlots));

    return { max, plotWidth, padding, innerWidth, innerHeight, xFor, yFor, paths, ticks, labelStride };
  }, [points, seriesNames.length, width, height]);

  if (points.length === 0) {
    return (
      <div className={cn('flex items-center justify-center rounded-lg border border-border bg-card', className)} style={{ height }}>
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  const hovered = hoverIndex === null ? null : points[hoverIndex];

  function handleMove(event: React.MouseEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const ratio = (x - chart.padding.left) / Math.max(1, chart.innerWidth);
    const index = Math.round(ratio * (points.length - 1));
    setHoverIndex(Math.min(points.length - 1, Math.max(0, index)));
  }

  return (
    <div ref={containerRef} className={cn('relative rounded-lg border border-border bg-card p-4', className)}>
      {/* Legend is always present for two or more series — identity must never rest
          on color alone. */}
      <div className="mb-2 flex flex-wrap items-center gap-4">
        {seriesNames.map((name, index) => (
          <span key={name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: SERIES_VARS[index] }} aria-hidden />
            {name}
          </span>
        ))}
      </div>

      {/* The clip is load-bearing rather than cosmetic: it zeroes the SVG's
          contribution to this card's min-content width, so the measurement above can
          only ever follow the card and never push it. Without it the two size each
          other upward and the card walks off the viewport. The height is reserved
          while unmeasured so the first paint doesn't jump. */}
      <div className="overflow-hidden" style={{ height }}>
        {width !== null && (
          <svg
            width={chart.plotWidth}
            height={height}
            // block, or the inline baseline gap pushes the svg a few pixels down inside
            // the fixed-height clip above and shaves the descenders off the x labels.
            className="block"
            role="img"
            aria-label={`${seriesNames.join(' and ')} over time`}
            onMouseMove={handleMove}
            onMouseLeave={() => setHoverIndex(null)}
          >
            {chart.ticks.map((tick) => (
              <g key={tick.y}>
                <line
                  x1={chart.padding.left}
                  x2={chart.plotWidth - chart.padding.right}
                  y1={tick.y}
                  y2={tick.y}
                  stroke="hsl(var(--border))"
                  strokeWidth={1}
                />
                <text
                  x={chart.padding.left - 8}
                  y={tick.y + 3}
                  textAnchor="end"
                  className="fill-muted-foreground text-[10px] [font-variant-numeric:tabular-nums]"
                >
                  {formatValue(tick.value)}
                </text>
              </g>
            ))}

            {points.map((point, index) =>
              index % chart.labelStride === 0 ? (
                <text
                  key={point.label}
                  x={chart.xFor(index)}
                  y={height - 8}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px] [font-variant-numeric:tabular-nums]"
                >
                  {point.label.slice(5)}
                </text>
              ) : null,
            )}

            {hoverIndex !== null && (
              <line
                x1={chart.xFor(hoverIndex)}
                x2={chart.xFor(hoverIndex)}
                y1={chart.padding.top}
                y2={chart.padding.top + chart.innerHeight}
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={1}
              />
            )}

            {chart.paths.map((path, index) => (
              <path
                key={seriesNames[index]}
                d={path}
                fill="none"
                stroke={SERIES_VARS[index]}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}

            {/* Surface ring keeps the hovered markers legible where the two lines cross. */}
            {hoverIndex !== null &&
              seriesNames.map((name, seriesIndex) => (
                <circle
                  key={name}
                  cx={chart.xFor(hoverIndex)}
                  cy={chart.yFor(points[hoverIndex]!.values[seriesIndex] ?? 0)}
                  r={4}
                  fill={SERIES_VARS[seriesIndex]}
                  stroke="hsl(var(--card))"
                  strokeWidth={2}
                />
              ))}
          </svg>
        )}
      </div>

      {hovered && (
        <div
          // The max-width keeps the tooltip inside the card on a phone, where its own
          // text is wider than the plot it annotates.
          className="pointer-events-none absolute top-4 max-w-[calc(100%-2rem)] rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md"
          style={{
            // Flip the tooltip to the left of the crosshair past the midpoint so it
            // never runs off the right edge of the card.
            left: chart.xFor(hoverIndex!) > chart.plotWidth / 2 ? undefined : chart.xFor(hoverIndex!) + 12,
            right:
              chart.xFor(hoverIndex!) > chart.plotWidth / 2 ? chart.plotWidth - chart.xFor(hoverIndex!) + 12 : undefined,
          }}
        >
          <p className="font-medium text-popover-foreground">{hovered.label}</p>
          {seriesNames.map((name, index) => (
            <p key={name} className="mt-1 flex items-center gap-1.5 text-muted-foreground">
              <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: SERIES_VARS[index] }} aria-hidden />
              {name}: <span className="text-popover-foreground">{formatValue(hovered.values[index] ?? 0)}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
