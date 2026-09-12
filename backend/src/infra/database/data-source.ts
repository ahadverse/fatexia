import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { env } from '../../common/env';
import { User } from '../../modules/users/user.entity';
import { LoginLog } from '../../modules/login-logs/login-log.entity';
import { Affiliate } from '../../modules/affiliates/affiliate.entity';
import { AffiliateGroup } from '../../modules/affiliate-groups/affiliate-group.entity';
import { AffiliatePoint } from '../../modules/affiliate-points/affiliate-point.entity';
import { Manager } from '../../modules/managers/manager.entity';
import { Advertiser } from '../../modules/advertisers/advertiser.entity';
import { OfferCategory } from '../../modules/offer-categories/offer-category.entity';
import { Offer } from '../../modules/offers/offer.entity';
import { PayoutRule } from '../../modules/offers/payout-rule.entity';
import { OfferCap } from '../../modules/offers/offer-cap.entity';
import { OfferAccessRequest } from '../../modules/offer-access-requests/offer-access-request.entity';
import { SmartLink } from '../../modules/smart-links/smart-link.entity';
import { Click } from '../../modules/clicks/click.entity';
import { Conversion } from '../../modules/conversions/conversion.entity';
import { PostbackLog } from '../../modules/postback-logs/postback-log.entity';
import { Invoice } from '../../modules/invoices/invoice.entity';
import { Subscription } from '../../modules/subscriptions/subscription.entity';
import { Message } from '../../modules/messages/message.entity';
import { Notification } from '../../modules/notifications/notification.entity';
import { NewsPost } from '../../modules/news/news-post.entity';
import { BlogPost } from '../../modules/blog/blog-post.entity';
import { EmailTemplate } from '../../modules/email-templates/email-template.entity';
import { NetworkSetting } from '../../modules/network-settings/network-setting.entity';
import { GlobalPostback } from '../../modules/global-postbacks/global-postback.entity';
import { Integration } from '../../modules/integrations/integration.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: env.DATABASE_URL,
  // Set explicitly rather than left to `?sslmode=require` in the connection string:
  // pg-connection-string has changed how it maps sslmode across versions, so the URL
  // alone is not a reliable way to guarantee TLS. What is set here wins over the URL.
  //
  // Verification stays ON. Neon serves a publicly-trusted certificate, so there is no
  // reason to accept an unverified one — `rejectUnauthorized: false` would leave the
  // connection encrypted but not authenticated, which is precisely the gap a
  // man-in-the-middle needs, and this connection carries every payout and credential.
  ssl: env.DATABASE_SSL ? { rejectUnauthorized: true } : false,
  synchronize: false,
  logging: env.NODE_ENV === 'development',
  // Each migration runs in its own transaction (rather than one transaction for the
  // whole batch), so a failure partway through a `migration:run` isolates its blast
  // radius to that migration instead of leaving a mixed-state rollback.
  migrationsTransactionMode: 'each',
  entities: [
    GlobalPostback,
    User,
    LoginLog,
    Affiliate,
    AffiliateGroup,
    AffiliatePoint,
    Manager,
    Advertiser,
    OfferCategory,
    Offer,
    PayoutRule,
    OfferCap,
    OfferAccessRequest,
    SmartLink,
    Click,
    Conversion,
    PostbackLog,
    Invoice,
    Subscription,
    Message,
    Notification,
    NewsPost,
    BlogPost,
    EmailTemplate,
    NetworkSetting,
    Integration,
  ],
  migrations: [`${__dirname}/migrations/*.{ts,js}`],
});
