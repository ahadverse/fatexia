'use client';

import { Toaster as Sonner } from 'sonner';

export { toast } from 'sonner';

export function Toaster() {
  return (
    <Sonner
      theme="dark"
      // Top-right, not Sonner's bottom-right default. Every form in both portals ends
      // in a `justify-end` action row, so a bottom-right toast lands directly on the
      // button that triggered it and swallows clicks until it fades — sending two
      // messages in a row, or correcting a form and re-saving, both hit this.
      position="top-right"
      toastOptions={{
        classNames: {
          toast: 'bg-popover text-popover-foreground border border-border shadow-md',
          description: 'text-muted-foreground',
          actionButton: 'bg-primary text-primary-foreground',
          cancelButton: 'bg-secondary text-secondary-foreground',
        },
      }}
    />
  );
}
