'use client';

import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from 'lucide-react';
import { Toaster as Sonner } from 'sonner';

export { toast } from 'sonner';

/**
 * Toast styling, shared by both portals.
 *
 * Every toast used to render in the same neutral popover grey, so "Saved" and "Payout
 * failed" were the same object and the only difference was the sentence — which is the
 * one thing a reader skims past when a toast appears in the corner of a screen they are
 * not looking at. Each type now carries its own colour on the icon, the border and a
 * tinted ground, so the outcome is readable before the words are.
 *
 * The tints are built from the theme's own success/destructive/warning/primary tokens
 * rather than fixed hexes, so they follow light and dark mode. Animations live in
 * theme.css, behind its `prefers-reduced-motion` guard.
 */
const TYPE_CLASSES = 'fatexia-toast border shadow-lg backdrop-blur-sm';

export function Toaster() {
  return (
    <Sonner
      // Surface colours come from the theme tokens in theme.css, not from this prop —
      // it is left at the default because a static value here cannot follow the app's
      // light/dark toggle, and a hardcoded "dark" painted Sonner's own internals dark
      // while our classes painted the toast light.
      //
      // Top-right, not Sonner's bottom-right default. Every form in both portals ends
      // in a `justify-end` action row, so a bottom-right toast lands directly on the
      // button that triggered it and swallows clicks until it fades — sending two
      // messages in a row, or correcting a form and re-saving, both hit this.
      position="top-right"
      // Clears the header rather than sitting on top of it. Sonner's 32px default put
      // the toast across the topbar's notification and messages buttons — which is
      // exactly where someone looks after a "Sent" confirmation, and the toast eats
      // the clicks until it fades. 4.5rem clears the public site's 64px navbar and the
      // portals' 56px topbar with room to spare.
      //
      // Both are needed: below 600px Sonner stops reading `offset` entirely and
      // positions from `mobileOffset` instead, so setting only the first leaves the
      // toast back over the header on exactly the screens where it covers the most.
      offset="4.5rem"
      mobileOffset={{ top: '4.5rem', right: '1rem', bottom: '1rem', left: '1rem' }}
      // Our own icons, so they match the lucide set the rest of the UI draws from and
      // can be coloured per type rather than inheriting Sonner's built-in SVGs.
      icons={{
        success: <CheckCircle2 className="size-5 text-success" />,
        error: <XCircle className="size-5 text-destructive" />,
        warning: <AlertTriangle className="size-5 text-warning" />,
        info: <Info className="size-5 text-primary" />,
        loading: <Loader2 className="size-5 animate-spin text-primary" />,
      }}
      toastOptions={{
        classNames: {
          toast: `${TYPE_CLASSES} bg-popover/95 text-popover-foreground border-border`,
          title: 'font-medium',
          description: 'text-muted-foreground',
          actionButton: 'bg-primary text-primary-foreground',
          cancelButton: 'bg-secondary text-secondary-foreground',
          // The accent colour is carried by a left stripe (drawn in theme.css from
          // `--toast-accent`) plus a matching border and ground, so the type reads even
          // at a glance with the icon out of focus.
          success: 'fatexia-toast-success',
          error: 'fatexia-toast-error',
          warning: 'fatexia-toast-warning',
          info: 'fatexia-toast-info',
          loading: 'fatexia-toast-info',
        },
      }}
    />
  );
}
