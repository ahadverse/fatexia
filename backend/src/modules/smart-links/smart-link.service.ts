import { In, type EntityManager } from 'typeorm';
import { AppDataSource } from '../../infra/database/data-source';
import { NotFoundError, ValidationError } from '../../common/errors';
import { Advertiser } from '../advertisers/advertiser.entity';
import { Offer, OfferStatus } from '../offers/offer.entity';
import { smartLinkRepository } from './smart-link.repository';
import { SmartLinkCap } from './smart-link-cap.entity';
import {
  MISSING_DESTINATION_MESSAGE,
  toAffiliateSmartLinkDto,
  toSmartLinkDto,
  type AffiliateSmartLinkDto,
  type CreateSmartLinkDto,
  type SmartLinkCapInputDto,
  type SmartLinkDto,
  type SmartLinkFiltersDto,
  type UpdateSmartLinkDto,
} from './smart-link.dto';

// An advertiser that does not exist would save cleanly and then fail the FK, so it is
// checked up front to produce a sentence rather than a constraint violation.
async function assertAdvertiserExists(advertiserId: string | null | undefined): Promise<void> {
  if (!advertiserId) return;
  const exists = await AppDataSource.getRepository(Advertiser).findOne({ where: { id: advertiserId }, select: ['id'] });
  if (!exists) {
    throw new ValidationError('That advertiser does not exist');
  }
}

function buildCapRows(manager: EntityManager, smartLinkId: string, caps: SmartLinkCapInputDto[]): SmartLinkCap[] {
  const repo = manager.getRepository(SmartLinkCap);
  return caps.map((cap) => repo.create({ smartLinkId, period: cap.period, metric: cap.metric, limit: cap.limit.toFixed(2) }));
}

// A smart-link pointing at a non-approved offer would resolve to a dead redirect at
// click time, so membership is validated against live APPROVED offers on every write.
async function assertOffersApproved(offerIds: string[]): Promise<void> {
  if (offerIds.length === 0) return;
  const offers = await AppDataSource.getRepository(Offer).find({
    where: { id: In(offerIds), status: OfferStatus.APPROVED },
    select: ['id'],
  });
  if (offers.length !== new Set(offerIds).size) {
    throw new ValidationError('Every member offer must exist and be APPROVED');
  }
}

export const smartLinkService = {
  // `affiliateId` is passed only for an affiliate caller, so their copy of every link
  // already carries their own id (see toSmartLinkDto).
  // `affiliateId` present means an affiliate is asking, and that decides two things:
  // their own id is stamped into the URL, and the staff-only fields (postback
  // credentials, internal remarks, the blocked-traffic destination) are stripped.
  // This endpoint is open to AFFILIATE, so anything left on the shape is public to
  // them — see toAffiliateSmartLinkDto.
  async getSmartLinks(filters: SmartLinkFiltersDto, affiliateId?: string): Promise<SmartLinkDto[] | AffiliateSmartLinkDto[]> {
    const links = await smartLinkRepository.findAll(filters);
    if (affiliateId) {
      return links.map((link) => toAffiliateSmartLinkDto(link, affiliateId));
    }
    return links.map((link) => toSmartLinkDto(link));
  },

  async getSmartLink(id: string): Promise<SmartLinkDto> {
    const link = await smartLinkRepository.findById(id);
    if (!link) {
      throw new NotFoundError('Smart-link not found');
    }
    return toSmartLinkDto(link);
  },

  async createSmartLink(dto: CreateSmartLinkDto): Promise<SmartLinkDto> {
    if (await smartLinkRepository.findBySlug(dto.slug)) {
      throw new ValidationError('A smart-link with this slug already exists');
    }
    await assertOffersApproved(dto.offerIds);
    await assertAdvertiserExists(dto.advertiserId);
    const created = await smartLinkRepository.create({
      name: dto.name,
      slug: dto.slug,
      description: dto.description ?? null,
      iconUrl: dto.iconUrl ?? null,
      previewLink: dto.previewLink ?? null,
      advertiserId: dto.advertiserId ?? null,
      kpi: dto.kpi ?? null,
      category: dto.category ?? null,
      trackingPlatform: dto.trackingPlatform,
      isPublic: dto.isPublic,
      trafficTypes: dto.trafficTypes,
      disallowedTrafficTypes: dto.disallowedTrafficTypes,
      featured: dto.featured,
      networkOfferId: dto.networkOfferId ?? null,
      // `?? null` rather than `?? false`: null is "follow the network setting", which
      // is a different instruction from "never auto-approve".
      autoApproveConversions: dto.autoApproveConversions ?? null,
      allowDeepLinking: dto.allowDeepLinking,
      remarksForAdmin: dto.remarksForAdmin ?? null,
      remarksForAffiliateManager: dto.remarksForAffiliateManager ?? null,
      postbackSecret: dto.postbackSecret ?? null,
      allowedPostbackIps: dto.allowedPostbackIps ?? null,
      blockedRedirectUrl: dto.blockedRedirectUrl ?? null,
      offerIds: dto.offerIds,
      countries: dto.countries,
      devices: dto.devices,
      rotation: dto.rotation,
      status: dto.status,
      fallbackUrl: dto.fallbackUrl ?? null,
      destinationUrl: dto.destinationUrl ?? null,
      revSharePercent: dto.revSharePercent != null ? dto.revSharePercent.toFixed(2) : null,
    });
    if (dto.caps.length > 0) {
      await AppDataSource.getRepository(SmartLinkCap).save(buildCapRows(AppDataSource.manager, created.id, dto.caps));
    }
    return this.getSmartLink(created.id);
  },

  async updateSmartLink(id: string, dto: UpdateSmartLinkDto): Promise<SmartLinkDto> {
    const link = await smartLinkRepository.findById(id);
    if (!link) {
      throw new NotFoundError('Smart-link not found');
    }
    if (dto.slug && dto.slug !== link.slug && (await smartLinkRepository.findBySlug(dto.slug))) {
      throw new ValidationError('A smart-link with this slug already exists');
    }
    if (dto.offerIds) {
      await assertOffersApproved(dto.offerIds);
    }
    await assertAdvertiserExists(dto.advertiserId);
    // Against the merged row, not the patch. Clearing the destination on a link that
    // already has no members, or removing the last member from one that has no
    // destination, each arrive here as a patch that looks harmless on its own.
    const mergedOfferIds = dto.offerIds ?? link.offerIds ?? [];
    const mergedDestination = dto.destinationUrl !== undefined ? dto.destinationUrl : link.destinationUrl;
    if (mergedOfferIds.length === 0 && !mergedDestination) {
      throw new ValidationError(MISSING_DESTINATION_MESSAGE);
    }
    await smartLinkRepository.update(id, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.slug !== undefined && { slug: dto.slug }),
      ...(dto.description !== undefined && { description: dto.description ?? null }),
      ...(dto.iconUrl !== undefined && { iconUrl: dto.iconUrl ?? null }),
      ...(dto.previewLink !== undefined && { previewLink: dto.previewLink ?? null }),
      ...(dto.offerIds !== undefined && { offerIds: dto.offerIds }),
      ...(dto.countries !== undefined && { countries: dto.countries }),
      ...(dto.devices !== undefined && { devices: dto.devices }),
      ...(dto.rotation !== undefined && { rotation: dto.rotation }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.fallbackUrl !== undefined && { fallbackUrl: dto.fallbackUrl ?? null }),
      ...(dto.destinationUrl !== undefined && { destinationUrl: dto.destinationUrl ?? null }),
      ...(dto.revSharePercent !== undefined && {
        revSharePercent: dto.revSharePercent != null ? dto.revSharePercent.toFixed(2) : null,
      }),
      ...(dto.advertiserId !== undefined && { advertiserId: dto.advertiserId ?? null }),
      ...(dto.kpi !== undefined && { kpi: dto.kpi ?? null }),
      ...(dto.category !== undefined && { category: dto.category ?? null }),
      ...(dto.trackingPlatform !== undefined && { trackingPlatform: dto.trackingPlatform }),
      ...(dto.isPublic !== undefined && { isPublic: dto.isPublic }),
      ...(dto.trafficTypes !== undefined && { trafficTypes: dto.trafficTypes }),
      ...(dto.disallowedTrafficTypes !== undefined && { disallowedTrafficTypes: dto.disallowedTrafficTypes }),
      ...(dto.featured !== undefined && { featured: dto.featured }),
      ...(dto.networkOfferId !== undefined && { networkOfferId: dto.networkOfferId ?? null }),
      ...(dto.autoApproveConversions !== undefined && { autoApproveConversions: dto.autoApproveConversions ?? null }),
      ...(dto.allowDeepLinking !== undefined && { allowDeepLinking: dto.allowDeepLinking }),
      ...(dto.remarksForAdmin !== undefined && { remarksForAdmin: dto.remarksForAdmin ?? null }),
      ...(dto.remarksForAffiliateManager !== undefined && {
        remarksForAffiliateManager: dto.remarksForAffiliateManager ?? null,
      }),
      ...(dto.postbackSecret !== undefined && { postbackSecret: dto.postbackSecret ?? null }),
      ...(dto.allowedPostbackIps !== undefined && { allowedPostbackIps: dto.allowedPostbackIps ?? null }),
      ...(dto.blockedRedirectUrl !== undefined && { blockedRedirectUrl: dto.blockedRedirectUrl ?? null }),
    });
    // Replaced wholesale, the same way updateOffer replaces an offer's. Only when the
    // patch mentions them — `undefined` here means "unchanged", and deleting every cap
    // because a partial update did not name them would be a silent loss.
    if (dto.caps !== undefined) {
      await AppDataSource.getRepository(SmartLinkCap).delete({ smartLinkId: id });
      if (dto.caps.length > 0) {
        await AppDataSource.getRepository(SmartLinkCap).save(buildCapRows(AppDataSource.manager, id, dto.caps));
      }
    }
    return this.getSmartLink(id);
  },

  async deleteSmartLink(id: string): Promise<void> {
    const link = await smartLinkRepository.findById(id);
    if (!link) {
      throw new NotFoundError('Smart-link not found');
    }
    await smartLinkRepository.delete(id);
  },
};
