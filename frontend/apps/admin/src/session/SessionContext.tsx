import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { PublicUser } from '@fatexia/types';
import { getMe, login as apiLogin, logout as apiLogout } from '../lib/auth-api';
import { hasStoredSession, onSessionInvalidated } from '../lib/api';

type Status = 'loading' | 'authenticated' | 'anonymous';

interface SessionValue {
  status: Status;
  user: PublicUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<PublicUser | null>(null);

  const hydrate = useCallback(async () => {
    if (!hasStoredSession()) {
      setStatus('anonymous');
      return;
    }
    try {
      const me = await getMe();
      setUser(me);
      setStatus('authenticated');
    } catch {
      setUser(null);
      setStatus('anonymous');
    }
  }, []);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    return onSessionInvalidated(() => {
      setUser(null);
      setStatus('anonymous');
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const me = await apiLogin(email, password);
    setUser(me);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(() => {
    apiLogout();
    setUser(null);
    setStatus('anonymous');
  }, []);

  return <SessionContext.Provider value={{ status, user, login, logout }}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return ctx;
}
