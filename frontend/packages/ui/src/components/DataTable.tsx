'use client';

import type { ReactNode } from 'react';
import { ChevronDown, ChevronsUpDown, ChevronUp } from 'lucide-react';
import { cn } from '../lib/cn';

export type SortDirection = 'ASC' | 'DESC';

export interface TableSort {
  key: string;
  direction: SortDirection;
}

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  /** Renders the header as a sort toggle. Requires `sort` + `onSortChange`. */
  sortable?: boolean;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  emptyMessage?: string;
  sort?: TableSort;
  onSortChange?: (sort: TableSort) => void;
  /** A totals row pinned below the body. */
  footer?: ReactNode;
  /**
   * Overrides the width below which the table scrolls instead of shrinking.
   *
   * Any CSS length. Rarely needed — the default is derived from the column count —
   * but a table of nothing but short badges can afford less, and one carrying a URL
   * or an email in every row needs more.
   */
  minWidth?: string;
  /**
   * Row-selection checkboxes, opt-in like sorting (`canSelect = Boolean(onSelectionChange)`).
   *
   * Scoped to the current page: the header checkbox reflects and toggles only the
   * `rows` currently rendered, not every row a caller has ever selected across pages —
   * the same page-at-a-time model every other piece of state on these tables already
   * follows (sort, filters, page size).
   */
  selectedKeys?: Set<string>;
  onSelectionChange?: (keys: Set<string>) => void;
}

/**
 * The width a table stops shrinking at and starts scrolling.
 *
 * A `w-full` table inside a scroll container never scrolls: it shrinks to the
 * container instead, and on a phone twelve columns become 33px each, which turns every
 * cell into a vertical stack of broken words. Below six columns that is not a real
 * risk and a fluid table looks better, so the floor only applies past that.
 *
 * Derived from the column count rather than hard-coded per table, because the tables
 * here run from three columns to fifteen and one number cannot serve both. 5rem per
 * column is about what a short value plus its padding needs.
 */
function defaultMinWidth(columnCount: number): string | undefined {
  return columnCount > 6 ? `${columnCount * 5}rem` : undefined;
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  emptyMessage = 'No data.',
  sort,
  onSortChange,
  footer,
  minWidth,
  selectedKeys,
  onSelectionChange,
}: DataTableProps<T>) {
  // A column only sorts when the table was actually given a handler — otherwise the
  // header would look interactive and do nothing.
  const canSort = Boolean(onSortChange);
  const canSelect = Boolean(onSelectionChange);

  function toggleSort(key: string) {
    if (!onSortChange) return;
    // First click on a new column starts descending: for traffic and money columns the
    // interesting end is the top, and ascending would open on a screen of zeroes.
    onSortChange(
      sort?.key === key ? { key, direction: sort.direction === 'ASC' ? 'DESC' : 'ASC' } : { key, direction: 'DESC' },
    );
  }

  const pageKeys = rows.map(getRowKey);
  const selectedOnPage = pageKeys.filter((key) => selectedKeys?.has(key)).length;
  const allOnPageSelected = pageKeys.length > 0 && selectedOnPage === pageKeys.length;
  const someOnPageSelected = selectedOnPage > 0 && !allOnPageSelected;

  function toggleAllOnPage() {
    if (!onSelectionChange || !selectedKeys) return;
    const next = new Set(selectedKeys);
    if (allOnPageSelected) {
      pageKeys.forEach((key) => next.delete(key));
    } else {
      pageKeys.forEach((key) => next.add(key));
    }
    onSelectionChange(next);
  }

  function toggleRow(key: string) {
    if (!onSelectionChange || !selectedKeys) return;
    const next = new Set(selectedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onSelectionChange(next);
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm" style={{ minWidth: minWidth ?? defaultMinWidth(columns.length) }}>
        <thead>
          <tr className="border-b border-border">
            {canSelect && (
              <th className="w-10 px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someOnPageSelected;
                  }}
                  onChange={toggleAllOnPage}
                  aria-label="Select all rows on this page"
                  className="size-3.5 accent-[hsl(var(--primary))]"
                />
              </th>
            )}
            {columns.map((col) => {
              const sortable = canSort && col.sortable;
              const active = sort?.key === col.key;
              return (
                <th
                  key={col.key}
                  aria-sort={active ? (sort!.direction === 'ASC' ? 'ascending' : 'descending') : 'none'}
                  // nowrap: a header is two or three words and wrapping it into a
                  // tower of single letters costs more height than the column saves.
                  className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className="flex items-center gap-1 rounded-sm uppercase tracking-wider transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {col.header}
                      {!active && <ChevronsUpDown className="size-3 opacity-50" aria-hidden />}
                      {active && sort!.direction === 'ASC' && <ChevronUp className="size-3" aria-hidden />}
                      {active && sort!.direction === 'DESC' && <ChevronDown className="size-3" aria-hidden />}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length + (canSelect ? 1 : 0)} className="px-4 py-8 text-center text-muted-foreground">
                {emptyMessage}
              </td>
            </tr>
          )}
          {rows.map((row) => {
            const key = getRowKey(row);
            return (
              <tr key={key} className="border-b border-border last:border-0 hover:bg-accent/50">
                {canSelect && (
                  <td className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={selectedKeys?.has(key) ?? false}
                      onChange={() => toggleRow(key)}
                      aria-label="Select row"
                      className="size-3.5 accent-[hsl(var(--primary))]"
                    />
                  </td>
                )}
                {columns.map((col) => (
                  <td key={col.key} className={cn('px-4 py-2.5 text-card-foreground', col.className)}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
        {footer && (
          <tfoot className="border-t-2 border-border">
            <tr className="font-medium text-card-foreground">{footer}</tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
