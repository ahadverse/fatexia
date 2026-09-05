import { AppDataSource } from '../../infra/database/data-source';
import { NotFoundError, ValidationError } from '../../common/errors';
import { env } from '../../common/env';
import { signAccessToken, signRefreshToken } from '../../common/jwt';
import { nextPublicId } from '../../common/public-id';
import { managerService } from '../managers/manager.service';
import type { AffiliateManagerContactDto } from '../managers/manager.dto';
import { User, UserRole, UserStatus } from '../users/user.entity';
import { userProvisioningService } from '../users/user-provisioning.service';
import { loginLogService } from '../login-logs/login-log.service';
import { notificationService } from '../notifications/notification.service';
import { NotificationCategory, NotificationLevel } from '../notifications/notification.entity';
import { sendTemplateEmail, safeSendEmail } from '../../infra/email/brevo-mailer';
import { EmailTemplateKey } from '../email-templates/email-template.entity';
import { Affiliate } from './affiliate.entity';
import { affiliateRepository } from './affiliate.repository';
import { generateReferralCode } from './referral-code';
import {
  toAffiliateDto,
  type AffiliateDto,
  type AffiliateFiltersDto,
  type CreateAffiliateDto,
  type UpdateAffiliateDto,
  type UpdateAffiliateStatusDto,
  type UpdateOwnProfileDto,
} from './affiliate.dto';

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

// Every decision an affiliate can be told about now has a template behind it
// (issue #1 — rejection used to be an in-app notification only, so an applicant who
// never logged back in simply never heard back).
const STATUS_EMAIL: Partial<Record<UserStatus, EmailTemplateKey>> = {
  [UserStatus.ACTIVE]: EmailTemplateKey.AFFILIATE_APPROVED,
  [UserStatus.REJECTED]: EmailTemplateKey.AFFILIATE_REJECTED,
  [UserStatus.BLOCKED]: EmailTemplateKey.AFFILIATE_SUSPENDED,
};

/**
 * Which affiliates the caller may act on (issue #5).
 *
 * A manager id restricts every read and write to affiliates assigned to that manager;
 * `null` means admin — the whole network, including the affiliates with no manager at
 * all, who sit under the admin directly.
 */
export type AffiliateScope = string | null;

export const affiliateService = {
  async getAffiliates(filters: AffiliateFiltersDto, scope: AffiliateScope): Promise<AffiliateDto[]> {
    // The manager's own id overrides any assignedManagerId the client sent, rather
    // than being merged with it — otherwise a manager could read another manager's
    // book just by passing that manager's id as a query parameter.
    const affiliates = await affiliateRepository.findAll(scope ? { ...filters, assignedManagerId: scope } : filters);
    return affiliates.map(toAffiliateDto);
  },

  /**
   * Loads an affiliate the caller is allowed to touch.
   *
   * Out-of-scope reads NotFound rather than Forbidden on purpose: "this exists but
   * isn't yours" tells a manager how many affiliates the network has and lets them
   * probe ids, and there is nothing they can do with the distinction anyway.
   */
  async loadInScope(id: string, scope: AffiliateScope): Promise<Affiliate> {
    const affiliate = await affiliateRepository.findById(id);
    if (!affiliate || (scope !== null && affiliate.assignedManagerId !== scope)) {
      throw new NotFoundError('Affiliate not found');
    }
    return affiliate;
  },

  async getAffiliate(id: string, scope: AffiliateScope = null): Promise<AffiliateDto> {
    return toAffiliateDto(await this.loadInScope(id, scope));
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
  async createAffiliate(dto: CreateAffiliateDto, scope: AffiliateScope): Promise<AffiliateDto> {
    const existing = await AppDataSource.getRepository(User).findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ValidationError('An account with this email already exists');
    }

    // Issue #5's ownership rule, in one line: an affiliate a manager creates is that
    // manager's, full stop — they cannot hand it to a colleague, and they cannot
    // create an unassigned one that would land under the admin. An admin (scope null)
    // keeps the free choice, including "nobody", which is what "under admin directly"
    // is stored as.
    const assignedManagerId = scope ?? dto.assignedManagerId ?? null;

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
          publicId: await nextPublicId('AFF', manager),
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
          assignedManagerId,
          referredByAffiliateId: dto.referredByAffiliateId ?? null,
          referralCode: generateReferralCode(),
          payoutMethod: dto.payoutMethod ?? null,
          payoutDetails: dto.payoutDetails,
        }),
      );
      return affiliate.id;
    });

    return this.getAffiliate(affiliateId, scope);
  },

  async updateAffiliate(id: string, dto: UpdateAffiliateDto, scope: AffiliateScope): Promise<AffiliateDto> {
    await this.loadInScope(id, scope);
    if (dto.referredByAffiliateId === id) {
      throw new ValidationError('An affiliate cannot refer themselves');
    }
    // Reassigning an affiliate to a different manager is an admin decision (issue #5:
    // "admin can assign of his manager to his affiliate"). A manager editing their own
    // affiliate silently keeps the assignment rather than being able to push the
    // account onto someone else — or off their own book to dodge a cap.
    if (scope !== null && dto.assignedManagerId !== undefined && dto.assignedManagerId !== scope) {
      throw new ValidationError('Only an admin can reassign an affiliate to a different manager');
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

    return this.getAffiliate(id, scope);
  },

  // Approve/suspend/reject writes to the linked user account — the one place status
  // lives, so the login gate and the admin list can never disagree.
  async updateStatus(id: string, dto: UpdateAffiliateStatusDto, scope: AffiliateScope): Promise<AffiliateDto> {
    const affiliate = await this.loadInScope(id, scope);
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

    const templateKey = STATUS_EMAIL[dto.status];
    if (templateKey && affiliate.user?.email) {
      // The approval template addresses {manager_name} by name, which used to render
      // blank because nothing looked the manager up. Resolved here rather than in the
      // mailer so the template stays a pure substitution.
      const contact = await managerService.getContactForAffiliate(affiliate.assignedManagerId);
      safeSendEmail(
        sendTemplateEmail({
          templateKey,
          to: { email: affiliate.user.email, name: affiliate.fullName },
          macros: {
            affiliate_name: affiliate.fullName ?? 'there',
            manager_name: contact?.fullName ?? 'your account manager',
            portal_link: env.AFFILIATE_PORTAL_URL,
          },
        }),
      );
    }

    return this.getAffiliate(id, scope);
  },

  // Admin override for an applicant who never completed (or lost) the code — see
  // user.entity.ts. Does not touch `status`; approval is still a separate decision.
  async markEmailVerified(id: string, scope: AffiliateScope): Promise<AffiliateDto> {
    const affiliate = await this.loadInScope(id, scope);
    await AppDataSource.getRepository(User).update(
      { id: affiliate.userId },
      { emailVerifiedAt: new Date(), emailVerificationCode: null, emailVerificationExpiresAt: null, emailVerificationAttempts: 0 },
    );
    return this.getAffiliate(id, scope);
  },

  /**
   * The manager contact card for the signed-in affiliate's own sidebar (issue #6).
   *
   * Always resolves: an affiliate with no active manager gets the network support
   * desk, so the sidebar card looks the same for everyone (see getContactForAffiliate).
   */
  async getOwnManagerContact(userId: string): Promise<AffiliateManagerContactDto> {
    const affiliate = await affiliateRepository.findByUserId(userId);
    if (!affiliate) {
      throw new NotFoundError('Affiliate profile not found');
    }
    return managerService.getContactForAffiliate(affiliate.assignedManagerId);
  },

  /**
   * Issues a real affiliate session so an admin/manager can open the affiliate
   * portal already logged in as this affiliate — for support/debugging, not a
   * separate "view mode". Deliberately not gated on account status: previewing a
   * PENDING or BLOCKED affiliate's portal is exactly when this is most useful.
   *
   * Logged to login-logs (the same audit trail every real login uses) so
   * impersonation is never an untracked path to someone else's account.
   */
  async impersonate(
    id: string,
    admin: { id: string },
    ctx: { ip: string; userAgent: string | null },
    scope: AffiliateScope,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const affiliate = await this.loadInScope(id, scope);

    const tokens = {
      accessToken: signAccessToken({ sub: affiliate.userId, role: UserRole.AFFILIATE }),
      refreshToken: signRefreshToken({ sub: affiliate.userId }),
    };

    await loginLogService.record({
      userId: affiliate.userId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      success: true,
      reason: `Impersonated by admin/manager ${admin.id}`,
    });

    return tokens;
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
    });
    return this.getAffiliate(affiliate.id);
  },
};
