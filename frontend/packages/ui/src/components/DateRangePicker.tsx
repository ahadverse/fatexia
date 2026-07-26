'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/cn';
import {
  PRESET_LABELS,
  PRESET_ORDER,
  formatRangeLabel,
  isoDate,
  matchPreset,
  parseIsoDate,
  presetRange,
  type DateRange,
  type DatePresetId,
  type FixedPresetId,
} from '../lib/date';

export interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  /** Rendered above the trigger. Set to '' to omit. */
  label?: string;
  className?: string;
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** The 42 cells of a month grid — six full weeks, so the popover never changes height
 *  as you page between months. */
function monthGrid(month: Date): Date[] {
  const first = startOfMonth(month);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return isoDate(a) === isoDate(b);
}

/**
 * A from–to range picker.
 *
 * One trigger reading "Jul 25, 2026 - Jul 26, 2026", opening a preset rail plus a
 * month grid. Built on Radix Popover for the focus trap, outside-click and Escape
 * handling; the calendar itself is hand-rolled because the only behaviour needed is
 * "pick two days", and a date library would ship a locale/parsing engine for it.
 */
export function DateRangeFilter({ value, onChange, label = 'Date range', className }: DateRangeFilterProps) {
  const [open, setOpen] = useState(false);
  // Half-finished selection: `from` set, waiting for `to`. Null when nothing is pending.
  const [pendingFrom, setPendingFrom] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [month, setMonth] = useState(() => startOfMonth(parseIsoDate(value.dateTo)));
  // The day arrow keys move around. Kept separate from the selection so navigating
  // never commits anything.
  const [focusedDay, setFocusedDay] = useState(() => parseIsoDate(value.dateTo));
  const gridRef = useRef<HTMLDivElement>(null);
  const shouldFocusRef = useRef(false);

  const today = isoDate(new Date());
  const activePreset = matchPreset(value);
  const days = useMemo(() => monthGrid(month), [month]);

  // Re-open on the month the current range ends in, and drop any half-finished
  // selection — a stray `from` left over from a dismissed popover would otherwise make
  // the next click commit a range the user never started.
  useEffect(() => {
    if (open) {
      setMonth(startOfMonth(parseIsoDate(value.dateTo)));
      setFocusedDay(parseIsoDate(value.dateTo));
      setPendingFrom(null);
      setHovered(null);
    }
  }, [open, value.dateTo]);

  // Only move focus in response to keyboard navigation, never on every render —
  // otherwise a mouse hover would steal focus back to the grid.
  useEffect(() => {
    if (!shouldFocusRef.current) return;
    shouldFocusRef.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>('[data-focused="true"]')?.focus();
  }, [focusedDay]);

  function commit(range: DateRange) {
    onChange(range);
    setPendingFrom(null);
    setHovered(null);
    setOpen(false);
  }

  function selectPreset(id: FixedPresetId) {
    commit(presetRange(id));
  }

  function selectDay(iso: string) {
    if (iso > today) return;
    if (!pendingFrom) {
      setPendingFrom(iso);
      setHovered(iso);
      return;
    }
    // Clicking backwards is a legitimate way to pick a range — swap rather than
    // rejecting it and making the user start over.
    commit(pendingFrom <= iso ? { dateFrom: pendingFrom, dateTo: iso } : { dateFrom: iso, dateTo: pendingFrom });
  }

  function moveFocus(deltaDays: number, event: KeyboardEvent) {
    event.preventDefault();
    const next = new Date(focusedDay);
    next.setDate(next.getDate() + deltaDays);
    shouldFocusRef.current = true;
    setFocusedDay(next);
    if (next.getMonth() !== month.getMonth() || next.getFullYear() !== month.getFullYear()) {
      setMonth(startOfMonth(next));
    }
  }

  function onGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    switch (event.key) {
      case 'ArrowLeft':
        return moveFocus(-1, event);
      case 'ArrowRight':
        return moveFocus(1, event);
      case 'ArrowUp':
        return moveFocus(-7, event);
      case 'ArrowDown':
        return moveFocus(7, event);
      case 'Home':
        return moveFocus(-focusedDay.getDay(), event);
      case 'End':
        return moveFocus(6 - focusedDay.getDay(), event);
      case 'PageUp': {
        event.preventDefault();
        const previous = new Date(focusedDay);
        previous.setMonth(previous.getMonth() - 1);
        shouldFocusRef.current = true;
        setFocusedDay(previous);
        setMonth(startOfMonth(previous));
        return;
      }
      case 'PageDown': {
        event.preventDefault();
        const next = new Date(focusedDay);
        next.setMonth(next.getMonth() + 1);
        shouldFocusRef.current = true;
        setFocusedDay(next);
        setMonth(startOfMonth(next));
        return;
      }
      default:
    }
  }

  // While a selection is half-finished the band follows the cursor, so the range being
  // chosen is visible before the second click lands.
  const previewFrom = pendingFrom && hovered ? (pendingFrom <= hovered ? pendingFrom : hovered) : value.dateFrom;
  const previewTo = pendingFrom && hovered ? (pendingFrom <= hovered ? hovered : pendingFrom) : value.dateTo;

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && <span className="text-xs font-medium text-muted-foreground">{label}</span>}
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label={`Date range: ${formatRangeLabel(value)}`}
            className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-foreground hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="whitespace-nowrap">{formatRangeLabel(value)}</span>
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={6}
            className="z-50 flex rounded-md border border-border bg-popover text-popover-foreground shadow-md"
          >
            <div className="flex w-36 shrink-0 flex-col gap-0.5 border-r border-border p-2">
              {PRESET_ORDER.map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={activePreset === id}
                  onClick={() => selectPreset(id)}
                  className={cn(
                    'rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
                    activePreset === id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  {PRESET_LABELS[id]}
                </button>
              ))}
              <span
                className={cn(
                  'mt-1 rounded-md px-2.5 py-1.5 text-left text-xs',
                  activePreset === 'custom' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground',
                )}
              >
                Custom
              </span>
            </div>

            <div className="p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <span aria-live="polite" className="text-sm font-medium">
                  {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                </span>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-0.5" role="presentation">
                {WEEKDAYS.map((day) => (
                  <span key={day} className="py-1 text-center text-[11px] font-medium text-muted-foreground">
                    {day}
                  </span>
                ))}
              </div>

              {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role */}
              <div
                ref={gridRef}
                role="grid"
                aria-label="Calendar"
                tabIndex={-1}
                onKeyDown={onGridKeyDown}
                onMouseLeave={() => pendingFrom && setHovered(pendingFrom)}
                className="grid grid-cols-7 gap-0.5"
              >
                {days.map((day) => {
                  const iso = isoDate(day);
                  const outside = day.getMonth() !== month.getMonth();
                  const disabled = iso > today;
                  const isStart = iso === previewFrom;
                  const isEnd = iso === previewTo;
                  const inRange = iso > previewFrom && iso < previewTo;
                  const isFocused = isSameDay(day, focusedDay);

                  return (
                    <button
                      key={iso}
                      type="button"
                      role="gridcell"
                      // Roving tabindex: exactly one day is tabbable, so Tab leaves the
                      // grid instead of walking 42 cells.
                      tabIndex={isFocused ? 0 : -1}
                      data-focused={isFocused}
                      aria-selected={isStart || isEnd || inRange}
                      aria-label={day.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
                      disabled={disabled}
                      onClick={() => selectDay(iso)}
                      onMouseEnter={() => pendingFrom && setHovered(iso)}
                      onFocus={() => setFocusedDay(day)}
                      className={cn(
                        'size-8 rounded-md text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        disabled && 'cursor-not-allowed opacity-30',
                        !disabled && !isStart && !isEnd && !inRange && 'hover:bg-accent hover:text-accent-foreground',
                        outside && !isStart && !isEnd && !inRange && 'text-muted-foreground',
                        inRange && 'bg-accent text-accent-foreground',
                        (isStart || isEnd) && 'bg-primary font-medium text-primary-foreground',
                      )}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>

              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                {pendingFrom ? 'Pick the end date' : 'Pick a start date, or choose a preset'}
              </p>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

export type { DateRange, DatePresetId, FixedPresetId };
