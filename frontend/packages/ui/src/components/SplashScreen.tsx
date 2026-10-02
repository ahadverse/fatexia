import { LogoMark } from './LogoMark';

/**
 * Full-viewport branded loading state, shown while the session (and, in admin, the
 * permission set) is still resolving on a page reload.
 *
 * The same visual is inlined in each app's index.html so there is no gap between the
 * static HTML and React's first render — keep the two in step.
 */
export function SplashScreen() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background"
    >
      <LogoMark className="h-10 animate-[fatexia-splash-pulse_1.8s_ease-in-out_infinite]" />
      <div className="h-0.5 w-40 overflow-hidden rounded-full bg-border">
        <div className="h-full w-1/3 animate-[fatexia-indeterminate_1.2s_ease-in-out_infinite] rounded-full bg-primary" />
      </div>
    </div>
  );
}
