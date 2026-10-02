'use client';

import { useRef, useState, type ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { HelpCircle } from 'lucide-react';
import { cn } from '../lib/cn';

export interface InfoTipProps {
  children: ReactNode;
  /** Accessible name for the icon button. */
  label?: string;
  className?: string;
}

/**
 * A small "?" that shows its explanation in a popup, so a form can carry the long help
 * text without printing it under every field.
 *
 * Opens on hover and keyboard focus, and toggles on click/tap — hover alone would leave
 * a touch screen with no way to read it. A short close delay lets the pointer travel from
 * the icon onto the popup (to select or scroll the text) without it vanishing.
 */
export function InfoTip({ children, label = 'More information', className }: InfoTipProps) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function show() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  }

  function hide() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={label}
          onMouseEnter={show}
          onMouseLeave={hide}
          onFocus={show}
          onBlur={hide}
          className={cn(
            'inline-flex size-4 shrink-0 items-center justify-center rounded-full align-middle text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            className,
          )}
        >
          <HelpCircle className="size-4" aria-hidden />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="start"
          sideOffset={6}
          collisionPadding={8}
          onMouseEnter={show}
          onMouseLeave={hide}
          // Focus stays where the admin was typing; the popup is read-only.
          onOpenAutoFocus={(event) => event.preventDefault()}
          className="z-[60] w-72 max-w-[calc(100vw-1rem)] rounded-md border border-border bg-popover p-3 text-xs leading-relaxed text-popover-foreground shadow-md"
        >
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
