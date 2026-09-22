import { z } from 'zod';
import { paginationSchema } from '../../common/pagination';
import { managerScopeField } from '../../common/manager-scope-sql';
import { ConversionStatus, type Conversion } from './conversion.entity';

export const conversionFiltersSchema = paginationSchema.extend({
  offerId: z.string().uuid().optional(),
  affiliateId: z.string().uuid().optional(),
  // "What did this one click produce" — the Click logs drawer asks this before offering
  // to add a conversion, so it can show the existing one instead.
  clickId: z.string().uuid().optional(),
  status: z.nativeEnum(ConversionStatus).optional(),
  countryCode: z.string().max(2).optional(),
  subId1: z.string().optional(),
  isDuplicate: z.coerce.boolean().optional(),
  isOrphan: z.coerce.boolean().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  // Server-set from the session, never trusted from the query string (issue #5).
  ...managerScopeField,
});

export type ConversionFiltersDto = z.infer<typeof conversionFiltersSchema>;

// Admins move conversions between states by hand when reviewing held/suspect traffic.
// PAID is deliberately not settable here — that transition only happens through a
// payout batch, so a stray click can't mark money as sent.
export const updateConversionStatusSchema = z.object({
  status: z.enum([
    ConversionStatus.PENDING,
    ConversionStatus.APPROVED,
    ConversionStatus.REJECTED,
    ConversionStatus.DUPLICATE,
    ConversionStatus.CHARGEBACK,
  ]),
});

export type UpdateConversionStatusDto = z.infer<typeof updateConversionStatusSchema>;

/**
 * An admin recording a conversion the advertiser never posted back.
 *
 * Carries the sale amount, and no status. The amount is required for the same reason it
 * is required on `/postback`: it is the *base* the offer's rate is applied to, and a
 * percentage rule or a smart-link revenue share priced without it falls back to the
 * offer's one configured revenue figure — so a hand-added conversion would be priced
 * differently from every posted-back sibling on the same offer, silently.
 *
 * The narrowed money-integrity rule (PLAN-backend.md) still holds: the admin supplies
 * how large the sale was, never what the affiliate keeps. The rate stays the rule's, and
 * `status` is still not accepted here — the offer's own hold and auto-approve settings
 * decide it, because an admin adding a conversion is already working around normal
 * tracking and should not also be choosing whether it is approved.
 */
export const createConversionSchema = z.object({
  // The click's uuid or its short refId — whichever the caller has. The drawer sends
  // the uuid; a human pasting the number an advertiser quoted sends the refId.
  clickId: z.string().min(1).max(255),
  // The advertiser's own order/sale reference, when there is one to record.
  transactionId: z.string().max(255).optional(),
  /**
   * The sale's revenue — what the advertiser is paying for this conversion, in the
   * offer's currency. Not the affiliate's payout.
   *
   * Positive, not merely non-negative: zero would be accepted by the pricing as "nothing
   * reported" and quietly fall back to the rule, which is exactly the inconsistency this
   * field exists to remove. Capped to what `numeric(12,2)` holds.
   */
  reportedRevenue: z.coerce.number().finite().positive().max(9_999_999_999.99),
});

export type CreateConversionDto = z.infer<typeof createConversionSchema>;

export interface ConversionDto {
  id: string;
  /** The conversion's own short number — what a dispute quotes. */
  refId: number;
  clickId: string | null;
  /** The click's short number: what the advertiser was given and posted back. */
  clickRefId: number | null;
  offerId: string;
  offerName: string | null;
  affiliateId: string | null;
  affiliateName: string | null;
  revenueAmount: number;
  payoutAmount: number;
  profitAmount: number;
  /**
   * What the advertiser reported on the postback, when they sent an amount at all.
   *
   * Null means nothing was reported, so this conversion was priced from the offer's
   * configured revenue — not that a zero-value sale came in. Worth reading next to
   * `revenueAmount`: when they differ, the report was not what priced the row.
   *
   * Admin-only, like `revenueAmount` and `profitAmount` around it.
   */
  reportedRevenue: number | null;
  currency: string;
  status: ConversionStatus;
  isDuplicate: boolean;
  isOrphan: boolean;
  leadRiskScore: number;
  ctitMs: number | null;
  subId1: string | null;
  subId2: string | null;
  subId3: string | null;
  subId4: string | null;
  subId5: string | null;
  subId6: string | null;
  subId7: string | null;
  subId8: string | null;
  countryCode: string | null;
  transactionId: string | null;
  approvedAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

// Affiliate-facing filters. No status-agnostic escape hatch and no affiliateId — the
// affiliate is always resolved from the JWT.
export const ownConversionFiltersSchema = paginationSchema.extend({
  offerId: z.string().uuid().optional(),
  status: z.nativeEnum(ConversionStatus).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export type OwnConversionFiltersDto = z.infer<typeof ownConversionFiltersSchema>;

/**
 * Affiliate-facing conversion.
 *
 * A structurally separate type, not a zeroed ConversionDto: there is no revenue or
 * profit field to leak, so a later addition to the admin DTO cannot reach the
 * affiliate portal by accident. `leadRiskScore` and `isDuplicate` are also dropped —
 * internal fraud scoring is not something to hand to the traffic source.
 */
export interface OwnConversionDto {
  id: string;
  /** The conversion's own short number — what a payout query quotes. */
  refId: number;
  clickId: string | null;
  /** The click's short number: what the advertiser was given and posted back. */
  clickRefId: number | null;
  offerId: string;
  offerName: string | null;
  payoutAmount: number;
  currency: string;
  status: ConversionStatus;
  subId1: string | null;
  subId2: string | null;
  subId3: string | null;
  subId4: string | null;
  subId5: string | null;
  subId6: string | null;
  subId7: string | null;
  subId8: string | null;
  countryCode: string | null;
  approvedAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

export function toOwnConversionDto(
  conversion: Conversion,
  offerName: string | null,
  clickRefId: number | null,
): OwnConversionDto {
  return {
    id: conversion.id,
    refId: conversion.refId,
    clickId: conversion.clickId,
    clickRefId,
    offerId: conversion.offerId,
    offerName,
    payoutAmount: Number(conversion.payoutAmount),
    currency: conversion.currency,
    status: conversion.status,
    subId1: conversion.subId1,
    subId2: conversion.subId2,
    subId3: conversion.subId3,
    subId4: conversion.subId4,
    subId5: conversion.subId5,
    subId6: conversion.subId6,
    subId7: conversion.subId7,
    subId8: conversion.subId8,
    countryCode: conversion.countryCode,
    approvedAt: conversion.approvedAt?.toISOString() ?? null,
    paidAt: conversion.paidAt?.toISOString() ?? null,
    createdAt: conversion.createdAt.toISOString(),
  };
}

// Profit is derived on read, never stored — a stored profit column could drift from
// revenue/payout after any correction (money integrity rule, PLAN-backend.md).
export function toConversionDto(
  conversion: Conversion,
  context: { offerName?: string | null; affiliateName?: string | null; clickRefId?: number | null } = {},
): ConversionDto {
  const revenueAmount = Number(conversion.revenueAmount);
  const payoutAmount = Number(conversion.payoutAmount);
  return {
    id: conversion.id,
    refId: conversion.refId,
    clickId: conversion.clickId,
    clickRefId: context.clickRefId ?? null,
    offerId: conversion.offerId,
    offerName: context.offerName ?? null,
    affiliateId: conversion.affiliateId,
    affiliateName: context.affiliateName ?? null,
    revenueAmount,
    payoutAmount,
    profitAmount: Number((revenueAmount - payoutAmount).toFixed(2)),
    // Null stays null rather than becoming 0 — "nothing reported" and "a sale reported
    // as worth nothing" are different facts, and only one of them is worth a second look.
    reportedRevenue: conversion.reportedRevenue != null ? Number(conversion.reportedRevenue) : null,
    currency: conversion.currency,
    status: conversion.status,
    isDuplicate: conversion.isDuplicate,
    isOrphan: conversion.isOrphan,
    leadRiskScore: conversion.leadRiskScore,
    ctitMs: conversion.ctitMs,
    subId1: conversion.subId1,
    subId2: conversion.subId2,
    subId3: conversion.subId3,
    subId4: conversion.subId4,
    subId5: conversion.subId5,
    subId6: conversion.subId6,
    subId7: conversion.subId7,
    subId8: conversion.subId8,
    countryCode: conversion.countryCode,
    transactionId: conversion.transactionId,
    approvedAt: conversion.approvedAt?.toISOString() ?? null,
    paidAt: conversion.paidAt?.toISOString() ?? null,
    createdAt: conversion.createdAt.toISOString(),
  };
}
