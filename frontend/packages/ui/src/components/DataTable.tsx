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
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  emptyMessage = 'No data.',
  sort,
  onSortChange,
  footer,
}: DataTableProps<T>) {
  // A column only sorts when the table was actually given a handler — otherwise the
  // header would look interactive and do nothing.
  const canSort = Boolean(onSortChange);

  function toggleSort(key: string) {
    if (!onSortChange) return;
    // First click on a new column starts descending: for traffic and money columns the
    // interesting end is the top, and ascending would open on a screen of zeroes.
    onSortChange(
      sort?.key === key ? { key, direction: sort.direction === 'ASC' ? 'DESC' : 'ASC' } : { key, direction: 'DESC' },
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => {
              const sortable = canSort && col.sortable;
              const active = sort?.key === col.key;
              return (
                <th
                  key={col.key}
                  aria-sort={active ? (sort!.direction === 'ASC' ? 'ascending' : 'descending') : 'none'}
                  className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
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
              <td colSpan={columns.length} className="px-4 py-8 text-center text-muted-foreground">
                {emptyMessage}
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={getRowKey(row)} className="border-b border-border last:border-0 hover:bg-accent/50">
              {columns.map((col) => (
                <td key={col.key} className={cn('px-4 py-2.5 text-card-foreground', col.className)}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
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
