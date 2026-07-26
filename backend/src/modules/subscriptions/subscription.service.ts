import { NotFoundError, ValidationError } from '../../common/errors';
import { advertiserNames } from '../../common/entity-names';
import { advertiserRepository } from '../advertisers/advertiser.repository';
import { subscriptionRepository } from './subscription.repository';
import { SubscriptionStatus } from './subscription.entity';
import {
  toSubscriptionDto,
  type CreateSubscriptionDto,
  type SubscriptionDto,
  type SubscriptionFiltersDto,
  type UpdateSubscriptionDto,
} from './subscription.dto';

function parseDate(value: string, field: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(`${field} must be a valid date`);
  }
  return date;
}

export const subscriptionService = {
  async getSubscriptions(filters: SubscriptionFiltersDto): Promise<SubscriptionDto[]> {
    const rows = await subscriptionRepository.findAll(filters);
    const names = await advertiserNames(rows.map((r) => r.advertiserId));
    return rows.map((row) => toSubscriptionDto(row, names.get(row.advertiserId) ?? null));
  },

  async getSubscription(id: string): Promise<SubscriptionDto> {
    const subscription = await subscriptionRepository.findById(id);
    if (!subscription) {
      throw new NotFoundError('Subscription not found');
    }
    const names = await advertiserNames([subscription.advertiserId]);
    return toSubscriptionDto(subscription, names.get(subscription.advertiserId) ?? null);
  },

  async createSubscription(dto: CreateSubscriptionDto): Promise<SubscriptionDto> {
    if (!(await advertiserRepository.findById(dto.advertiserId))) {
      throw new ValidationError('Advertiser not found');
    }
    const created = await subscriptionRepository.create({
      advertiserId: dto.advertiserId,
      plan: dto.plan,
      status: dto.status,
      billingCycle: dto.billingCycle,
      amount: dto.amount.toFixed(2),
      currency: dto.currency.toUpperCase(),
      startedAt: parseDate(dto.startedAt, 'startedAt'),
      renewsAt: dto.renewsAt ? parseDate(dto.renewsAt, 'renewsAt') : null,
      notes: dto.notes ?? null,
    });
    return this.getSubscription(created.id);
  },

  async updateSubscription(id: string, dto: UpdateSubscriptionDto): Promise<SubscriptionDto> {
    const subscription = await subscriptionRepository.findById(id);
    if (!subscription) {
      throw new NotFoundError('Subscription not found');
    }

    // cancelledAt is stamped on the transition into CANCELLED so the record shows when
    // it actually ended, not when the row was last touched.
    const becomingCancelled = dto.status === SubscriptionStatus.CANCELLED && subscription.status !== SubscriptionStatus.CANCELLED;

    await subscriptionRepository.update(id, {
      ...(dto.plan !== undefined && { plan: dto.plan }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.billingCycle !== undefined && { billingCycle: dto.billingCycle }),
      ...(dto.amount !== undefined && { amount: dto.amount.toFixed(2) }),
      ...(dto.currency !== undefined && { currency: dto.currency.toUpperCase() }),
      ...(dto.startedAt !== undefined && { startedAt: parseDate(dto.startedAt, 'startedAt') }),
      ...(dto.renewsAt !== undefined && { renewsAt: dto.renewsAt ? parseDate(dto.renewsAt, 'renewsAt') : null }),
      ...(dto.notes !== undefined && { notes: dto.notes ?? null }),
      ...(becomingCancelled && { cancelledAt: new Date() }),
    });
    return this.getSubscription(id);
  },
};
