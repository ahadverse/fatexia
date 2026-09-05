import type { NextFunction, Response } from 'express';
import { ForbiddenError } from '../errors';
import { UserRole } from '../../modules/users/user.entity';
import { managerRepository } from '../../modules/managers/manager.repository';
import type { ManagerPermission, ManagerPermissions } from '../../modules/managers/manager.entity';
import type { AuthenticatedRequest } from './auth.guard';

/**
 * Issues #5 and #20 — who a manager may act on, and what they may do.
 *
 * `requireRole(ADMIN, MANAGER)` answers neither: it lets any manager reach every
 * affiliate in the network with the full admin action set. These two middlewares are
 * the missing half.
 *
 * Deliberately two pieces rather than one. Scope (which rows) is needed on every
 * manager request, including plain reads; permission (which verbs) is per-route. A
 * combined guard would force every read route to name a permission it doesn't need.
 */
export interface ScopedRequest extends AuthenticatedRequest {
  /**
   * Present only for MANAGER-role requests. Its absence on an authenticated request
   * therefore means "admin, network-wide" — services read it as `managerId ?? null`
   * and treat null as unscoped, so an admin is never accidentally filtered.
   */
  managerScope?: { managerId: string; permissions: ManagerPermissions };
}

/**
 * Resolves the signed-in manager's own row and pins it to the request. Must run after
 * `requireAuth`/`requireRole` and before any `requirePermission` on the same router.
 *
 * A MANAGER-role login with no manager profile is rejected rather than silently
 * treated as unscoped — that combination can only come from a half-provisioned
 * account, and reading it as "no scope" would hand it the admin's network-wide view.
 */
export async function attachManagerScope(req: ScopedRequest, _res: Response, next: NextFunction): Promise<void> {
  if (req.user?.role !== UserRole.MANAGER) {
    next();
    return;
  }
  try {
    const manager = await managerRepository.findByUserId(req.user.id);
    if (!manager) {
      next(new ForbiddenError('No manager profile is linked to this account'));
      return;
    }
    req.managerScope = { managerId: manager.id, permissions: manager.permissions ?? {} };
    next();
  } catch (err) {
    next(err);
  }
}

// Reads as a sentence in the error message: "…does not allow approving affiliates".
const PERMISSION_LABELS: Record<ManagerPermission, string> = {
  'affiliates.view': 'viewing affiliates',
  'affiliates.create': 'creating affiliates',
  'affiliates.edit': 'editing affiliates',
  'affiliates.approve': 'approving affiliates',
  'affiliates.suspend': 'suspending affiliates',
  'affiliates.reject': 'rejecting affiliates',
  'affiliates.delete': 'deleting affiliates',
  'affiliates.payout': 'changing payout details',
  'affiliates.impersonate': 'logging in as an affiliate',
  'offers.view': 'viewing offers',
  'offers.create': 'creating offers',
  'offers.edit': 'editing offers',
  'advertisers.manage': 'managing advertisers',
  'reports.view': 'viewing reports',
  'messages.send': 'messaging affiliates',
};

export function describePermission(permission: ManagerPermission): string {
  return PERMISSION_LABELS[permission];
}

/**
 * Gates a route on one or more manager permissions. ADMIN always passes — the
 * permission grid describes what an admin delegates, not what an admin may do.
 */
export function requirePermission(...permissions: ManagerPermission[]) {
  return (req: ScopedRequest, _res: Response, next: NextFunction): void => {
    if (req.user?.role === UserRole.ADMIN) {
      next();
      return;
    }
    const scope = req.managerScope;
    if (!scope) {
      next(new ForbiddenError('Insufficient role'));
      return;
    }
    const missing = permissions.filter((permission) => scope.permissions[permission] !== true);
    if (missing.length > 0) {
      next(new ForbiddenError(`Your manager account does not allow ${missing.map(describePermission).join(' or ')}`));
      return;
    }
    next();
  };
}
