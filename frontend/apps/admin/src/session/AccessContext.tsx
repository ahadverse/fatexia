import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Manager, ManagerPermission, ManagerPermissions } from '@fatexia/types';
import { getOwnManager } from '../lib/managers-api';
import { useSession } from './SessionContext';

// A shared frozen empty grid, so "no manager profile" is referentially stable and
// doesn't invalidate the memos below on every render.
const EMPTY_PERMISSIONS: ManagerPermissions = Object.freeze({});

/**
 * Issue #4/#20 — the manager portal, which is this portal with less of it.
 *
 * Managers and admins share one build, so what a manager sees has to be decided at
 * render time from their permission grid. This is the one place that decision is
 * made; every nav entry, route and action button asks `can(...)` rather than
 * inspecting a role or a permission object of its own.
 *
 * The server enforces the same grid independently (see manager-scope.guard.ts) — this
 * exists so a manager is never shown a button that would 403, not as the security
 * boundary.
 */
interface AccessValue {
  isAdmin: boolean;
  /** The signed-in manager's own profile — null for an admin, or while loading. */
  manager: Manager | null;
  permissions: ManagerPermissions;
  loading: boolean;
  can: (permission: ManagerPermission) => boolean;
}

const AccessContext = createContext<AccessValue | null>(null);

export function AccessProvider({ children }: { children: ReactNode }) {
  const { user, status } = useSession();
  const isAdmin = user?.role === 'ADMIN';
  const [manager, setManager] = useState<Manager | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== 'authenticated') return;
    if (isAdmin) {
      setManager(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getOwnManager()
      .then((result) => {
        if (!cancelled) setManager(result);
      })
      // A manager whose profile can't be read gets an empty grid rather than a blank
      // portal: failing closed here means they see the dashboard and nothing they
      // cannot do, instead of a crash or a full admin nav they'd be 403'd out of.
      .catch(() => {
        if (!cancelled) setManager(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [status, isAdmin]);

  const permissions = manager?.permissions ?? EMPTY_PERMISSIONS;

  // `can` is memoised because the nav is rebuilt from it — a fresh function every
  // render would defeat the useMemo in Shell and rebuild the whole tree each time.
  const can = useCallback(
    (permission: ManagerPermission) => isAdmin || permissions[permission] === true,
    [isAdmin, permissions],
  );

  const value = useMemo<AccessValue>(
    () => ({ isAdmin, manager, permissions, loading: isAdmin ? false : loading, can }),
    [isAdmin, manager, permissions, loading, can],
  );

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess(): AccessValue {
  const ctx = useContext(AccessContext);
  if (!ctx) {
    throw new Error('useAccess must be used within an AccessProvider');
  }
  return ctx;
}
