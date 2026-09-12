import { Check, X } from 'lucide-react';
import { cn } from '../lib/cn';

export interface TrafficSourceListProps {
  allowed: string[];
  disallowed: string[];
  /** Shown when the offer states nothing either way. */
  emptyMessage?: string;
  className?: string;
}

/**
 * What an affiliate may and may not send, as chips.
 *
 * Colour is never the only signal: each chip carries a tick or a cross and the word
 * itself, so the distinction survives colourblindness, a greyscale print, and the
 * forced-colours mode some operators run.
 *
 * Sources in neither list are simply absent — "not stated" is a real third answer here,
 * and rendering it as either permission would be inventing a rule the advertiser did
 * not give.
 */
export function TrafficSourceList({
  allowed,
  disallowed,
  emptyMessage = 'No traffic restrictions stated.',
  className,
}: TrafficSourceListProps) {
  if (allowed.length === 0 && disallowed.length === 0) {
    return <p className={cn('text-sm text-muted-foreground', className)}>{emptyMessage}</p>;
  }

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {allowed.map((source) => (
        <span
          key={`allowed-${source}`}
          className="flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-500"
        >
          <Check className="size-3.5 shrink-0" aria-hidden />
          {source}
        </span>
      ))}
      {disallowed.map((source) => (
        <span
          key={`disallowed-${source}`}
          className="flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-500"
        >
          <X className="size-3.5 shrink-0" aria-hidden />
          <span className="sr-only">Not allowed: </span>
          {source}
        </span>
      ))}
    </div>
  );
}
