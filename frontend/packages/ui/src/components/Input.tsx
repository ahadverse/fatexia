'use client';

import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../lib/cn';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, type, ...props }, ref) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === 'password';

  const field = (
    <input
      ref={ref}
      // Swapped to `text` rather than toggling an attribute on a persistent node, so
      // the value and cursor position survive the switch.
      type={isPassword && revealed ? 'text' : type}
      className={cn(
        // `block`, not the input default of inline-block: inside the reveal wrapper
        // below, an inline-block's own margin (`mt-1`, which most call sites pass) is
        // counted into the wrapper's height, and the button centred against it would
        // sit a couple of pixels high. As a block it collapses out to the wrapper and
        // the two boxes line up exactly.
        'block h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        // Room for the button, so a long value scrolls under the label rather than
        // behind the icon.
        isPassword && 'pr-9',
        className,
      )}
      {...props}
    />
  );

  if (!isPassword) return field;

  // Width classes passed to a password Input land on the field, not on this wrapper, so
  // the button would detach from a narrowed input. Size the parent instead — every
  // password field in the app is full-width, which is the case this is built for.
  return (
    <div className="relative">
      {field}
      <button
        type="button"
        onClick={() => setRevealed((value) => !value)}
        // Focusable rather than tabIndex={-1}: it is a real control, and someone
        // filling the form by keyboard is exactly who needs to check a typo.
        aria-label={revealed ? 'Hide password' : 'Show password'}
        aria-pressed={revealed}
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
});
