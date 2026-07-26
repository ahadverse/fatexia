import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@fatexia/ui';
import '@fatexia/ui/styles/theme.css';
import './index.css';
import App from './App.tsx';
import { SessionProvider } from './session/SessionContext';
import { RealtimeProvider } from './realtime/RealtimeContext';

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
