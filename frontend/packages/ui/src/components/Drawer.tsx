'use client';

import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../lib/cn';

export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: ReactNode;
  /** Pinned to the footer, below the scrolling body. */
  footer?: ReactNode;
  className?: string;
}

/**
 * Right-hand side panel. Same Radix Dialog primitive as `Modal` (so focus trap,
 * Escape and scroll-lock behave identically) — the difference is purely that this
 * one slides in against the edge and owns its own scroll, which is what a long
 * record inspector needs. A centred Modal would have to grow taller than the
 * viewport to show the same content.
 */
export function Drawer({ open, onOpenChange, title, description, children, footer, className }: DrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            'fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-card text-card-foreground shadow-md outline-none',
            className,
          )}
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="min-w-0">
              {title && <Dialog.Title className="truncate text-base font-semibold">{title}</Dialog.Title>}
              {description && <Dialog.Description className="mt-0.5 text-xs text-muted-foreground">{description}</Dialog.Description>}
            </div>
            <Dialog.Close
              aria-label="Close"
              className="rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

          {footer && <div className="shrink-0 border-t border-border px-5 py-3">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export interface DrawerSectionProps {
  title: string;
  children: ReactNode;
}

export function DrawerSection({ title, children }: DrawerSectionProps) {
  return (
    <section className="border-b border-border py-4 first:pt-0 last:border-b-0 last:pb-0">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">{children}</dl>
    </section>
  );
}

/**
 * Label left, value right, one row per field with a divider.
 *
 * A different shape from `DrawerSection`'s two-column grid, and better for a record
 * inspector: every label lines up in one scannable column, and a long value (a user
 * agent, a URL) simply wraps under itself instead of forcing the neighbouring cell to
 * grow. Both shapes are exported — other drawers still use the grid.
 */
export function DrawerRows({ children }: { children: ReactNode }) {
  return <dl className="divide-y divide-border">{children}</dl>;
}

export interface DrawerRowProps {
  label: string;
  children: ReactNode;
  /** Monospace + break-all, for ids, IPs, URLs and agent strings. */
  mono?: boolean;
}

export function DrawerRow({ label, children, mono }: DrawerRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={cn('min-w-0 text-right text-sm text-card-foreground', mono ? 'break-all font-mono text-xs' : 'break-words')}>
        {children}
      </dd>
    </div>
  );
}

export interface DrawerFieldProps {
  label: string;
  children: ReactNode;
  /** Full-width row — for values that wrap, like a user agent or referer. */
  wide?: boolean;
  /** Monospace + break-all, for ids, IPs and URLs. */
  mono?: boolean;
}

export function DrawerField({ label, children, wide, mono }: DrawerFieldProps) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn('mt-0.5 text-card-foreground', mono ? 'break-all font-mono text-xs' : 'break-words')}>{children}</dd>
    </div>
  );
}
