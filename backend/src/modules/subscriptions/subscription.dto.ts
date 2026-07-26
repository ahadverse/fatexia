import { z } from 'zod';
import { BillingCycle, SubscriptionPlan, SubscriptionStatus, type Subscription } from './subscription.entity';

export const subscriptionFiltersSchema = z.object({
  advertiserId: z.string().uuid().optional(),
  status: z.nativeEnum(SubscriptionStatus).optional(),
  plan: z.nativeEnum(SubscriptionPlan).optional(),
});

export type SubscriptionFiltersDto = z.infer<typeof subscriptionFiltersSchema>;

export const createSubscriptionSchema = z.object({
  advertiserId: z.string().uuid(),
  plan: z.nativeEnum(SubscriptionPlan).default(SubscriptionPlan.STARTER),
  status: z.nativeEnum(SubscriptionStatus).default(SubscriptionStatus.TRIAL),
  billingCycle: z.nativeEnum(BillingCycle).default(BillingCycle.MONTHLY),
  amount: z.coerce.number().nonnegative(),
  currency: z.string().trim().length(3).default('USD'),
  startedAt: z.string(),
  renewsAt: z.string().optional().nullable(),
  notes: z.string().trim().max(1000).optional(),
});

export type CreateSubscriptionDto = z.infer<typeof createSubscriptionSchema>;

export const updateSubscriptionSchema = createSubscriptionSchema.omit({ advertiserId: true }).partial();

export type UpdateSubscriptionDto = z.infer<typeof updateSubscriptionSchema>;

export interface SubscriptionDto {
  id: string;
  advertiserId: string;
  advertiserName: string | null;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  amount: number;
  currency: string;
  startedAt: string;
  renewsAt: string | null;
  cancelledAt: string | null;
  notes: string | null;
  createdAt: string;
}

export function toSubscriptionDto(subscription: Subscription, advertiserName: string | null = null): SubscriptionDto {
  return {
    id: subscription.id,
    advertiserId: subscription.advertiserId,
    advertiserName,
    plan: subscription.plan,
    status: subscription.status,
    billingCycle: subscription.billingCycle,
    amount: Number(subscription.amount),
    currency: subscription.currency,
    startedAt: subscription.startedAt.toISOString(),
    renewsAt: subscription.renewsAt?.toISOString() ?? null,
    cancelledAt: subscription.cancelledAt?.toISOString() ?? null,
    notes: subscription.notes,
    createdAt: subscription.createdAt.toISOString(),
  };
}
