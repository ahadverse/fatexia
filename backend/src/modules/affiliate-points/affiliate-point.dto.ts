import { z } from 'zod';
import { paginationSchema } from '../../common/pagination';
import type { AffiliatePoint } from './affiliate-point.entity';

export const pointFiltersSchema = paginationSchema.extend({
  affiliateId: z.string().uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export type PointFiltersDto = z.infer<typeof pointFiltersSchema>;

// Manual admin adjustment. `points` may be negative (a correction) but never zero —
// a zero-point row carries no information and would just noise up the ledger.
export const adjustPointsSchema = z.object({
  affiliateId: z.string().uuid(),
  points: z.number().int().refine((n) => n !== 0, 'Points must be a non-zero adjustment'),
  reason: z.string().trim().min(3).max(255),
});

export type AdjustPointsDto = z.infer<typeof adjustPointsSchema>;

export interface AffiliatePointDto {
  id: string;
  affiliateId: string;
  conversionId: string | null;
  points: number;
  reason: string;
  createdAt: string;
}

export function toAffiliatePointDto(row: AffiliatePoint): AffiliatePointDto {
  return {
    id: row.id,
    affiliateId: row.affiliateId,
    conversionId: row.conversionId,
    points: row.points,
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
  };
}

// Leaderboard row — the balance is always a live SUM over the ledger, never a stored
// mutable total (same philosophy as the money surfaces).
export interface AffiliatePointBalanceDto {
  affiliateId: string;
  affiliateName: string | null;
  email: string;
  totalPoints: number;
  entryCount: number;
}
