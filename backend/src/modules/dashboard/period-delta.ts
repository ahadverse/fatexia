import type { ReportFiltersDto } from '../reports/report.dto';

/**
 * Percentage change against the immediately preceding window of the same length.
 *
 * `null` rather than a number whenever there is no honest baseline — a previous value
 * of zero has no percentage change, and rendering "+100%" (or worse, "+∞") for a
 * metric that went from 0 to 3 overstates a move that is really just "started from
 * nothing". The UI shows no arrow at all in that case.
 */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

/**
 * The window immediately before the one being viewed, truncated to the same *elapsed*
 * portion.
 *
 * Two things are going on here.
 *
 * Equal nominal length: comparing a 30-day window against a 7-day one would make every
 * metric look collapsed, so the baseline is shifted back by the full span.
 *
 * Equal elapsed time: the UI sends `dateTo` as 23:59:59 of the last selected day, so
 * for the default "Today" filter the window's end is in the future. Comparing a
 * part-finished day against a complete one would show a large fake decline every
 * morning that quietly "recovered" by midnight — the metric would be measuring the
 * time of day, not the traffic. So when the window has not finished, the baseline is
 * cut to the same number of elapsed milliseconds: at 10:00 today, the comparison is
 * against 00:00–10:00 yesterday.
 */
export function previousWindow(filters: ReportFiltersDto): ReportFiltersDto | null {
  if (!filters.dateFrom) return null;

  const now = Date.now();
  const from = new Date(filters.dateFrom).getTime();
  const to = filters.dateTo ? new Date(filters.dateTo).getTime() : now;
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;

  const span = to - from;
  const elapsed = Math.min(now, to) - from;
  if (span <= 0 || elapsed <= 0) return null;

  const previousFrom = from - span;
  return {
    ...filters,
    dateFrom: new Date(previousFrom).toISOString(),
    dateTo: new Date(previousFrom + elapsed).toISOString(),
  };
}
