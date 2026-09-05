import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { AppShell } from '@fatexia/ui';
import { buildMenu } from './menu';
import { useSession } from './session/SessionContext';
import { useAccess } from './session/AccessContext';
import { useRealtime } from './realtime/RealtimeContext';
import { useNotificationBell } from './hooks/useNotificationBell';

export function Shell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useSession();
  const { isAdmin, can, manager } = useAccess();
  const { unreadMessages } = useRealtime();
  // Spread straight into AppShell: AppShellProps extends TopbarProps and the shell
  // forwards the rest, so the bell needs no plumbing of its own.
  const bell = useNotificationBell();

  // Rebuilt only when the grid actually changes — `can` is stable per permission set.
  const menu = useMemo(() => buildMenu({ isAdmin, can }), [isAdmin, can]);

  function handleNavigate(path: string) {
    if (path === '/logout') {
      logout();
      return;
    }
    navigate(path);
  }

  return (
    <AppShell
      menu={menu}
      currentPath={location.pathname}
      onNavigate={handleNavigate}
      userLabel={isAdmin ? 'Admin' : (manager?.publicId ?? 'Manager')}
      userName={user?.email ?? (isAdmin ? 'Admin' : 'Manager')}
      unreadMessages={unreadMessages}
      onMessagesClick={() => navigate('/affiliates/messages')}
      {...bell}
      onProfileClick={() => navigate('/profile')}
      onLogout={() => logout()}
    >
      {children}
    </AppShell>
  );
}
