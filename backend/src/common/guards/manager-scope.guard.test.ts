import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Response } from 'express';
import { ForbiddenError } from '../errors';
import { UserRole } from '../../modules/users/user.entity';
import type { ManagerPermissions } from '../../modules/managers/manager.entity';

import { attachManagerScope, requirePermission } from './manager-scope.guard';

// `vi.hoisted` because `vi.mock` is lifted above the imports (see the note in
// payout-resolution.test.ts).
const { findByUserId } = vi.hoisted(() => ({ findByUserId: vi.fn() }));
vi.mock('../../modules/managers/manager.repository', () => ({
  managerRepository: { findByUserId },
}));

// Express's Response is never touched by either guard — they only ever call next().
const res = {} as Response;

function run(guard: (req: never, res: Response, next: NextFunction) => unknown, req: object) {
  return new Promise<{ error: unknown; req: Record<string, unknown> }>((resolve) => {
    const next: NextFunction = (error?: unknown) => resolve({ error, req: req as Record<string, unknown> });
    void guard(req as never, res, next);
  });
}

beforeEach(() => {
  findByUserId.mockReset();
});

describe('attachManagerScope', () => {
  it('leaves an admin unscoped, so they see the whole network', async () => {
    const { error, req } = await run(attachManagerScope, { user: { id: 'u1', role: UserRole.ADMIN } });
    expect(error).toBeUndefined();
    expect(req.managerScope).toBeUndefined();
    expect(findByUserId).not.toHaveBeenCalled();
  });

  it('pins a manager’s own id and permissions to the request', async () => {
    findByUserId.mockResolvedValue({ id: 'mgr-1', permissions: { 'affiliates.view': true } });
    const { error, req } = await run(attachManagerScope, { user: { id: 'u2', role: UserRole.MANAGER } });
    expect(error).toBeUndefined();
    expect(req.managerScope).toEqual({ managerId: 'mgr-1', permissions: { 'affiliates.view': true } });
  });

  /**
   * A MANAGER login with no manager row can only come from a half-provisioned
   * account. Reading it as "no scope" would hand it the admin's network-wide view —
   * the single most damaging way this guard could fail, so it rejects instead.
   */
  it('rejects a MANAGER login that has no manager profile', async () => {
    findByUserId.mockResolvedValue(null);
    const { error, req } = await run(attachManagerScope, { user: { id: 'u3', role: UserRole.MANAGER } });
    expect(error).toBeInstanceOf(ForbiddenError);
    expect(req.managerScope).toBeUndefined();
  });

  it('treats a manager with a null permission grid as having none', async () => {
    findByUserId.mockResolvedValue({ id: 'mgr-2', permissions: null });
    const { req } = await run(attachManagerScope, { user: { id: 'u4', role: UserRole.MANAGER } });
    expect((req.managerScope as { permissions: ManagerPermissions }).permissions).toEqual({});
  });

  it('passes a repository failure to the error handler rather than continuing unscoped', async () => {
    findByUserId.mockRejectedValue(new Error('database down'));
    const { error, req } = await run(attachManagerScope, { user: { id: 'u5', role: UserRole.MANAGER } });
    expect(error).toBeInstanceOf(Error);
    expect(req.managerScope).toBeUndefined();
  });
});

describe('requirePermission', () => {
  it('lets an admin through without consulting any grid', async () => {
    const { error } = await run(requirePermission('affiliates.payout'), { user: { id: 'u1', role: UserRole.ADMIN } });
    expect(error).toBeUndefined();
  });

  it('allows a manager holding the permission', async () => {
    const { error } = await run(requirePermission('affiliates.edit'), {
      user: { id: 'u2', role: UserRole.MANAGER },
      managerScope: { managerId: 'mgr-1', permissions: { 'affiliates.edit': true } },
    });
    expect(error).toBeUndefined();
  });

  it('blocks a manager without it, and says which capability is missing', async () => {
    const { error } = await run(requirePermission('affiliates.payout'), {
      user: { id: 'u2', role: UserRole.MANAGER },
      managerScope: { managerId: 'mgr-1', permissions: { 'affiliates.edit': true } },
    });
    expect(error).toBeInstanceOf(ForbiddenError);
    expect((error as Error).message).toContain('changing payout details');
  });

  // Absent means denied — the server never stores an explicit `false`, so a missing
  // key and a false one must behave identically.
  it.each([[{}], [{ 'affiliates.edit': false } as ManagerPermissions]])(
    'denies when the key is absent or false (%p)',
    async (permissions) => {
      const { error } = await run(requirePermission('affiliates.edit'), {
        user: { id: 'u2', role: UserRole.MANAGER },
        managerScope: { managerId: 'mgr-1', permissions },
      });
      expect(error).toBeInstanceOf(ForbiddenError);
    },
  );

  it('requires every permission when several are named', async () => {
    const scope = { managerId: 'mgr-1', permissions: { 'offers.view': true } };
    const req = { user: { id: 'u2', role: UserRole.MANAGER }, managerScope: scope };
    await expect(run(requirePermission('offers.view'), req).then((r) => r.error)).resolves.toBeUndefined();
    await expect(run(requirePermission('offers.view', 'offers.edit'), req).then((r) => r.error)).resolves.toBeInstanceOf(
      ForbiddenError,
    );
  });

  /**
   * Fails closed. If `attachManagerScope` was left off a router by mistake, a manager
   * request arrives with no scope — that must be a refusal, not a free pass.
   */
  it('denies a non-admin arriving with no scope at all', async () => {
    const { error } = await run(requirePermission('affiliates.view'), { user: { id: 'u2', role: UserRole.MANAGER } });
    expect(error).toBeInstanceOf(ForbiddenError);
  });

  it('denies an unauthenticated request', async () => {
    const { error } = await run(requirePermission('affiliates.view'), {});
    expect(error).toBeInstanceOf(ForbiddenError);
  });

  // An affiliate reaching a staff route is already a routing bug; the guard must not
  // be the thing that lets it through.
  it('denies an affiliate even with a scope somehow attached', async () => {
    const { error } = await run(requirePermission('affiliates.view'), {
      user: { id: 'u9', role: UserRole.AFFILIATE },
      managerScope: undefined,
    });
    expect(error).toBeInstanceOf(ForbiddenError);
  });
});
