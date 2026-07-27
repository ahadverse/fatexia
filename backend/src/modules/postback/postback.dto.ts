import { z } from 'zod';

// GET-only, query-based — mirrors /click. transaction_id is an opaque advertiser
// reference (their own order/sale id), never an amount: money is never accepted from
// the postback payload, only recomputed from the offer's own PayoutRule (money
// integrity rule, PLAN-backend.md).
export const postbackQuerySchema = z.object({
  offerId: z.string().uuid(),
  click_id: z.string().min(1).max(255),
  secret: z.string().min(1),
  transaction_id: z.string().max(255).optional(),
});

export type PostbackQueryDto = z.infer<typeof postbackQuerySchema>;
