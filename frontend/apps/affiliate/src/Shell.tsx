import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { AffiliateManagerContact } from '@fatexia/types';
import { AppShell } from '@fatexia/ui';
import { affiliateMenu } from './menu';
import { ManagerCard } from './components/ManagerCard';
import { useAsync } from './hooks/useAsync';
import { getOwnManager } from './lib/portal-api';
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
  // Fetched once for the whole session rather than per page — the card lives in the
  // shell, and an assignment change mid-session is rare enough to wait for a reload.
  const manager = useAsync<AffiliateManagerContact | null>(() => getOwnManager(), []);

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
      colorfulNav
      sidebarFooter={<ManagerCard manager={manager.data ?? null} loading={manager.loading} />}
    >
      {children}
    </AppShell>
  );
}
