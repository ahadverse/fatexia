import { randomBytes } from 'node:crypto';
import { AppDataSource } from '../../infra/database/data-source';
import { NotFoundError, ValidationError } from '../../common/errors';
import { User, UserRole, UserStatus } from '../users/user.entity';
import { userProvisioningService } from '../users/user-provisioning.service';
import { notificationService } from '../notifications/notification.service';
import { NotificationCategory, NotificationLevel } from '../notifications/notification.entity';
import { Affiliate } from './affiliate.entity';
import { affiliateRepository } from './affiliate.repository';
import {
  toAffiliateDto,
  type AffiliateDto,
  type AffiliateFiltersDto,
  type CreateAffiliateDto,
  type UpdateAffiliateDto,
  type UpdateAffiliateStatusDto,
  type UpdateOwnProfileDto,
} from './affiliate.dto';

// Short, unambiguous code an affiliate shares to recruit others. Uppercase base32-ish
// alphabet with I/O/0/1 removed so a code read aloud or off a screenshot round-trips.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateReferralCode(): string {
  const bytes = randomBytes(8);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

// Which status changes are worth telling the affiliate about, and how they read from
// their side. PENDING and INACTIVE are omitted: they are intermediate administrative
// states, not decisions an affiliate can act on.
const STATUS_NOTICE: Partial<Record<UserStatus, { level: NotificationLevel; title: string; body: string }>> = {
  [UserStatus.ACTIVE]: {
    level: NotificationLevel.SUCCESS,
    title: 'Your account is approved',
    body: 'You can now browse offers, generate tracking links and start sending traffic.',
  },
  [UserStatus.REJECTED]: {
    level: NotificationLevel.WARNING,
    title: 'Your application was not approved',
    body: 'Reply to this thread in Messages if you would like to discuss the decision.',
  },
  [UserStatus.BLOCKED]: {
    level: NotificationLevel.WARNING,
    title: 'Your account has been suspended',
    body: 'Traffic is no longer being accepted. Contact your manager for details.',
  },
};

export const affiliateService = {
  async getAffiliates(filters: AffiliateFiltersDto): Promise<AffiliateDto[]> {
    const affiliates = await affiliateRepository.findAll(filters);
    return affiliates.map(toAffiliateDto);
  },

  async getAffiliate(id: string): Promise<AffiliateDto> {
    const affiliate = await affiliateRepository.findById(id);
    if (!affiliate) {
      throw new NotFoundError('Affiliate not found');
    }
    return toAffiliateDto(affiliate);
  },

  async getOwnProfile(userId: string): Promise<AffiliateDto> {
    const affiliate = await affiliateRepository.findByUserId(userId);
    if (!affiliate) {
      throw new NotFoundError('Affiliate profile not found');
    }
    return toAffiliateDto(affiliate);
  },

  // The single place every affiliate-scoped endpoint turns a JWT into an affiliate id.
  // Scoping must never come from a client-supplied parameter, so callers take the id
  // from here rather than from the request.
  async resolveAffiliateId(userId: string): Promise<string> {
    const affiliate = await affiliateRepository.findByUserId(userId);
    if (!affiliate) {
      throw new NotFoundError('Affiliate profile not found');
    }
    return affiliate.id;
  },

  // Affiliates this one referred. Payout-free by construction — it returns account
  // status and join date only, never the referred affiliate's earnings.
  async getOwnReferrals(userId: string): Promise<Array<Pick<AffiliateDto, 'id' | 'fullName' | 'country' | 'status' | 'createdAt'>>> {
    const affiliateId = await this.resolveAffiliateId(userId);
    const referred = await affiliateRepository.findAll({ referredByAffiliateId: affiliateId });
    return referred.map((affiliate) => {
      const dto = toAffiliateDto(affiliate);
      return { id: dto.id, fullName: dto.fullName, country: dto.country, status: dto.status, createdAt: dto.createdAt };
    });
  },

  // Provisions the login and the profile in one transaction — a half-created
  // affiliate (user with no profile, or vice versa) would break both portals.
  async createAffiliate(dto: CreateAffiliateDto): Promise<AffiliateDto> {
    const existing = await AppDataSource.getRepository(User).findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ValidationError('An account with this email already exists');
    }

    const affiliateId = await AppDataSource.transaction(async (manager) => {
      const user = await userProvisioningService.createUser(manager, {
        email: dto.email,
        password: dto.password,
        role: UserRole.AFFILIATE,
        status: dto.status,
      });

      const repo = manager.getRepository(Affiliate);
      const affiliate = await repo.save(
        repo.create({
          userId: user.id,
          fullName: dto.fullName,
          country: dto.country,
          messengerType: dto.messengerType ?? null,
          messengerHandle: dto.messengerHandle ?? null,
          trafficSources: dto.trafficSources,
          verticals: dto.verticals,
          websiteUrl: dto.websiteUrl ?? null,
          companyName: dto.companyName ?? null,
          phone: dto.phone ?? null,
          monthlyVolume: dto.monthlyVolume ?? null,
          referralSource: dto.referralSource ?? null,
          notes: dto.notes ?? null,
          postbackUrl: dto.postbackUrl ?? null,
          assignedManagerId: dto.assignedManagerId ?? null,
          referredByAffiliateId: dto.referredByAffiliateId ?? null,
          referralCode: generateReferralCode(),
          payoutMethod: dto.payoutMethod ?? null,
          payoutDetails: dto.payoutDetails,
        }),
      );
      return affiliate.id;
    });

    return this.getAffiliate(affiliateId);
  },

  async updateAffiliate(id: string, dto: UpdateAffiliateDto): Promise<AffiliateDto> {
    const affiliate = await affiliateRepository.findById(id);
    if (!affiliate) {
      throw new NotFoundError('Affiliate not found');
    }
    if (dto.referredByAffiliateId === id) {
      throw new ValidationError('An affiliate cannot refer themselves');
    }

    await affiliateRepository.update(id, {
      ...(dto.fullName !== undefined && { fullName: dto.fullName }),
      ...(dto.country !== undefined && { country: dto.country }),
      ...(dto.messengerType !== undefined && { messengerType: dto.messengerType }),
      ...(dto.messengerHandle !== undefined && { messengerHandle: dto.messengerHandle ?? null }),
      ...(dto.trafficSources !== undefined && { trafficSources: dto.trafficSources }),
      ...(dto.verticals !== undefined && { verticals: dto.verticals }),
      ...(dto.websiteUrl !== undefined && { websiteUrl: dto.websiteUrl ?? null }),
      ...(dto.companyName !== undefined && { companyName: dto.companyName ?? null }),
      ...(dto.phone !== undefined && { phone: dto.phone ?? null }),
      ...(dto.monthlyVolume !== undefined && { monthlyVolume: dto.monthlyVolume ?? null }),
      ...(dto.referralSource !== undefined && { referralSource: dto.referralSource ?? null }),
      ...(dto.notes !== undefined && { notes: dto.notes ?? null }),
      ...(dto.postbackUrl !== undefined && { postbackUrl: dto.postbackUrl ?? null }),
      ...(dto.assignedManagerId !== undefined && { assignedManagerId: dto.assignedManagerId ?? null }),
      ...(dto.referredByAffiliateId !== undefined && { referredByAffiliateId: dto.referredByAffiliateId ?? null }),
      ...(dto.payoutMethod !== undefined && { payoutMethod: dto.payoutMethod ?? null }),
      ...(dto.payoutDetails !== undefined && { payoutDetails: dto.payoutDetails }),
    });

    return this.getAffiliate(id);
  },

  // Approve/suspend/reject writes to the linked user account — the one place status
  // lives, so the login gate and the admin list can never disagree.
  async updateStatus(id: string, dto: UpdateAffiliateStatusDto): Promise<AffiliateDto> {
    const affiliate = await affiliateRepository.findById(id);
    if (!affiliate) {
      throw new NotFoundError('Affiliate not found');
    }
    await AppDataSource.getRepository(User).update({ id: affiliate.userId }, { status: dto.status });

    // A decision on someone's account is the clearest case for telling them. Sent
    // fire-and-forget — the status change is the business action and must not fail
    // because a notification insert did.
    const outcome = STATUS_NOTICE[dto.status];
    if (outcome) {
      notificationService.safeNotify(
        notificationService.notifyUser(affiliate.userId, {
          level: outcome.level,
          category: NotificationCategory.AFFILIATE,
          title: outcome.title,
          body: outcome.body,
          link: '/',
        }),
      );
    }

    return this.getAffiliate(id);
  },

  async updateOwnProfile(userId: string, dto: UpdateOwnProfileDto): Promise<AffiliateDto> {
    const affiliate = await affiliateRepository.findByUserId(userId);
    if (!affiliate) {
      throw new NotFoundError('Affiliate profile not found');
    }
    await affiliateRepository.update(affiliate.id, {
      ...(dto.fullName !== undefined && { fullName: dto.fullName }),
      ...(dto.country !== undefined && { country: dto.country }),
      ...(dto.messengerType !== undefined && { messengerType: dto.messengerType }),
      ...(dto.messengerHandle !== undefined && { messengerHandle: dto.messengerHandle ?? null }),
      ...(dto.websiteUrl !== undefined && { websiteUrl: dto.websiteUrl ?? null }),
      ...(dto.companyName !== undefined && { companyName: dto.companyName ?? null }),
      ...(dto.phone !== undefined && { phone: dto.phone ?? null }),
      ...(dto.postbackUrl !== undefined && { postbackUrl: dto.postbackUrl ?? null }),
      ...(dto.payoutMethod !== undefined && { payoutMethod: dto.payoutMethod ?? null }),
      ...(dto.payoutDetails !== undefined && { payoutDetails: dto.payoutDetails }),
    });
    return this.getAffiliate(affiliate.id);
  },
};
