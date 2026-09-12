import { NotFoundError } from '../../common/errors';
import { paginate, type Paginated } from '../../common/pagination';
import { affiliateNames, offerNames } from '../../common/entity-names';
import { conversionRepository } from './conversion.repository';
import { ConversionStatus } from './conversion.entity';
import { affiliateService } from '../affiliates/affiliate.service';
import { safeSendConversionPostback } from '../postback/outbound-postback.service';
import { notificationService } from '../notifications/notification.service';
import { NotificationCategory, NotificationLevel } from '../notifications/notification.entity';
import {
  toConversionDto,
  toOwnConversionDto,
  type ConversionDto,
  type ConversionFiltersDto,
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

    const [offers, affiliates] = await Promise.all([
      offerNames(rows.map((r) => r.offerId)),
      affiliateNames(rows.flatMap((r) => (r.affiliateId ? [r.affiliateId] : []))),
    ]);

    const dtos = rows.map((row) =>
      toConversionDto(row, {
        offerName: offers.get(row.offerId) ?? null,
        affiliateName: row.affiliateId ? (affiliates.get(row.affiliateId) ?? null) : null,
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

    const offers = await offerNames(rows.map((row) => row.offerId));

    return {
      ...paginate(
        rows.map((row) => toOwnConversionDto(row, offers.get(row.offerId) ?? null)),
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
    const [offers, affiliates] = await Promise.all([
      offerNames([conversion.offerId]),
      affiliateNames(conversion.affiliateId ? [conversion.affiliateId] : []),
    ]);
    return toConversionDto(conversion, {
      offerName: offers.get(conversion.offerId) ?? null,
      affiliateName: conversion.affiliateId ? (affiliates.get(conversion.affiliateId) ?? null) : null,
    });
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
