import { z } from 'zod';

// GET-only, query-based — mirrors /click. transaction_id is an opaque advertiser
// reference (their own order/sale id), never an amount: money is never accepted from
// the postback payload, only recomputed from the offer's own PayoutRule (money
// integrity rule, PLAN-backend.md).
export const postbackQuerySchema = z.object({
  /**
   * Optional, because a global postback is one URL for the whole catalogue and the
   * caller has no way to fill this in: an upstream tracker's own offer-id macro is
   * *their* id, not ours, so substituting it would name an offer we have never heard
   * of. When absent the offer is taken from the click, which already knows it.
   *
   * Still accepted for the per-offer URLs already handed out.
   */
  offerId: z.string().uuid().optional(),
  click_id: z.string().min(1).max(255),
  secret: z.string().min(1),
  transaction_id: z.string().max(255).optional(),
});

export type PostbackQueryDto = z.infer<typeof postbackQuerySchema>;
