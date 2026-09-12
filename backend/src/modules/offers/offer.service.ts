import type { EntityManager } from 'typeorm';
import { AppDataSource } from '../../infra/database/data-source';
import { NotFoundError, ValidationError } from '../../common/errors';
import { logger } from '../../common/logger';
import { Advertiser } from '../advertisers/advertiser.entity';
import { affiliateRepository } from '../affiliates/affiliate.repository';
import { offerAccessRequestRepository } from '../offer-access-requests/offer-access-request.repository';
import { AccessRequestStatus } from '../offer-access-requests/offer-access-request.entity';
import { sendTemplateEmail, safeSendEmail } from '../../infra/email/brevo-mailer';
import { EmailTemplateKey } from '../email-templates/email-template.entity';
import { offerRepository } from './offer.repository';
import { withTrackingMacros } from './destination-url';
import { Offer, OfferStatus } from './offer.entity';
import { PayoutRule } from './payout-rule.entity';
import { OfferCap } from './offer-cap.entity';
import {
  toAffiliateOfferDto,
  toOfferDto,
  affiliateTrackingLinkFor,
  type AffiliateOfferDto,
  type CreateOfferDto,
  type OfferDto,
  type OfferFiltersDto,
  type PayoutRuleInputDto,
  type OfferCapInputDto,
  type UpdateOfferDto,
  type UpdateOfferStatusDto,
} from './offer.dto';

// PENDING/PAUSED → APPROVED requires destinationUrl (with the {click_id} macro),
// postbackSecret and allowedPostbackIps — the three fields needed for the Tracker to
// send traffic and receive conversions at all.
//
// postbackVerifiedAt is deliberately NOT a precondition here, even though it exists on
// the entity. It used to be: that produced an unsatisfiable cycle, because /click (the
// only thing that ever mints a click_id) refuses to run for an offer that isn't already
// APPROVED (see click.service.ts), and a verified postback requires a real click_id —
// so no offer could ever reach APPROVED. postbackVerifiedAt is now stamped the first
// time a real, secret+IP-authenticated postback is received for the offer (see
// modules/postback/postback.service.ts) — an observational signal an admin can check
// on the offer, not a gate blocking approval.
function assertActivationGate(offer: Offer): void {
  // The macro half of this check is now belt-and-braces: withTrackingMacros() appends
  // {click_id} on every save (issue #17), so the only way to reach APPROVED without one
  // is an offer whose destination was never filled in at all.
  if (!offer.destinationUrl || !offer.destinationUrl.includes('{click_id}')) {
    throw new ValidationError(
      'destinationUrl must be set before approving this offer',
    );
  }
  if (!offer.postbackSecret) {
    throw new ValidationError('postbackSecret must be set before approving this offer');
  }
  if (!offer.allowedPostbackIps) {
    throw new ValidationError('allowedPostbackIps must be set before approving this offer');
  }
}

// Shared by createOffer and updateOffer — the two callers used to duplicate this
// construction inline (a DRY violation flagged when reviewing the reference
// project's equivalent module). Both build the exact same child-row shape.
function buildPayoutRuleRows(manager: EntityManager, offerId: string, rules: PayoutRuleInputDto[]): PayoutRule[] {
  const repo = manager.getRepository(PayoutRule);
  return rules.map((rule) =>
    repo.create({
      offerId,
      payoutMode: rule.payoutMode,
      payoutType: rule.payoutType,
      amount: rule.amount.toFixed(2),
      revenueModel: rule.revenueModel,
      revenueAmount: rule.revenueAmount.toFixed(2),
      targeting: rule.targeting,
      managerCommissionPercent: rule.managerCommissionPercent,
      referAffiliateCommissionPercent: rule.referAffiliateCommissionPercent,
      holdEnabled: rule.holdSchedule.enabled,
      holdDays: rule.holdSchedule.days,
      commissionPercent: rule.commissionPercent,
    }),
  );
}

function buildOfferCapRows(manager: EntityManager, offerId: string, caps: OfferCapInputDto[]): OfferCap[] {
  const repo = manager.getRepository(OfferCap);
  return caps.map((cap) =>
    repo.create({ offerId, period: cap.period, metric: cap.metric, limit: cap.limit.toFixed(2) }),
  );
}

async function assertAdvertiserExists(manager: EntityManager, advertiserId: string): Promise<void> {
  const advertiser = await manager.getRepository(Advertiser).findOne({ where: { id: advertiserId } });
  if (!advertiser) {
    throw new ValidationError('Advertiser not found');
  }
}

// Tells affiliates who already have (or are re-gaining) access that the offer they
// asked for can now run — not every affiliate on the network, which would spam the
// unrelated majority for a gated offer they never requested.
function notifyOfferLive(offer: Offer): void {
  safeSendEmail(
    (async () => {
      const requests = await offerAccessRequestRepository.findAll({
        offerId: offer.id,
        status: AccessRequestStatus.APPROVED,
      });
      if (requests.length === 0) return;

      const affiliates = await affiliateRepository.findByIds(requests.map((r) => r.affiliateId));
      await Promise.all(
        affiliates
          .filter((affiliate) => affiliate.user?.email)
          .map((affiliate) =>
            sendTemplateEmail({
              templateKey: EmailTemplateKey.OFFER_LIVE,
              to: { email: affiliate.user.email, name: affiliate.fullName },
              macros: {
                affiliate_name: affiliate.fullName ?? 'there',
                offer_name: offer.name,
                payout: `${offer.currency} ${offer.defaultPayoutAmount}`,
                offer_link: affiliateTrackingLinkFor(offer.id, affiliate.id),
              },
            }).catch((err) => logger.error({ err, affiliateId: affiliate.id }, 'Failed to send OFFER_LIVE email')),
          ),
      );
    })(),
  );
}

export const offerService = {
  async getOffers(filters: OfferFiltersDto): Promise<OfferDto[]> {
    const offers = await offerRepository.findAll(filters);
    return offers.map(toOfferDto);
  },

  // Affiliate offer browse — resolves the affiliate from the JWT (never a client id),
  // returns APPROVED offers, payout-only (see toAffiliateOfferDto).
  async getAvailableOffers(user: { id: string }): Promise<AffiliateOfferDto[]> {
    const affiliate = await affiliateRepository.findByUserId(user.id);
    if (!affiliate) {
      throw new NotFoundError('Affiliate profile not found');
    }
    const offers = await offerRepository.findAvailableForAffiliate(affiliate.id);
    // The caller's own affiliate id is substituted into each tracking link, so what
    // they copy is usable as-is rather than carrying an unresolved macro.
    return offers.map((offer) => toAffiliateOfferDto(offer, affiliate.id));
  },

  async getOffer(id: string): Promise<OfferDto> {
    const offer = await offerRepository.findByIdWithChildren(id);
    if (!offer) {
      throw new NotFoundError('Offer not found');
    }
    return toOfferDto(offer);
  },

  async createOffer(dto: CreateOfferDto): Promise<OfferDto> {
    return AppDataSource.transaction(async (manager) => {
      await assertAdvertiserExists(manager, dto.advertiserId);

      const offer = await manager.getRepository(Offer).save(
        manager.getRepository(Offer).create({
          advertiserId: dto.advertiserId,
          name: dto.name,
          previewLink: dto.previewLink ?? null,
          description: dto.description ?? null,
          kpi: dto.kpi ?? null,
          category: dto.category ?? null,
          iconUrl: dto.iconUrl ?? null,
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          endDate: dto.endDate ? new Date(dto.endDate) : null,
          defaultPayoutAmount: dto.defaultPayoutAmount.toFixed(2),
          currency: dto.currency,
          trackingPlatform: dto.trackingPlatform,
          isPublic: dto.isPublic,
          trafficTypes: dto.trafficTypes,
          disallowedTrafficTypes: dto.disallowedTrafficTypes ?? [],
          featured: dto.featured,
          networkOfferId: dto.networkOfferId ?? null,
          autoApproveConversions: dto.autoApproveConversions,
          allowDeepLinking: dto.allowDeepLinking,
          remarksForAdmin: dto.remarksForAdmin ?? null,
          remarksForAffiliateManager: dto.remarksForAffiliateManager ?? null,
          // Issue #17 — the {click_id}/{payout_amount} macros are appended here when
          // the form didn't carry them, so what's stored is always redirect-ready.
          destinationUrl: withTrackingMacros(dto.destinationUrl),
          fallbackUrl: dto.fallbackUrl || null,
          postbackSecret: dto.postbackSecret ?? null,
          allowedPostbackIps: dto.allowedPostbackIps ?? null,
          blockedRedirectUrl: dto.blockedRedirectUrl || null,
        }),
      );

      await manager.getRepository(PayoutRule).save(buildPayoutRuleRows(manager, offer.id, dto.payoutRules));
      await manager.getRepository(OfferCap).save(buildOfferCapRows(manager, offer.id, dto.caps));

      const created = await manager
        .getRepository(Offer)
        .findOne({ where: { id: offer.id }, relations: ['payoutRules', 'caps'] });
      return toOfferDto(created!);
    });
  },

  async updateOffer(id: string, dto: UpdateOfferDto): Promise<OfferDto> {
    const existing = await offerRepository.findByIdWithChildren(id);
    if (!existing) {
      throw new NotFoundError('Offer not found');
    }

    return AppDataSource.transaction(async (manager) => {
      await assertAdvertiserExists(manager, dto.advertiserId);

      await manager.getRepository(Offer).update(
        { id },
        {
          advertiserId: dto.advertiserId,
          name: dto.name,
          previewLink: dto.previewLink ?? null,
          description: dto.description ?? null,
          kpi: dto.kpi ?? null,
          category: dto.category ?? null,
          iconUrl: dto.iconUrl ?? null,
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          endDate: dto.endDate ? new Date(dto.endDate) : null,
          defaultPayoutAmount: dto.defaultPayoutAmount.toFixed(2),
          currency: dto.currency,
          trackingPlatform: dto.trackingPlatform,
          isPublic: dto.isPublic,
          trafficTypes: dto.trafficTypes,
          disallowedTrafficTypes: dto.disallowedTrafficTypes ?? [],
          featured: dto.featured,
          networkOfferId: dto.networkOfferId ?? null,
          autoApproveConversions: dto.autoApproveConversions,
          allowDeepLinking: dto.allowDeepLinking,
          remarksForAdmin: dto.remarksForAdmin ?? null,
          remarksForAffiliateManager: dto.remarksForAffiliateManager ?? null,
          destinationUrl: withTrackingMacros(dto.destinationUrl),
          fallbackUrl: dto.fallbackUrl || null,
          postbackSecret: dto.postbackSecret ?? null,
          allowedPostbackIps: dto.allowedPostbackIps ?? null,
          blockedRedirectUrl: dto.blockedRedirectUrl || null,
        },
      );

      // Replace children wholesale — simplest correct approach, same shape createOffer builds.
      await manager.getRepository(PayoutRule).delete({ offerId: id });
      await manager.getRepository(OfferCap).delete({ offerId: id });
      await manager.getRepository(PayoutRule).save(buildPayoutRuleRows(manager, id, dto.payoutRules));
      await manager.getRepository(OfferCap).save(buildOfferCapRows(manager, id, dto.caps));

      const updated = await manager
        .getRepository(Offer)
        .findOne({ where: { id }, relations: ['payoutRules', 'caps'] });
      return toOfferDto(updated!);
    });
  },

  async updateOfferStatus(id: string, dto: UpdateOfferStatusDto): Promise<OfferDto> {
    const offer = await offerRepository.findByIdWithChildren(id);
    if (!offer) {
      throw new NotFoundError('Offer not found');
    }

    if (dto.status === OfferStatus.APPROVED) {
      assertActivationGate(offer);
    }

    const wasApproved = offer.status === OfferStatus.APPROVED;
    const updated = await offerRepository.updateStatus(id, dto.status);

    if (dto.status === OfferStatus.APPROVED && !wasApproved) {
      notifyOfferLive(updated!);
    }

    return toOfferDto(updated!);
  },
};
