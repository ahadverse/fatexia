// Display formatting shared by every table, tile and chart, so the same number
// never renders two different ways on two different screens.

export function money(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
}

export function compactMoney(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 10_000) return `$${(value / 1_000).toFixed(1)}K`;
  return money(value);
}

export function number(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export function percent(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function date(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

export function dateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

// Click-to-conversion time. Sub-second values are the CTIT fraud signal, so the
// short end keeps its precision instead of rounding to "0s".
export function duration(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = seconds / 60;
  if (minutes < 60) return `${minutes.toFixed(0)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

// ISO date (YYYY-MM-DD) for <input type="date"> and the API's date filters.
// Built from local date parts, not toISOString(): east of UTC, toISOString() rolls
// back a day for most of the working morning, so a "Today" preset would quietly
// select yesterday.
export function isoDate(value: Date): string {
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${value.getFullYear()}-${month}-${day}`;
}

export function daysAgoIso(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return isoDate(date);
}
