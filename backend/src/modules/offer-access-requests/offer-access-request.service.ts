import { In } from 'typeorm';
import { AppDataSource } from '../../infra/database/data-source';
import { NotFoundError, ValidationError } from '../../common/errors';
import { Offer } from '../offers/offer.entity';
import { affiliateRepository } from '../affiliates/affiliate.repository';
import { notificationService } from '../notifications/notification.service';
import { NotificationCategory, NotificationLevel } from '../notifications/notification.entity';
import { offerAccessRequestRepository } from './offer-access-request.repository';
import { AccessRequestStatus, type OfferAccessRequest } from './offer-access-request.entity';
import {
  toAccessRequestDto,
  type AccessRequestDto,
  type AccessRequestFiltersDto,
  type CreateAccessRequestDto,
  type DecideAccessRequestDto,
} from './offer-access-request.dto';

// Both the fresh-request and re-request paths announce the same thing, so they share
// one helper rather than each building the copy.
function notifyNetworkOfRequest(affiliateName: string | null, offerName: string): void {
  notificationService.safeNotify(
    notificationService.notifyNetwork({
      level: NotificationLevel.INFO,
      category: NotificationCategory.OFFER,
      title: 'New offer access request',
      body: `${affiliateName ?? 'An affiliate'} requested access to ${offerName}.`,
      link: '/offers/access-requests',
    }),
  );
}

// Two batched lookups for the whole page rather than a pair per row.
async function decorate(requests: OfferAccessRequest[]): Promise<AccessRequestDto[]> {
  if (requests.length === 0) return [];

  const offerIds = [...new Set(requests.map((r) => r.offerId))];
  const affiliateIds = [...new Set(requests.map((r) => r.affiliateId))];

  const [offers, affiliates] = await Promise.all([
    AppDataSource.getRepository(Offer).find({ where: { id: In(offerIds) }, select: ['id', 'name'] }),
    affiliateRepository.findByIds(affiliateIds),
  ]);

  const offerNames = new Map(offers.map((o) => [o.id, o.name]));
  const affiliateById = new Map(affiliates.map((a) => [a.id, a]));

  return requests.map((request) =>
    toAccessRequestDto(request, {
      offerName: offerNames.get(request.offerId) ?? null,
      affiliateName: affiliateById.get(request.affiliateId)?.fullName ?? null,
      affiliateEmail: affiliateById.get(request.affiliateId)?.user?.email ?? null,
    }),
  );
}

export const offerAccessRequestService = {
  async getRequests(filters: AccessRequestFiltersDto): Promise<AccessRequestDto[]> {
    return decorate(await offerAccessRequestRepository.findAll(filters));
  },

  async getOwnRequests(userId: string): Promise<AccessRequestDto[]> {
    const affiliate = await affiliateRepository.findByUserId(userId);
    if (!affiliate) {
      throw new NotFoundError('Affiliate profile not found');
    }
    return decorate(await offerAccessRequestRepository.findAll({ affiliateId: affiliate.id }));
  },

  // Re-requesting after a rejection reuses the existing row (the offer/affiliate pair
  // is unique) and resets it to PENDING, rather than failing on the constraint.
  async createRequest(userId: string, dto: CreateAccessRequestDto): Promise<AccessRequestDto> {
    const affiliate = await affiliateRepository.findByUserId(userId);
    if (!affiliate) {
      throw new NotFoundError('Affiliate profile not found');
    }
    const offer = await AppDataSource.getRepository(Offer).findOne({ where: { id: dto.offerId } });
    if (!offer) {
      throw new NotFoundError('Offer not found');
    }

    const existing = await offerAccessRequestRepository.findByPair(dto.offerId, affiliate.id);
    if (existing) {
      if (existing.status === AccessRequestStatus.PENDING) {
        throw new ValidationError('You already have a pending request for this offer');
      }
      if (existing.status === AccessRequestStatus.APPROVED) {
        throw new ValidationError('You already have access to this offer');
      }
      await offerAccessRequestRepository.update(existing.id, {
        status: AccessRequestStatus.PENDING,
        affiliateNote: dto.affiliateNote ?? null,
        decisionNote: null,
        decidedByUserId: null,
        decidedAt: null,
      });
      const refreshed = await offerAccessRequestRepository.findById(existing.id);
      notifyNetworkOfRequest(affiliate.fullName, offer.name);
      return (await decorate([refreshed!]))[0]!;
    }

    const created = await offerAccessRequestRepository.save({
      offerId: dto.offerId,
      affiliateId: affiliate.id,
      status: AccessRequestStatus.PENDING,
      affiliateNote: dto.affiliateNote ?? null,
    });
    notifyNetworkOfRequest(affiliate.fullName, offer.name);
    return (await decorate([created]))[0]!;
  },

  async decide(id: string, dto: DecideAccessRequestDto, adminUserId: string): Promise<AccessRequestDto> {
    const request = await offerAccessRequestRepository.findById(id);
    if (!request) {
      throw new NotFoundError('Access request not found');
    }
    await offerAccessRequestRepository.update(id, {
      status: dto.status,
      decisionNote: dto.decisionNote ?? null,
      decidedByUserId: adminUserId,
      decidedAt: new Date(),
    });
    const updated = await offerAccessRequestRepository.findById(id);

    // The affiliate asked a question and this is the answer — the one notification
    // they are actively waiting on.
    const offer = await AppDataSource.getRepository(Offer).findOne({ where: { id: request.offerId } });
    const approved = dto.status === AccessRequestStatus.APPROVED;
    notificationService.safeNotify(
      notificationService.notifyAffiliate(request.affiliateId, {
        level: approved ? NotificationLevel.SUCCESS : NotificationLevel.WARNING,
        category: NotificationCategory.OFFER,
        title: approved ? 'Offer access approved' : 'Offer access declined',
        body: approved
          ? `You can now run ${offer?.name ?? 'the requested offer'}.`
          : `Your request for ${offer?.name ?? 'the offer'} was declined.${dto.decisionNote ? ` ${dto.decisionNote}` : ''}`,
        link: '/offers/browse',
      }),
    );

    return (await decorate([updated!]))[0]!;
  },
};
