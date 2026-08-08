import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@fatexia/ui';
import '@fatexia/ui/styles/theme.css';
import './index.css';
import App from './App.tsx';
import { setTokens } from './lib/api';
import { SessionProvider } from './session/SessionContext';
import { RealtimeProvider } from './realtime/RealtimeContext';

/**
 * Admin "Log in as affiliate" hands off a real session by opening this app with
 * `?at=&rt=` on the URL (see AllAffiliates.tsx in the admin portal). Consumed here,
 * synchronously, before SessionProvider's own hydration runs — so the very first
 * `hasStoredSession()` check already sees the tokens, and the tab lands on the
 * dashboard already authenticated rather than the login screen.
 *
 * Read once and stripped from the URL immediately: a bearer token sitting in the
 * address bar/history is worth minimizing, even for a same-tab handoff.
 */
function consumeHandoffTokens(): void {
  const params = new URLSearchParams(window.location.search);
  const accessToken = params.get('at');
  const refreshToken = params.get('rt');
  if (!accessToken || !refreshToken) return;

  setTokens({ accessToken, refreshToken });
  window.history.replaceState({}, '', window.location.pathname);
}

consumeHandoffTokens();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <SessionProvider>
        {/* Inside SessionProvider (it connects only once authenticated) and outside
            the router, so a route change never tears down the live connection. */}
        <RealtimeProvider>
          <App />
        </RealtimeProvider>
      </SessionProvider>
    </ThemeProvider>
  </StrictMode>,
);
