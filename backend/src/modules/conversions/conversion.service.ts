import { NotFoundError, ValidationError } from '../../common/errors';
import { paginate, type Paginated } from '../../common/pagination';
import { affiliateNames, offerNames } from '../../common/entity-names';
import { clickRepository } from '../clicks/click.repository';
import { conversionRepository } from './conversion.repository';
import { ConversionStatus } from './conversion.entity';
import { affiliateService } from '../affiliates/affiliate.service';
import { offerRepository } from '../offers/offer.repository';
import { smartLinkRepository } from '../smart-links/smart-link.repository';
import { computeAmounts, resolvePayoutRuleForPricing } from '../offers/payout-resolution';
import { safeSendConversionPostback } from '../postback/outbound-postback.service';
import { announceConversion } from './conversion-announce';
import { notificationService } from '../notifications/notification.service';
import { NotificationCategory, NotificationLevel } from '../notifications/notification.entity';
import {
  toConversionDto,
  toOwnConversionDto,
  type ConversionDto,
  type ConversionFiltersDto,
  type CreateConversionDto,
  type OwnConversionDto,
  type OwnConversionFiltersDto,
  type UpdateConversionStatusDto,
} from './conversion.dto';

export interface ConversionListResult extends Paginated<ConversionDto> {
  totals: { count: number; revenue: number; payout: number; profit: number };
}

export interface OwnConversionListResult extends Paginated<OwnConversionDto> {
  // Payout only — no revenue or profit total, matching the row shape.
  totals: { count: number; payout: number };
}

export const conversionService = {
  async getConversions(filters: ConversionFiltersDto): Promise<ConversionListResult> {
    const [[rows, total], totalsRow] = await Promise.all([
      conversionRepository.findAll(filters),
      conversionRepository.totals(filters),
    ]);

    const [offers, affiliates, clickRefIds] = await Promise.all([
      offerNames(rows.map((r) => r.offerId)),
      affiliateNames(rows.flatMap((r) => (r.affiliateId ? [r.affiliateId] : []))),
      // The number the advertiser posted back, which is what a dispute about this
      // conversion will quote — the stored clickId is the internal uuid.
      clickRepository.refIdsByIds(rows.flatMap((r) => (r.clickId ? [r.clickId] : []))),
    ]);

    const dtos = rows.map((row) =>
      toConversionDto(row, {
        offerName: offers.get(row.offerId) ?? null,
        affiliateName: row.affiliateId ? (affiliates.get(row.affiliateId) ?? null) : null,
        clickRefId: row.clickId ? (clickRefIds.get(row.clickId) ?? null) : null,
      }),
    );

    const revenue = Number(totalsRow?.revenue ?? 0);
    const payout = Number(totalsRow?.payout ?? 0);

    return {
      ...paginate(dtos, total, filters),
      totals: {
        count: Number(totalsRow?.count ?? 0),
        revenue,
        payout,
        profit: Number((revenue - payout).toFixed(2)),
      },
    };
  },

  // Affiliate self-service. The affiliate id is resolved from the JWT and forced into
  // the filter, so a client cannot widen the scope by supplying its own.
  async getOwnConversions(userId: string, filters: OwnConversionFiltersDto): Promise<OwnConversionListResult> {
    const affiliateId = await affiliateService.resolveAffiliateId(userId);
    const scoped = { ...filters, affiliateId };

    const [[rows, total], totalsRow] = await Promise.all([
      conversionRepository.findAll(scoped),
      conversionRepository.totals(scoped),
    ]);

    const [offers, clickRefIds] = await Promise.all([
      offerNames(rows.map((row) => row.offerId)),
      clickRepository.refIdsByIds(rows.flatMap((row) => (row.clickId ? [row.clickId] : []))),
    ]);

    return {
      ...paginate(
        rows.map((row) =>
          toOwnConversionDto(row, offers.get(row.offerId) ?? null, row.clickId ? (clickRefIds.get(row.clickId) ?? null) : null),
        ),
        total,
        filters,
      ),
      totals: { count: Number(totalsRow?.count ?? 0), payout: Number(totalsRow?.payout ?? 0) },
    };
  },

  async getConversion(id: string): Promise<ConversionDto> {
    const conversion = await conversionRepository.findById(id);
    if (!conversion) {
      throw new NotFoundError('Conversion not found');
    }
    const [offers, affiliates, clickRefIds] = await Promise.all([
      offerNames([conversion.offerId]),
      affiliateNames(conversion.affiliateId ? [conversion.affiliateId] : []),
      clickRepository.refIdsByIds(conversion.clickId ? [conversion.clickId] : []),
    ]);
    return toConversionDto(conversion, {
      offerName: offers.get(conversion.offerId) ?? null,
      affiliateName: conversion.affiliateId ? (affiliates.get(conversion.affiliateId) ?? null) : null,
      clickRefId: conversion.clickId ? (clickRefIds.get(conversion.clickId) ?? null) : null,
    });
  },

  /**
   * Records a conversion an admin knows happened but no postback ever reported.
   *
   * The advertiser's tracking is the normal source of these, and it fails in ordinary
   * ways — a pixel that never fired, a postback URL configured a day late, a platform
   * outage. Until now the only fix was to ask the advertiser to re-fire, which they
   * often cannot do retroactively, leaving an affiliate unpaid for traffic that
   * genuinely converted.
   *
   * What this deliberately does NOT do is let the amount be typed in. The click names
   * the offer, the offer's payout rule prices it, and the rule's own hold/auto-approve
   * settings decide the status — the identical path postback.service.ts takes, so a
   * manual conversion is worth exactly what the same conversion would have been worth
   * had the advertiser posted it back (money integrity rule, PLAN-backend.md).
   *
   * The admin's discretion applies afterwards, through updateStatus, where it is
   * visible as a status on a row rather than baked into an amount nobody can re-derive.
   */
  async createForClick(dto: CreateConversionDto): Promise<ConversionDto> {
    // By refId or uuid, the same two identifiers a postback may carry.
    const click = await clickRepository.findByPostbackId(dto.clickId);
    if (!click) {
      throw new NotFoundError('No click found with that ID');
    }

    // One click, one conversion. The postback path records a second one as a zero-value
    // DUPLICATE because an advertiser double-firing is an accident to be logged; an
    // admin pressing this button is not an accident, so it is refused outright rather
    // than silently producing a row worth nothing.
    const existing = await conversionRepository.findByClickId(click.id);
    if (existing) {
      throw new ValidationError(`This click already has conversion #${existing.refId} (${existing.status.toLowerCase()})`);
    }

    const offer = await offerRepository.findForClick(click.offerId);
    if (!offer) {
      throw new NotFoundError('The offer this click belongs to no longer exists');
    }

    // No rule, no price. Every offer is supposed to have one (OfferForm requires it),
    // so this is the case where an offer was configured incompletely — and inventing a
    // zero-payout conversion for it would look like a successful add while quietly
    // paying the affiliate nothing.
    const rule = await resolvePayoutRuleForPricing(offer.payoutRules, click);
    if (!rule) {
      throw new ValidationError('This offer has no payout rule, so there is nothing to price the conversion from. Add a payout rule to the offer first.');
    }

    // A click that came through a smart link is priced against that link's revenue
    // share, read now rather than at click time — same as the postback path.
    const smartLink = click.smartLinkId ? await smartLinkRepository.findById(click.smartLinkId) : null;
    const revSharePercent = smartLink?.revSharePercent != null ? Number(smartLink.revSharePercent) : null;

    const { revenueAmount, payoutAmount } = computeAmounts(rule, revSharePercent);

    // The offer's own settings decide this, not the admin — a hold configured on the
    // rule exists precisely so conversions of this kind wait for review.
    const approved = !rule.holdEnabled && offer.autoApproveConversions;

    const conversion = await conversionRepository.create({
      clickId: click.id,
      offerId: offer.id,
      affiliateId: click.affiliateId,
      revenueAmount: revenueAmount.toFixed(2),
      payoutAmount: payoutAmount.toFixed(2),
      currency: offer.currency,
      status: approved ? ConversionStatus.APPROVED : ConversionStatus.PENDING,
      isDuplicate: false,
      // It has a click by construction — that is the only way to reach this method.
      isOrphan: false,
      ctitMs: Date.now() - click.createdAt.getTime(),
      subId1: click.subId1,
      subId2: click.subId2,
      subId3: click.subId3,
      subId4: click.subId4,
      subId5: click.subId5,
      subId6: click.subId6,
      subId7: click.subId7,
      subId8: click.subId8,
      countryCode: click.countryCode,
      transactionId: dto.transactionId ?? null,
      approvedAt: approved ? new Date() : null,
    });

    // Same rule as an auto-approved postback: the affiliate's own tracker hears about a
    // conversion the moment it is approved, however it was created.
    if (approved) {
      safeSendConversionPostback(conversion);
    }

    const recorded = await this.getConversion(conversion.id);
    announceConversion(recorded, 'manual');
    return recorded;
  },

  // approvedAt is stamped on the transition into APPROVED because the hold window is
  // measured from it. Moving back out of APPROVED clears it so a later re-approval
  // restarts the hold rather than inheriting a stale, already-expired timestamp.
  async updateStatus(id: string, dto: UpdateConversionStatusDto): Promise<ConversionDto> {
    const conversion = await conversionRepository.findById(id);
    if (!conversion) {
      throw new NotFoundError('Conversion not found');
    }

    const becomingApproved = dto.status === ConversionStatus.APPROVED;
    await conversionRepository.update(id, {
      status: dto.status,
      approvedAt: becomingApproved ? (conversion.approvedAt ?? new Date()) : null,
      ...(dto.status === ConversionStatus.DUPLICATE && { isDuplicate: true }),
    });

    // Only on the transition *into* APPROVED — re-saving an already-approved conversion
    // would otherwise fire the affiliate's tracker a second time for one sale.
    if (becomingApproved && conversion.status !== ConversionStatus.APPROVED) {
      safeSendConversionPostback({ ...conversion, status: ConversionStatus.APPROVED });
    }

    // Only the two decisions that change what the affiliate gets paid. PENDING and
    // DUPLICATE are internal review states and would be noise in their bell.
    if (conversion.affiliateId && (becomingApproved || dto.status === ConversionStatus.REJECTED)) {
      notificationService.safeNotify(
        notificationService.notifyAffiliate(conversion.affiliateId, {
          level: becomingApproved ? NotificationLevel.SUCCESS : NotificationLevel.WARNING,
          category: NotificationCategory.CONVERSION,
          title: becomingApproved ? 'Conversion approved' : 'Conversion rejected',
          body: becomingApproved
            ? `A conversion worth ${Number(conversion.payoutAmount).toFixed(2)} ${conversion.currency} was approved.`
            : 'A conversion was rejected after review and will not be paid.',
          link: '/reports/conversions',
        }),
      );
    }

    return this.getConversion(id);
  },
};
