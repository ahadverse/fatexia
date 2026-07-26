import type { DataSource } from 'typeorm';
import { hashPassword } from '../../../common/password';
import { User, UserRole, UserStatus } from '../../../modules/users/user.entity';
import { Affiliate } from '../../../modules/affiliates/affiliate.entity';
import { AffiliateGroup } from '../../../modules/affiliate-groups/affiliate-group.entity';
import { Manager } from '../../../modules/managers/manager.entity';
import { Advertiser } from '../../../modules/advertisers/advertiser.entity';
import { OfferCategory } from '../../../modules/offer-categories/offer-category.entity';
import { Offer } from '../../../modules/offers/offer.entity';
import { PayoutRule } from '../../../modules/offers/payout-rule.entity';
import { OfferCap } from '../../../modules/offers/offer-cap.entity';
import { OfferAccessRequest, AccessRequestStatus } from '../../../modules/offer-access-requests/offer-access-request.entity';
import { SmartLink, SmartLinkRotation, SmartLinkStatus } from '../../../modules/smart-links/smart-link.entity';
import { ids } from './ids';
import { daysAgo } from './random';
import {
  ADMIN_EMAIL,
  ADVERTISERS,
  AFFILIATES,
  AFFILIATE_GROUPS,
  CAP_PERIOD,
  CATEGORY_NAMES,
  DEFAULT_TRACKING_PLATFORM,
  MANAGERS,
  OFFERS,
  PAYOUT_TYPE,
  SAMPLE_OFFER_NAME,
  SEED_PASSWORD,
  SMART_LINKS,
} from './fixtures';

/**
 * Accounts, offers and their targeting structures.
 *
 * Returns the id maps the traffic and content steps need, so those steps never have to
 * re-derive an id from a name and risk drifting out of sync with what was written here.
 */
export interface CoreSeedResult {
  managerIdByEmail: Map<string, string>;
  affiliateIdByEmail: Map<string, string>;
  advertiserIdByName: Map<string, string>;
  offerIdByName: Map<string, string>;
  adminUserId: string;
  activeAffiliateIds: string[];
  approvedOfferIds: string[];
}

export async function seedCore(dataSource: DataSource): Promise<CoreSeedResult> {
  const userRepo = dataSource.getRepository(User);
  const managerRepo = dataSource.getRepository(Manager);
  const affiliateRepo = dataSource.getRepository(Affiliate);
  const passwordHash = await hashPassword(SEED_PASSWORD);

  const adminUserId = ids.user(ADMIN_EMAIL);
  await userRepo.save(
    userRepo.create({
      id: adminUserId,
      email: ADMIN_EMAIL,
      passwordHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      lastLogin: daysAgo(0),
    }),
  );

  const managerIdByEmail = new Map<string, string>();
  for (const fixture of MANAGERS) {
    const userId = ids.user(fixture.email);
    await userRepo.save(
      userRepo.create({
        id: userId,
        email: fixture.email,
        passwordHash,
        role: UserRole.MANAGER,
        status: UserStatus.ACTIVE,
        lastLogin: daysAgo(1),
      }),
    );
    const managerId = ids.manager(fixture.email);
    await managerRepo.save(
      managerRepo.create({
        id: managerId,
        userId,
        managerRole: fixture.managerRole,
        fullName: fixture.fullName,
        phone: fixture.phone,
        skype: fixture.skype,
        defaultCommissionPercent: fixture.defaultCommissionPercent,
        // Both specialist managers report to the general manager, giving the org
        // chart on the Managers pages a real shape rather than a flat list.
        reportsToId: fixture.managerRole === 'GENERAL' ? null : ids.manager(MANAGERS[0]!.email),
        notes: null,
      }),
    );
    managerIdByEmail.set(fixture.email, managerId);
  }

  // Affiliates are written in two passes: every row first, then the referral links.
  // A single pass would fail whenever a fixture references a referrer that has not
  // been inserted yet.
  const affiliateIdByEmail = new Map<string, string>();
  for (const fixture of AFFILIATES) {
    const userId = ids.user(fixture.email);
    await userRepo.save(
      userRepo.create({
        id: userId,
        email: fixture.email,
        passwordHash,
        role: UserRole.AFFILIATE,
        status: fixture.status,
        lastLogin: fixture.status === UserStatus.ACTIVE ? daysAgo(1) : null,
      }),
    );
    const affiliateId = ids.affiliate(fixture.email);
    await affiliateRepo.save(
      affiliateRepo.create({
        id: affiliateId,
        userId,
        fullName: fixture.fullName,
        country: fixture.country,
        messengerType: fixture.messengerType,
        messengerHandle: fixture.messengerHandle,
        trafficSources: fixture.trafficSources,
        verticals: fixture.verticals,
        websiteUrl: fixture.websiteUrl,
        companyName: fixture.companyName,
        phone: fixture.phone,
        monthlyVolume: fixture.monthlyVolume,
        referralSource: fixture.referralSource,
        notes: null,
        postbackUrl: `https://postback.${fixture.companyName.toLowerCase().replace(/[^a-z]+/g, '')}.example.com/cb?click_id={click_id}&payout={payout}&status={status}`,
        referralCode: fixture.referralCode,
        assignedManagerId: fixture.managerEmail ? (managerIdByEmail.get(fixture.managerEmail) ?? null) : null,
        payoutMethod: fixture.payoutMethod,
        payoutDetails: fixture.payoutDetails,
        referredByAffiliateId: null,
      }),
    );
    affiliateIdByEmail.set(fixture.email, affiliateId);
  }

  for (const fixture of AFFILIATES) {
    if (!fixture.referredByEmail) continue;
    await affiliateRepo.update(
      { id: affiliateIdByEmail.get(fixture.email)! },
      { referredByAffiliateId: affiliateIdByEmail.get(fixture.referredByEmail) ?? null },
    );
  }

  const advertiserRepo = dataSource.getRepository(Advertiser);
  const advertiserIdByName = new Map<string, string>();
  for (const fixture of ADVERTISERS) {
    const advertiserId = ids.advertiser(fixture.name);
    await advertiserRepo.save(
      advertiserRepo.create({
        id: advertiserId,
        name: fixture.name,
        status: fixture.status,
        contactName: fixture.contactName,
        contactEmail: fixture.contactEmail,
        phone: fixture.phone,
        country: fixture.country,
        websiteUrl: fixture.websiteUrl,
        accountManagerId: fixture.accountManagerEmail
          ? (managerIdByEmail.get(fixture.accountManagerEmail) ?? null)
          : null,
        notes: null,
      }),
    );
    advertiserIdByName.set(fixture.name, advertiserId);
  }

  const categoryRepo = dataSource.getRepository(OfferCategory);
  for (const name of CATEGORY_NAMES) {
    await categoryRepo.save(categoryRepo.create({ id: ids.offerCategory(name), name }));
  }

  const offerRepo = dataSource.getRepository(Offer);
  const payoutRuleRepo = dataSource.getRepository(PayoutRule);
  const capRepo = dataSource.getRepository(OfferCap);
  const offerIdByName = new Map<string, string>();
  const approvedOfferIds: string[] = [];

  for (const fixture of OFFERS) {
    const offerId = ids.offer(fixture.name);
    await offerRepo.save(
      offerRepo.create({
        id: offerId,
        advertiserId: advertiserIdByName.get(fixture.advertiserName)!,
        name: fixture.name,
        category: fixture.category,
        description: fixture.description,
        kpi: fixture.kpi,
        previewLink: `https://preview.example.com/${offerId.slice(0, 8)}`,
        defaultPayoutAmount: fixture.defaultPayoutAmount,
        currency: 'USD',
        status: fixture.status,
        trackingPlatform: DEFAULT_TRACKING_PLATFORM,
        trafficTypes: fixture.trafficTypes,
        featured: fixture.featured,
        autoApproveConversions: false,
        allowDeepLinking: fixture.category === 'E-commerce',
        remarksForAdmin: null,
        remarksForAffiliateManager: null,
        // The four activation-gate fields are only complete on activated offers, so
        // the gate in offer.service.ts is exercised by real seed rows.
        destinationUrl: `https://${fixture.advertiserName.toLowerCase().replace(/[^a-z]+/g, '')}.example.com/lp?click_id={click_id}`,
        postbackSecret: fixture.activated ? `seed-secret-${offerId.slice(0, 8)}` : null,
        allowedPostbackIps: fixture.activated ? '127.0.0.1' : null,
        postbackVerifiedAt: fixture.activated ? daysAgo(40) : null,
      }),
    );

    await payoutRuleRepo.save(
      payoutRuleRepo.create({
        id: ids.payoutRule(fixture.name),
        offerId,
        payoutMode: fixture.payoutMode,
        payoutType: PAYOUT_TYPE,
        amount: fixture.defaultPayoutAmount,
        revenueModel: fixture.revenueModel,
        revenueAmount: fixture.revenueAmount,
        targeting: {
          countries: fixture.countries,
          devices: [],
          affiliateIds: [],
          affiliateGroupIds: [],
        },
        managerCommissionPercent: 5,
        referAffiliateCommissionPercent: 3,
        holdEnabled: fixture.holdDays > 0,
        holdDays: fixture.holdDays,
        commissionPercent: 0,
      }),
    );

    await capRepo.save(
      capRepo.create({
        id: ids.offerCap(fixture.name),
        offerId,
        period: CAP_PERIOD,
        metric: fixture.capMetric,
        limit: fixture.capLimit,
      }),
    );

    offerIdByName.set(fixture.name, offerId);
    if (fixture.status === 'APPROVED') {
      approvedOfferIds.push(offerId);
    }
  }

  const groupRepo = dataSource.getRepository(AffiliateGroup);
  for (const fixture of AFFILIATE_GROUPS) {
    await groupRepo.save(
      groupRepo.create({
        id: ids.affiliateGroup(fixture.name),
        name: fixture.name,
        description: fixture.description,
        affiliateIds: fixture.memberEmails.map((email) => affiliateIdByEmail.get(email)!),
      }),
    );
  }

  const smartLinkRepo = dataSource.getRepository(SmartLink);
  for (const fixture of SMART_LINKS) {
    await smartLinkRepo.save(
      smartLinkRepo.create({
        id: ids.smartLink(fixture.slug),
        name: fixture.name,
        slug: fixture.slug,
        description: fixture.description,
        offerIds: fixture.offerNames.map((name) => offerIdByName.get(name)!),
        countries: fixture.countries,
        devices: fixture.devices,
        rotation: SmartLinkRotation.TOP_PAYOUT,
        status: SmartLinkStatus.ACTIVE,
        fallbackUrl: 'https://fatexia.example.com/thanks',
      }),
    );
  }

  // One request per decision state so Offers → Approvals / Access Requests each have
  // something real to render and act on.
  const accessRequestRepo = dataSource.getRepository(OfferAccessRequest);
  const accessRequests: Array<{
    offerName: string;
    email: string;
    status: AccessRequestStatus;
    note: string;
    decision: string | null;
  }> = [
    {
      offerName: 'Lumen Casino First Deposit',
      email: 'lucas.silva@partners.dev',
      status: AccessRequestStatus.PENDING,
      note: 'Running Brazilian push traffic, can start at 2k clicks/day.',
      decision: null,
    },
    {
      offerName: 'Lumen Sportsbook Signup',
      email: 'amara.okafor@partners.dev',
      status: AccessRequestStatus.PENDING,
      note: 'Have an existing sportsbook audience on Telegram.',
      decision: null,
    },
    {
      offerName: SAMPLE_OFFER_NAME,
      email: 'kenji.tanaka@partners.dev',
      status: AccessRequestStatus.APPROVED,
      note: 'SEO traffic on US finance keywords.',
      decision: 'Approved — traffic source verified with the advertiser.',
    },
    {
      offerName: 'Northwind Vitamin Trial',
      email: 'hana.yilmaz@partners.dev',
      status: AccessRequestStatus.REJECTED,
      note: 'Can send pop traffic at volume.',
      decision: 'Declined — advertiser does not accept pop traffic on this offer.',
    },
  ];

  for (const request of accessRequests) {
    const decided = request.status !== AccessRequestStatus.PENDING;
    await accessRequestRepo.save(
      accessRequestRepo.create({
        id: ids.accessRequest(request.offerName, request.email),
        offerId: offerIdByName.get(request.offerName)!,
        affiliateId: affiliateIdByEmail.get(request.email)!,
        status: request.status,
        affiliateNote: request.note,
        decisionNote: request.decision,
        decidedByUserId: decided ? adminUserId : null,
        decidedAt: decided ? daysAgo(6) : null,
      }),
    );
  }

  const activeAffiliateIds = AFFILIATES.filter((a) => a.status === UserStatus.ACTIVE).map(
    (a) => affiliateIdByEmail.get(a.email)!,
  );

  return {
    managerIdByEmail,
    affiliateIdByEmail,
    advertiserIdByName,
    offerIdByName,
    adminUserId,
    activeAffiliateIds,
    approvedOfferIds,
  };
}
