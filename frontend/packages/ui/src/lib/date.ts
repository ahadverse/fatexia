/**
 * Date-range vocabulary shared by every filter in both portals.
 *
 * Lives in the shared package rather than being copied per app: the two copies this
 * replaces were byte-identical, and a preset that means one span in Admin and another
 * in the Affiliate portal is a reporting bug nobody would think to look for.
 */

export interface DateRange {
  dateFrom: string;
  dateTo: string;
}

export type DatePresetId = 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' | 'lastMonth' | 'custom';
export type FixedPresetId = Exclude<DatePresetId, 'custom'>;

/**
 * ISO date (YYYY-MM-DD) from **local** date parts.
 *
 * Not `toISOString()`: east of UTC that rolls back a day for most of the working
 * morning, so a "Today" preset would quietly select yesterday.
 */
export function isoDate(value: Date): string {
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${value.getFullYear()}-${month}-${day}`;
}

export function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  // Constructed from parts rather than `new Date(string)`, which parses a bare
  // YYYY-MM-DD as UTC midnight and lands on the previous day in negative offsets.
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

export function shiftDays(days: number, from: Date = new Date()): Date {
  const value = new Date(from);
  value.setDate(value.getDate() + days);
  return value;
}

function sameDay(day: Date): DateRange {
  const iso = isoDate(day);
  return { dateFrom: iso, dateTo: iso };
}

// Both endpoints are inclusive, so "last 7 days" spans 7 calendar days counting today —
// `today - 7` would silently be 8 and make the label lie about the window.
function trailing(days: number): DateRange {
  return { dateFrom: isoDate(shiftDays(-(days - 1))), dateTo: isoDate(new Date()) };
}

// Keyed by id rather than an array, so the lookup is total: every id in the type has a
// range and there is no unreachable fallback to keep honest.
export const PRESET_RANGES: Record<FixedPresetId, () => DateRange> = {
  today: () => sameDay(new Date()),
  yesterday: () => sameDay(shiftDays(-1)),
  last7: () => trailing(7),
  last30: () => trailing(30),
  thisMonth: () => {
    const now = new Date();
    return { dateFrom: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), dateTo: isoDate(now) };
  },
  // Previous *calendar* month. Day 0 of the current month is the last day of the
  // previous one, which also gets 28/29/30/31 right for free.
  lastMonth: () => {
    const now = new Date();
    return {
      dateFrom: isoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      dateTo: isoDate(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
  },
};

export const PRESET_LABELS: Record<FixedPresetId, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  last7: 'Last 7 days',
  last30: 'Last 30 days',
  thisMonth: 'This month',
  lastMonth: 'Last month',
};

export const PRESET_ORDER: FixedPresetId[] = ['today', 'yesterday', 'last7', 'last30', 'thisMonth', 'lastMonth'];

export function presetRange(id: FixedPresetId): DateRange {
  return PRESET_RANGES[id]();
}

/** Every filter in both portals opens on today. */
export function defaultRange(): DateRange {
  return presetRange('today');
}

/** Which preset a range corresponds to, or 'custom' when it matches none. */
export function matchPreset(value: DateRange): DatePresetId {
  return PRESET_ORDER.find((id) => {
    const range = PRESET_RANGES[id]();
    return range.dateFrom === value.dateFrom && range.dateTo === value.dateTo;
  }) ?? 'custom';
}

// The API treats dateTo as an upper bound on a timestamp, so a bare YYYY-MM-DD would
// cut the selected end day off at midnight and silently drop that day's rows.
//
// range.dateFrom/dateTo are LOCAL calendar dates (see isoDate above). Appending a
// literal "Z" here would reinterpret "midnight in the browser's timezone" as "midnight
// UTC" — for anyone east of UTC that shifts the queried window later than the local
// day actually starts, silently excluding early-morning local rows (and, symmetrically,
// pulling in rows from just after local midnight the next day). Going through
// parseIsoDate + toISOString converts the real local-day boundaries to their correct
// UTC instants instead.
export function toApiRange(range: DateRange): { dateFrom: string; dateTo: string } {
  const from = parseIsoDate(range.dateFrom);
  const to = parseIsoDate(range.dateTo);
  to.setHours(23, 59, 59, 999);
  return { dateFrom: from.toISOString(), dateTo: to.toISOString() };
}

const DISPLAY: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

/** The trigger label, e.g. "Jul 25, 2026 - Jul 26, 2026". */
export function formatRangeLabel(range: DateRange): string {
  const from = parseIsoDate(range.dateFrom).toLocaleDateString(undefined, DISPLAY);
  const to = parseIsoDate(range.dateTo).toLocaleDateString(undefined, DISPLAY);
  return from === to ? from : `${from} - ${to}`;
}
