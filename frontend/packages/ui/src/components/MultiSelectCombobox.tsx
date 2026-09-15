'use client';

import { useMemo, useState, type ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '../lib/cn';

export interface MultiSelectOption {
  value: string;
  label: string;
  /** Shown smaller/muted next to the label — e.g. an email next to a name. */
  sublabel?: string;
  /**
   * Extra text to match on that is not displayed, or displayed elsewhere — a public id
   * like "AFF-1011", say. Searching is punctuation-insensitive (see `normalize`), so
   * typing just the number finds it.
   */
  keywords?: string;
  /** Rendered before the label in both the list and the selected chip. */
  icon?: React.ReactNode;
}

/**
 * Strips everything but letters and digits so a query matches regardless of the
 * punctuation and casing the value happens to use.
 *
 * The case this exists for: affiliate ids are displayed as "AFF-1011" but people search
 * by the number alone. Normalised, the haystack is "aff1011" and the query "1011" is a
 * plain substring of it — as are "aff-1011", "AFF1011" and "aff 1011".
 */
function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Both comboboxes below search the same way — label, sublabel, keywords and the raw
// value, all normalised. Shared as one function rather than duplicated so "AFF-1011"
// can never be findable in one picker and not the other.
function matches<T extends { label: string; sublabel?: string; keywords?: string; value: string }>(
  option: T,
  normalizedQuery: string,
): boolean {
  return normalize(`${option.label} ${option.sublabel ?? ''} ${option.keywords ?? ''} ${option.value}`).includes(
    normalizedQuery,
  );
}

export interface MultiSelectComboboxProps {
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  emptyLabel?: string;
  className?: string;
}

/**
 * Searchable multi-select over a potentially long option list (e.g. every affiliate
 * on the network) — a plain scrollable checkbox list doesn't scale past a couple dozen
 * entries, and this is the shape issue #13 asked for: search by id/email, not scroll
 * and hunt. Built on Radix Popover for focus-trap/outside-click, same as
 * DateRangePicker; the list/search itself is hand-rolled since a real combobox library
 * would pull in far more than this needs.
 */
export function MultiSelectCombobox({ options, value, onChange, placeholder = 'Search…', emptyLabel = 'None selected', className }: MultiSelectComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = new Set(value);
  const selectedOptions = useMemo(() => options.filter((o) => selected.has(o.value)), [options, value]);

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return options;
    return options.filter((option) => matches(option, q));
  }, [options, query]);

  function toggle(optionValue: string) {
    onChange(selected.has(optionValue) ? value.filter((v) => v !== optionValue) : [...value, optionValue]);
  }

  function remove(optionValue: string) {
    onChange(value.filter((v) => v !== optionValue));
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="text-muted-foreground">{value.length > 0 ? `${value.length} selected` : placeholder}</span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={4}
            className="z-50 w-[min(24rem,90vw)] rounded-md border border-border bg-popover text-popover-foreground shadow-lg"
          >
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, email or id…"
                className="h-6 w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
              />
            </div>
            <div className="max-h-64 overflow-y-auto p-1">
              {filtered.length === 0 && <p className="px-2 py-3 text-center text-xs text-muted-foreground">No matches</p>}
              {filtered.map((option) => {
                const active = selected.has(option.value);
                return (
                  <label
                    key={option.value}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent',
                      active && 'bg-accent/60',
                    )}
                  >
                    <input type="checkbox" checked={active} onChange={() => toggle(option.value)} className="size-3.5 accent-[hsl(var(--primary))]" />
                    {option.icon}
                    <span className="flex-1 truncate text-foreground">{option.label}</span>
                    {option.sublabel && <span className="shrink-0 truncate text-xs text-muted-foreground">{option.sublabel}</span>}
                  </label>
                );
              })}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {selectedOptions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selectedOptions.map((option) => (
            <span key={option.value} className="flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
              {option.icon}
              {option.label}
              <button type="button" onClick={() => remove(option.value)} aria-label={`Remove ${option.label}`} className="text-muted-foreground hover:text-foreground">
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      )}
    </div>
  );
}

export interface SelectComboboxOption {
  value: string;
  label: string;
  /** Shown muted beside the label, in the list and on the trigger — an id, an email, an amount. */
  sublabel?: string;
  /** Matched on but not displayed — the email and uuid behind a row labelled by name. */
  keywords?: string;
  icon?: ReactNode;
}

export interface SelectComboboxProps {
  options: SelectComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  /** Trigger text when nothing is chosen. */
  placeholder?: string;
  /**
   * Adds a row at the top that clears the selection — "All affiliates" on a filter.
   * Omitted for a required choice, where there is nothing to fall back to.
   */
  clearLabel?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Searchable single-select — the one-value counterpart to `MultiSelectCombobox`.
 *
 * A native `<select>` is fine for five options and useless for five hundred: picking an
 * affiliate meant scrolling an alphabetical list with no way to type a name or an id.
 * This searches name, id, email and uuid at once, by the same punctuation-insensitive
 * rule as the multi-select, so "1011", "AFF-1011" and "aff1011" all find AFF-1011.
 *
 * Kept in this file deliberately: both pickers share `normalize`/`matches`, and search
 * that behaves differently between two controls on the same page is its own bug.
 */
export function SelectCombobox({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  clearLabel,
  searchPlaceholder = 'Search by name, email or id…',
  emptyMessage = 'No matches',
  className,
  disabled,
}: SelectComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find((option) => option.value === value) ?? null;

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return options;
    return options.filter((option) => matches(option, q));
  }, [options, query]);

  function choose(next: string) {
    onChange(next);
    setQuery('');
    setOpen(false);
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Cleared on close rather than on open, so the list is never briefly filtered
        // by the previous query in the frame before the input mounts.
        if (!next) setQuery('');
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
        >
          <span className="flex min-w-0 flex-1 items-center gap-2">
            {selected?.icon}
            <span className={cn('truncate', !selected && 'text-muted-foreground')}>{selected?.label ?? placeholder}</span>
            {selected?.sublabel && <span className="shrink-0 truncate text-xs text-muted-foreground">{selected.sublabel}</span>}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          // Matches the trigger's width so the open list reads as the same control,
          // with a floor for a narrow filter field and a cap for a full-width one.
          className="z-50 w-[min(24rem,90vw)] min-w-[var(--radix-popover-trigger-width)] rounded-md border border-border bg-popover text-popover-foreground shadow-lg"
        >
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              // Enter takes the top match, so a picker this size can be driven from the
              // keyboard alone: open, type three characters, Enter.
              onKeyDown={(event) => {
                if (event.key === 'Enter' && filtered[0]) {
                  event.preventDefault();
                  choose(filtered[0].value);
                }
              }}
              placeholder={searchPlaceholder}
              className="h-6 w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {clearLabel && (
              <button
                type="button"
                onClick={() => choose('')}
                className={cn(
                  'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent',
                  value === '' && 'bg-accent/60',
                )}
              >
                <Check className={cn('size-3.5 shrink-0', value === '' ? 'text-foreground' : 'text-transparent')} />
                <span className="flex-1 truncate text-muted-foreground">{clearLabel}</span>
              </button>
            )}
            {filtered.length === 0 && <p className="px-2 py-3 text-center text-xs text-muted-foreground">{emptyMessage}</p>}
            {filtered.map((option) => {
              const active = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => choose(option.value)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent',
                    active && 'bg-accent/60',
                  )}
                >
                  <Check className={cn('size-3.5 shrink-0', active ? 'text-foreground' : 'text-transparent')} />
                  {option.icon}
                  <span className="flex-1 truncate text-foreground">{option.label}</span>
                  {option.sublabel && <span className="shrink-0 truncate text-xs text-muted-foreground">{option.sublabel}</span>}
                </button>
              );
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
