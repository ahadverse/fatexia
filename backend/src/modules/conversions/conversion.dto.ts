import { z } from 'zod';
import { paginationSchema } from '../../common/pagination';
import { ConversionStatus, type Conversion } from './conversion.entity';

export const conversionFiltersSchema = paginationSchema.extend({
  offerId: z.string().uuid().optional(),
  affiliateId: z.string().uuid().optional(),
  status: z.nativeEnum(ConversionStatus).optional(),
  countryCode: z.string().max(2).optional(),
  subId1: z.string().optional(),
  isDuplicate: z.coerce.boolean().optional(),
  isOrphan: z.coerce.boolean().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
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

export interface ConversionDto {
  id: string;
  clickId: string | null;
  offerId: string;
  offerName: string | null;
  affiliateId: string | null;
  affiliateName: string | null;
  revenueAmount: number;
  payoutAmount: number;
  profitAmount: number;
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
  clickId: string | null;
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

export function toOwnConversionDto(conversion: Conversion, offerName: string | null): OwnConversionDto {
  return {
    id: conversion.id,
    clickId: conversion.clickId,
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
  context: { offerName?: string | null; affiliateName?: string | null } = {},
): ConversionDto {
  const revenueAmount = Number(conversion.revenueAmount);
  const payoutAmount = Number(conversion.payoutAmount);
  return {
    id: conversion.id,
    clickId: conversion.clickId,
    offerId: conversion.offerId,
    offerName: context.offerName ?? null,
    affiliateId: conversion.affiliateId,
    affiliateName: context.affiliateName ?? null,
    revenueAmount,
    payoutAmount,
    profitAmount: Number((revenueAmount - payoutAmount).toFixed(2)),
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
