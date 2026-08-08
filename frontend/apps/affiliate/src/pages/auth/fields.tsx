import type { ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';

/**
 * Form primitives for the signed-out screens.
 *
 * Plain elements with explicit classes rather than the shared `@fatexia/ui` Input:
 * these screens deliberately match the public site's marketing styling (taller fields,
 * translucent surfaces, green focus ring), which is a different visual language from
 * the dense dashboard controls used everywhere behind the login.
 */

export const FIELD =
  'w-full rounded-lg border border-white/10 bg-background/60 px-3.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 hover:border-white/20 focus:border-primary/60 focus:ring-2 focus:ring-ring/40';

export const INPUT = `h-11 ${FIELD}`;

export const PRIMARY_BUTTON =
  'bg-brand btn-shine relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-lg px-4 py-3 text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50';

export function Label({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <label className="text-sm font-medium text-foreground">
      {children}
      {required && <span className="ml-0.5 text-destructive">*</span>}
    </label>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</p>;
}

export function Select({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${INPUT} appearance-none pr-10 ${value ? '' : 'text-muted-foreground/70'}`}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option} value={option} className="text-foreground">
            {option}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

export function Chips({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => onToggle(option)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
              active
                ? 'border-primary/40 bg-primary/15 text-primary'
                : 'border-white/10 bg-background/60 text-muted-foreground hover:border-primary/30 hover:text-foreground'
            }`}
          >
            {active && <Check className="size-3.5" />}
            {option}
          </button>
        );
      })}
    </div>
  );
}

/** The scroll container's id, so multi-step forms can scroll it back to the top. */
export const AUTH_SCROLL_ID = 'auth-scroll';

/** Scrolls the auth container to the top — `window.scrollTo` does nothing here. */
export function scrollAuthToTop(smooth = true) {
  document.getElementById(AUTH_SCROLL_ID)?.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
}

/**
 * Wraps a signed-out screen: scopes the green brand theme, owns its own scrolling,
 * and centres the card.
 *
 * `h-screen overflow-y-auto` rather than `min-h-screen`, because the shared theme
 * pins `html, body, #root` to `height: 100%; overflow: hidden` — right for the
 * signed-in app, where AppShell scrolls its own main region, but it means a tall
 * page like the registration form simply cannot scroll the document. Scrolling
 * inside this element sidesteps that without mutating global styles on mount and
 * having to undo it on unmount.
 */
export function AuthShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div id={AUTH_SCROLL_ID} className="auth-scope h-screen overflow-y-auto bg-background px-4 py-12">
      <div className={`mx-auto w-full ${wide ? 'max-w-2xl' : 'max-w-md'}`}>{children}</div>
    </div>
  );
}
