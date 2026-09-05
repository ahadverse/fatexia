import { z } from 'zod';
import type { SelectQueryBuilder, ObjectLiteral } from 'typeorm';

/**
 * Issue #5, applied to the traffic tables.
 *
 * Scoping the affiliate *list* is not enough: a manager who can open Reports, Clicks
 * or Conversions would otherwise read the whole network's numbers, which is exactly
 * the data an affiliate relationship is supposed to be private about.
 *
 * Written as a correlated subquery rather than "fetch the manager's affiliate ids,
 * then pass an IN list": the id list would be a second round trip on every request,
 * would grow unbounded with the manager's book, and would need an awkward special case
 * for a manager with no affiliates yet (an empty `IN ()` is a SQL syntax error, while
 * an empty subquery correctly matches nothing).
 */
export function applyManagerScope<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  alias: string,
  managerScopeId: string | undefined,
): void {
  if (!managerScopeId) return;
  qb.andWhere(
    `${alias}."affiliateId" IN (SELECT scoped_affiliate.id FROM affiliates scoped_affiliate WHERE scoped_affiliate."assignedManagerId" = :managerScopeId)`,
    { managerScopeId },
  );
}

/**
 * The field carrying that scope through a filter object.
 *
 * It is part of the request schemas so the typed filter DTOs can hold it, but every
 * controller overwrites it from the session before the value reaches a repository —
 * see `scopedQuery` below. A client that sends its own `managerScopeId` therefore
 * cannot widen (or narrow) what it sees.
 */
export const managerScopeField = { managerScopeId: z.string().uuid().optional() };

export interface ManagerScoped {
  managerScopeId?: string;
}

/**
 * Merges the request's query string with the caller's real scope, session value last
 * so it always wins. An admin has no scope, which clobbers any supplied value with
 * `undefined` and leaves the query network-wide.
 */
export function scopedQuery<T>(query: unknown, managerScopeId: string | undefined): T {
  return { ...(query as object), managerScopeId } as T;
}
