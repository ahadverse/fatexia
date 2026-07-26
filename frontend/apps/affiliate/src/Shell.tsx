import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell, LogoMark } from '@fatexia/ui';
import { affiliateMenu } from './menu';
import { useSession } from './session/SessionContext';
import { useRealtime } from './realtime/RealtimeContext';
import { useNotificationBell } from './hooks/useNotificationBell';

export function Shell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useSession();
  const { unreadMessages } = useRealtime();
  // Spread straight into AppShell: AppShellProps extends TopbarProps and the shell
  // forwards the rest, so the bell needs no plumbing of its own.
  const bell = useNotificationBell();

  function handleNavigate(path: string) {
    if (path === '/logout') {
      logout();
      return;
    }
    navigate(path);
  }

  return (
    <AppShell
      menu={affiliateMenu}
      currentPath={location.pathname}
      onNavigate={handleNavigate}
      userLabel="Affiliate"
      userName={user?.email ?? 'Affiliate'}
      unreadMessages={unreadMessages}
      onMessagesClick={() => navigate('/messages')}
      {...bell}
      onProfileClick={() => navigate('/profile')}
      onLogout={() => logout()}
      logoMark={<LogoMark />}
      logoText="Fatexia"
    >
      {children}
    </AppShell>
  );
}
