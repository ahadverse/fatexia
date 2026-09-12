'use client';

import { useMemo, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { ChevronDown, Search, X } from 'lucide-react';
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
    return options.filter((option) =>
      normalize(`${option.label} ${option.sublabel ?? ''} ${option.keywords ?? ''} ${option.value}`).includes(q),
    );
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
