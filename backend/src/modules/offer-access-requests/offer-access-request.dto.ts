import { z } from 'zod';
import { AccessRequestStatus, type OfferAccessRequest } from './offer-access-request.entity';

export const accessRequestFiltersSchema = z.object({
  status: z.nativeEnum(AccessRequestStatus).optional(),
  offerId: z.string().uuid().optional(),
  affiliateId: z.string().uuid().optional(),
});

export type AccessRequestFiltersDto = z.infer<typeof accessRequestFiltersSchema>;

// Affiliate-initiated. The affiliate is resolved from the JWT, never the payload.
export const createAccessRequestSchema = z.object({
  offerId: z.string().uuid(),
  affiliateNote: z.string().trim().max(1000).optional(),
});

export type CreateAccessRequestDto = z.infer<typeof createAccessRequestSchema>;

export const decideAccessRequestSchema = z.object({
  status: z.enum([AccessRequestStatus.APPROVED, AccessRequestStatus.REJECTED]),
  decisionNote: z.string().trim().max(1000).optional(),
});

export type DecideAccessRequestDto = z.infer<typeof decideAccessRequestSchema>;

export interface AccessRequestDto {
  id: string;
  offerId: string;
  offerName: string | null;
  affiliateId: string;
  affiliateName: string | null;
  affiliateEmail: string | null;
  status: AccessRequestStatus;
  affiliateNote: string | null;
  decisionNote: string | null;
  decidedAt: string | null;
  createdAt: string;
}

// Offer/affiliate names are denormalized in by the service (batched lookups) so the
// approvals table renders without the client fanning out to two more endpoints.
export function toAccessRequestDto(
  request: OfferAccessRequest,
  context: { offerName?: string | null; affiliateName?: string | null; affiliateEmail?: string | null } = {},
): AccessRequestDto {
  return {
    id: request.id,
    offerId: request.offerId,
    offerName: context.offerName ?? null,
    affiliateId: request.affiliateId,
    affiliateName: context.affiliateName ?? null,
    affiliateEmail: context.affiliateEmail ?? null,
    status: request.status,
    affiliateNote: request.affiliateNote,
    decisionNote: request.decisionNote,
    decidedAt: request.decidedAt?.toISOString() ?? null,
    createdAt: request.createdAt.toISOString(),
  };
}
