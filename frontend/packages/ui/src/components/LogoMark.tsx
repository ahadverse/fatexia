import { cn } from '../lib/cn';

export interface LogoMarkProps {
  /**
   * `full` shows the whole wordmark. `mark` crops to just the FX monogram on the
   * left — the collapsed sidebar is 64px wide, where a horizontal wordmark would
   * either overflow or shrink to unreadable. Cropping via a fixed-width window is
   * what lets one asset serve both, instead of shipping a second file that can drift
   * out of sync with the first.
   */
  variant?: 'full' | 'mark';
  className?: string;
}

// Served from each app's own `public/logo.png`, so the same path resolves in the
// admin SPA, the affiliate SPA and the Next.js public site without an import alias.
export function LogoMark({ variant = 'full', className }: LogoMarkProps) {
  if (variant === 'mark') {
    return (
      <span className={cn('block h-8 w-8 shrink-0 overflow-hidden', className)}>
        <img src="/logo.png" alt="Fatexia" className="h-8 w-auto max-w-none object-left" />
      </span>
    );
  }

  return <img src="/logo.png" alt="Fatexia" className={cn('h-7 w-auto shrink-0', className)} />;
}
