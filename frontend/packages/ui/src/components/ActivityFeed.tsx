import { CircleDollarSign, MousePointerClick, Target } from 'lucide-react';
import { cn } from '../lib/cn';

export type ActivityFeedKind = 'click' | 'conversion' | 'payout';

export interface ActivityFeedItem {
  id: string;
  kind: ActivityFeedKind;
  /** Headline line, e.g. the offer name or "$42.50 - AFF-1005". */
  title: string;
  /** Secondary line under the title. Omitted when there is nothing useful to add. */
  subtitle?: string;
  countryCode?: string | null;
  /** ISO timestamp. Rendered as an age ("4m ago") so the feed reads as live. */
  at: string;
}

export interface ActivityFeedProps {
  items: ActivityFeedItem[];
  /** Rendered top-right — typically a link to the full click/conversion report. */
  action?: { label: string; onClick: () => void };
  emptyMessage?: string;
  className?: string;
}

const KIND: Record<ActivityFeedKind, { chip: string; icon: typeof Target; label: string }> = {
  click: { chip: 'bg-sky-500/15 text-sky-500', icon: MousePointerClick, label: 'Click' },
  conversion: { chip: 'bg-emerald-500/15 text-emerald-500', icon: Target, label: 'Conversion' },
  payout: { chip: 'bg-amber-500/15 text-amber-500', icon: CircleDollarSign, label: 'Payout' },
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Coarse, absolute-value age. Deliberately not a live-ticking clock: the feed refetches
 * on its own schedule, so a second-by-second timer would animate staleness rather than
 * freshness. Clamped at 0 because a server clock marginally ahead of the browser's
 * would otherwise render "in 2s".
 */
function age(iso: string): string {
  const elapsed = Math.max(0, Date.now() - new Date(iso).getTime());
  if (elapsed < MINUTE) return 'just now';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h ago`;
  return `${Math.floor(elapsed / DAY)}d ago`;
}

// Regional-indicator maths: 'US' -> 🇺🇸. Renders as plain letters on platforms with no
// flag font (Windows), which is a readable fallback rather than a broken glyph.
function flag(countryCode: string): string {
  if (!/^[A-Za-z]{2}$/.test(countryCode)) return '';
  return String.fromCodePoint(
    ...countryCode
      .toUpperCase()
      .split('')
      .map((char) => 0x1f1e6 + char.charCodeAt(0) - 65),
  );
}

export function ActivityFeed({ items, action, emptyMessage = 'Nothing yet.', className }: ActivityFeedProps) {
  return (
    <div className={cn('flex flex-col rounded-lg border border-border bg-card', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-medium text-card-foreground">
          <span className="size-2 rounded-full bg-emerald-500" aria-hidden />
          Live Activity
        </h3>
        {action && (
          <button type="button" onClick={action.onClick} className="text-xs text-muted-foreground hover:text-foreground">
            {action.label}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        // Capped height with its own scroll: the feed is the tallest thing in the rail
        // and would otherwise stretch the page far past the content beside it.
        <ul className="max-h-[28rem] divide-y divide-border overflow-y-auto">
          {items.map((item) => {
            const kind = KIND[item.kind];
            const Icon = kind.icon;
            return (
              <li key={`${item.kind}-${item.id}`} className="flex items-start gap-3 px-4 py-3">
                <span className={cn('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full', kind.chip)}>
                  <Icon className="size-3.5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-medium text-card-foreground">{kind.label}</p>
                    <span className="shrink-0 text-xs text-muted-foreground">{age(item.at)}</span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{item.title}</p>
                  {(item.subtitle || item.countryCode) && (
                    <p className="truncate text-xs text-muted-foreground">
                      {item.countryCode && <span className="mr-1">{flag(item.countryCode)} {item.countryCode}</span>}
                      {item.subtitle}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
