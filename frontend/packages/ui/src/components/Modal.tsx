'use client';

import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../lib/cn';

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Modal({ open, onOpenChange, title, children, className }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80" />
        <Dialog.Content
          className={cn(
            // Width leaves a gutter rather than running edge to edge on a phone, where
            // `w-full` put the border and its rounded corners off-screen. Padding
            // tightens with it — 24px a side inside a 328px dialog is most of the room
            // a form field has to live in.
            'fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-border bg-card p-4 text-card-foreground shadow-md sm:p-6',
            className,
          )}
        >
          <div className="flex shrink-0 items-center justify-between">
            {title && <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>}
            <Dialog.Close className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <X className="size-4" />
            </Dialog.Close>
          </div>
          {/* -mx-2/px-2 keeps focus rings from being clipped by the scroll container. */}
          <div className="-mx-2 mt-4 flex-1 overflow-y-auto px-2">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
