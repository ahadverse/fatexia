import type { Express } from 'express';
import { authRoutes } from './modules/auth/auth.routes';
import { userRoutes } from './modules/users/user.routes';
import { offerRoutes } from './modules/offers/offer.routes';
import { offerCategoryRoutes } from './modules/offer-categories/offer-category.routes';
import { offerAccessRequestRoutes } from './modules/offer-access-requests/offer-access-request.routes';
import { smartLinkRoutes } from './modules/smart-links/smart-link.routes';
import { advertiserRoutes } from './modules/advertisers/advertiser.routes';
import { affiliateRoutes } from './modules/affiliates/affiliate.routes';
import { affiliateGroupRoutes } from './modules/affiliate-groups/affiliate-group.routes';
import { affiliatePointRoutes } from './modules/affiliate-points/affiliate-point.routes';
import { managerRoutes } from './modules/managers/manager.routes';
import { clickLogRoutes } from './modules/clicks/click-log.routes';
import { conversionRoutes } from './modules/conversions/conversion.routes';
import { postbackLogRoutes } from './modules/postback-logs/postback-log.routes';
import { invoiceRoutes } from './modules/invoices/invoice.routes';
import { subscriptionRoutes } from './modules/subscriptions/subscription.routes';
import { messageRoutes } from './modules/messages/message.routes';
import { notificationRoutes } from './modules/notifications/notification.routes';
import { newsRoutes } from './modules/news/news.routes';
import { blogRoutes } from './modules/blog/blog.routes';
import { emailTemplateRoutes } from './modules/email-templates/email-template.routes';
import { emailRoutes } from './modules/emails/email.routes';
import { networkSettingRoutes } from './modules/network-settings/network-setting.routes';
import { globalPostbackRoutes } from './modules/global-postbacks/global-postback.routes';
import { geoipRoutes } from './modules/geoip/geoip.routes';
import { integrationRoutes } from './modules/integrations/integration.routes';
import { uploadRoutes } from './modules/uploads/upload.routes';
import { reportRoutes } from './modules/reports/report.routes';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes';

export function mountMainRoutes(app: Express): void {
  app.use('/auth', authRoutes);
  app.use('/users', userRoutes);

  app.use('/offers', offerRoutes);
  app.use('/offer-categories', offerCategoryRoutes);
  app.use('/offer-access-requests', offerAccessRequestRoutes);
  app.use('/smart-links', smartLinkRoutes);

  app.use('/advertisers', advertiserRoutes);
  app.use('/affiliates', affiliateRoutes);
  app.use('/affiliate-groups', affiliateGroupRoutes);
  app.use('/affiliate-points', affiliatePointRoutes);
  app.use('/managers', managerRoutes);

  // Traffic data. The Tracker owns the write side of /click on its own entrypoint;
  // these are the read/report surfaces on the main API.
  app.use('/click-logs', clickLogRoutes);
  app.use('/conversions', conversionRoutes);
  app.use('/postback-logs', postbackLogRoutes);

  app.use('/invoices', invoiceRoutes);
  app.use('/subscriptions', subscriptionRoutes);

  app.use('/messages', messageRoutes);
  app.use('/notifications', notificationRoutes);
  app.use('/news', newsRoutes);
  app.use('/blogs', blogRoutes);
  app.use('/email-templates', emailTemplateRoutes);
  app.use('/emails', emailRoutes);

  app.use('/network-settings', networkSettingRoutes);
  app.use('/global-postbacks', globalPostbackRoutes);
  app.use('/integrations', integrationRoutes);
  app.use('/geoip', geoipRoutes);
  app.use('/uploads', uploadRoutes);

  app.use('/reports', reportRoutes);
  app.use('/dashboard', dashboardRoutes);
}
