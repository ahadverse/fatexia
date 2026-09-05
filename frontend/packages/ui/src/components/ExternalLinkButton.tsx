'use client';

import { ExternalLink } from 'lucide-react';
import { cn } from '../lib/cn';

export interface ExternalLinkButtonProps {
  href: string;
  className?: string;
  label?: string;
}

/**
 * A real `<a target="_blank">`, not a JS onClick handler — issue #14: right-clicking a
 * Copy-only button never offers "Open link in new tab" because there is no anchor
 * underneath for the browser's native context menu to act on. Pairs alongside an
 * existing Copy button rather than replacing it.
 */
export function ExternalLinkButton({ href, className, label = 'Open link in new tab' }: ExternalLinkButtonProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border px-2.5 text-xs text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <ExternalLink className="size-3.5" />
    </a>
  );
}
