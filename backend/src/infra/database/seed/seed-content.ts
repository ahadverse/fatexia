import type { DataSource } from 'typeorm';
import { Message, MessageDirection } from '../../../modules/messages/message.entity';
import { Notification, NotificationCategory, NotificationLevel } from '../../../modules/notifications/notification.entity';
import { NewsPost, NewsAudience, NewsStatus } from '../../../modules/news/news-post.entity';
import { EmailTemplate } from '../../../modules/email-templates/email-template.entity';
import { NETWORK_SETTINGS_ID, NetworkSetting } from '../../../modules/network-settings/network-setting.entity';
import { Integration, IntegrationStatus } from '../../../modules/integrations/integration.entity';
import { Subscription, BillingCycle, SubscriptionPlan, SubscriptionStatus } from '../../../modules/subscriptions/subscription.entity';
import { EMAIL_TEMPLATES, INTEGRATIONS, NEWS_POSTS } from './fixtures';
import { ids } from './ids';
import { daysAgo } from './random';
import type { CoreSeedResult } from './seed-core';

// Messaging, announcements, platform config and advertiser subscriptions — everything
// the "Others" section of the Admin nav operates on.
export async function seedContent(dataSource: DataSource, core: CoreSeedResult): Promise<void> {
  const settingsRepo = dataSource.getRepository(NetworkSetting);
  await settingsRepo.save(
    settingsRepo.create({
      id: NETWORK_SETTINGS_ID,
      networkName: 'Fatexia',
      supportEmail: 'support@fatexia.com',
      defaultCurrency: 'USD',
      timezone: 'UTC',
      defaultHoldDays: 30,
      minimumPayoutThreshold: '50.00',
      payoutCycleDays: 30,
      autoApproveAffiliates: false,
      autoApproveConversions: false,
      pointsPerConversion: 10,
      // Seed values from PLAN-backend.md's fraud-config section.
      fraudSuspectThreshold: 30,
      fraudBlockThreshold: 70,
      loginRateLimitPerMinute: 10,
      clickRateLimitPerMinute: 600,
      smtpHost: null,
      smtpPort: 587,
      smtpUser: null,
      smtpFromEmail: 'no-reply@fatexia.com',
    }),
  );

  const integrationRepo = dataSource.getRepository(Integration);
  for (const fixture of INTEGRATIONS) {
    await integrationRepo.save(
      integrationRepo.create({
        id: ids.integration(fixture.provider),
        provider: fixture.provider,
        name: fixture.name,
        description: fixture.description,
        // Left empty on purpose: credentials are entered by an admin on the
        // Integrations page and never committed or seeded.
        apiKey: null,
        apiSecret: null,
        config: fixture.config,
        status: IntegrationStatus.NOT_CONFIGURED,
        lastCheckedAt: null,
        lastError: null,
      }),
    );
  }

  const templateRepo = dataSource.getRepository(EmailTemplate);
  for (const fixture of EMAIL_TEMPLATES) {
    await templateRepo.save(
      templateRepo.create({
        id: ids.emailTemplate(fixture.templateKey),
        templateKey: fixture.templateKey,
        name: fixture.name,
        subject: fixture.subject,
        body: fixture.body,
        availableMacros: fixture.availableMacros,
        enabled: true,
      }),
    );
  }

  const newsRepo = dataSource.getRepository(NewsPost);
  for (const fixture of NEWS_POSTS) {
    const published = fixture.publishedDaysAgo !== null;
    await newsRepo.save(
      newsRepo.create({
        id: ids.newsPost(fixture.slug),
        title: fixture.title,
        slug: fixture.slug,
        excerpt: fixture.excerpt,
        body: fixture.body,
        status: published ? NewsStatus.PUBLISHED : NewsStatus.DRAFT,
        audience: NewsAudience.ALL,
        pinned: fixture.pinned,
        authorUserId: core.adminUserId,
        publishedAt: published ? daysAgo(fixture.publishedDaysAgo!) : null,
      }),
    );
  }

  // A short two-way thread per affiliate so Affiliates → Messages opens on a real
  // conversation, including one unread inbound to drive the unread badge.
  const messageRepo = dataSource.getRepository(Message);
  const threads: Array<{ email: string; inbound: string; outbound: string; read: boolean }> = [
    {
      email: 'sofia.marino@partners.dev',
      inbound: 'Hi — we are hitting the monthly cap on Lumen First Deposit around the 20th. Any chance of raising it to 250?',
      outbound: 'Checking with the advertiser now. Provisionally yes for next month, I will confirm by Friday.',
      read: true,
    },
    {
      email: 'kenji.tanaka@partners.dev',
      inbound:
        'Conversions on Acme Personal Loan are showing in your portal but my postback URL is not receiving anything since Tuesday.',
      outbound: 'Your endpoint returned 502 on the last three attempts. Can you confirm the URL is reachable?',
      read: false,
    },
    {
      email: 'amara.okafor@partners.dev',
      inbound: 'I would like to switch from bank transfer to USDT for the next cycle.',
      outbound: 'Updated on your profile. It applies from the next batch onward.',
      read: true,
    },
  ];

  for (const [index, thread] of threads.entries()) {
    const affiliateId = core.affiliateIdByEmail.get(thread.email)!;
    await messageRepo.save(
      messageRepo.create({
        id: ids.message(`in:${index}`),
        affiliateId,
        direction: MessageDirection.INBOUND,
        body: thread.inbound,
        senderUserId: null,
        readAt: thread.read ? daysAgo(2) : null,
        createdAt: daysAgo(3),
      }),
    );
    await messageRepo.save(
      messageRepo.create({
        id: ids.message(`out:${index}`),
        affiliateId,
        direction: MessageDirection.OUTBOUND,
        body: thread.outbound,
        senderUserId: core.adminUserId,
        readAt: daysAgo(2),
        createdAt: daysAgo(2),
      }),
    );
  }

  // Network notifications, each pointing at the page that actually resolves the item.
  // Addressed to the seeded admin rather than broadcast: `userId` is required now, so
  // that audience and read state are properties of the row (see the
  // NotificationRecipients migration).
  const notificationRepo = dataSource.getRepository(Notification);
  const notifications: Array<{
    key: string;
    level: NotificationLevel;
    category: NotificationCategory;
    title: string;
    body: string;
    link: string;
    daysAgo: number;
    read: boolean;
  }> = [
    {
      key: 'access-requests',
      level: NotificationLevel.INFO,
      category: NotificationCategory.OFFER,
      title: '2 offer access requests waiting',
      body: 'Lucas Silva and Amara Okafor are waiting on access decisions for the Lumen offers.',
      link: '/offers/access-requests',
      daysAgo: 1,
      read: false,
    },
    {
      key: 'pending-affiliates',
      level: NotificationLevel.INFO,
      category: NotificationCategory.AFFILIATE,
      title: '2 affiliate applications pending review',
      body: 'Priya Nair and Tomáš Novák have applied and are awaiting approval.',
      link: '/affiliates/pending',
      daysAgo: 2,
      read: false,
    },
    {
      key: 'postback-failures',
      level: NotificationLevel.WARNING,
      category: NotificationCategory.SYSTEM,
      title: 'Outbound postback failures detected',
      body: 'Several outbound postbacks returned 502 after 3 attempts. Check the affiliate endpoints.',
      link: '/reports/postback-logs',
      daysAgo: 2,
      read: false,
    },
    {
      key: 'fraud-blocked',
      level: NotificationLevel.WARNING,
      category: NotificationCategory.FRAUD,
      title: 'Datacenter traffic blocked',
      body: 'Clicks from hosting ASNs were scored BLOCKED and redirected away this week.',
      link: '/reports/click-logs',
      daysAgo: 4,
      read: true,
    },
    {
      key: 'offer-pending',
      level: NotificationLevel.INFO,
      category: NotificationCategory.OFFER,
      title: 'Vertex VPN Annual awaiting activation',
      body: 'The offer cannot go live until a postback has been verified.',
      link: '/offers/all',
      daysAgo: 6,
      read: true,
    },
    {
      key: 'payout-due',
      level: NotificationLevel.SUCCESS,
      category: NotificationCategory.BILLING,
      title: 'Payout batch ready to generate',
      body: 'Several affiliates have cleared the hold window and the minimum threshold.',
      link: '/billing',
      daysAgo: 1,
      read: false,
    },
  ];

  for (const notification of notifications) {
    await notificationRepo.save(
      notificationRepo.create({
        id: ids.notification(notification.key),
        userId: core.adminUserId,
        level: notification.level,
        category: notification.category,
        title: notification.title,
        body: notification.body,
        link: notification.link,
        readAt: notification.read ? daysAgo(0) : null,
        createdAt: daysAgo(notification.daysAgo),
      }),
    );
  }

  const subscriptionRepo = dataSource.getRepository(Subscription);
  const subscriptions: Array<{
    advertiserName: string;
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    cycle: BillingCycle;
    amount: string;
  }> = [
    { advertiserName: 'Acme Corp', plan: SubscriptionPlan.ENTERPRISE, status: SubscriptionStatus.ACTIVE, cycle: BillingCycle.ANNUAL, amount: '12000.00' },
    { advertiserName: 'Northwind Health', plan: SubscriptionPlan.GROWTH, status: SubscriptionStatus.ACTIVE, cycle: BillingCycle.MONTHLY, amount: '499.00' },
    { advertiserName: 'Lumen Casino', plan: SubscriptionPlan.GROWTH, status: SubscriptionStatus.PAST_DUE, cycle: BillingCycle.QUARTERLY, amount: '1350.00' },
    { advertiserName: 'Vertex Software', plan: SubscriptionPlan.STARTER, status: SubscriptionStatus.TRIAL, cycle: BillingCycle.MONTHLY, amount: '0.00' },
  ];

  for (const subscription of subscriptions) {
    const renews = new Date();
    renews.setMonth(renews.getMonth() + 1);
    await subscriptionRepo.save(
      subscriptionRepo.create({
        id: ids.subscription(subscription.advertiserName),
        advertiserId: core.advertiserIdByName.get(subscription.advertiserName)!,
        plan: subscription.plan,
        status: subscription.status,
        billingCycle: subscription.cycle,
        amount: subscription.amount,
        currency: 'USD',
        startedAt: daysAgo(180),
        renewsAt: subscription.status === SubscriptionStatus.CANCELLED ? null : renews,
        cancelledAt: null,
        notes: null,
      }),
    );
  }
}
