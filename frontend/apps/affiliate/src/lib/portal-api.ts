import type {
  AccessRequest,
  Affiliate,
  AffiliateDashboard,
  AffiliateManagerContact,
  AffiliateGroupedReport,
  AffiliatePoint,
  AffiliateReportRow,
  ClickLogPage,
  ConversionStatus,
  Invoice,
  Message,
  MessageThreadDetail,
  NewsPost,
  Notification,
  OwnBalance,
  OwnClickLog,
  OwnConversion,
  OwnReferral,
  Paginated,
  SmartLink,
} from '@fatexia/types';
import { apiFetch } from './api';
import { toQuery } from './query';

/**
 * The affiliate portal's API surface.
 *
 * Every path here is a `/…/mine` (or `/…/me`) endpoint that the server scopes to the
 * signed-in affiliate from their JWT — the affiliate id is never sent from the client,
 * so there is no filter to tamper with. The response shapes have no revenue or profit
 * field at all (see the Backend's separate affiliate DTOs).
 */

export interface OwnReportFilters {
  dateFrom?: string;
  dateTo?: string;
  offerId?: string;
  countryCode?: string;
}

// Profile

export function getOwnProfile(): Promise<Affiliate> {
  return apiFetch<Affiliate>('/affiliates/me');
}

export function updateOwnProfile(input: Record<string, unknown>): Promise<Affiliate> {
  return apiFetch<Affiliate>('/affiliates/me', { method: 'PATCH', body: JSON.stringify(input) });
}

export function getOwnReferrals(): Promise<OwnReferral[]> {
  return apiFetch<OwnReferral[]>('/affiliates/me/referrals');
}

/**
 * The affiliate's own manager, for the sidebar contact card (issue #6).
 *
* Always resolves — an affiliate with no assigned manager gets the network support
 * desk back, so the sidebar card renders identically for everyone.
 */
export function getOwnManager(): Promise<AffiliateManagerContact> {
  return apiFetch<AffiliateManagerContact>('/affiliates/me/manager');
}

// Dashboard & reports

export function getOwnDashboard(filters: OwnReportFilters = {}): Promise<AffiliateDashboard> {
  return apiFetch<AffiliateDashboard>(`/dashboard/mine${toQuery({ ...filters })}`);
}

export function getOwnReport(groupBy: string, filters: OwnReportFilters = {}, limit = 100): Promise<AffiliateGroupedReport> {
  return apiFetch<AffiliateGroupedReport>(`/reports/mine/grouped${toQuery({ groupBy, limit, ...filters })}`);
}

export function getOwnTrend(filters: OwnReportFilters = {}): Promise<AffiliateReportRow[]> {
  return apiFetch<AffiliateReportRow[]>(`/reports/mine/trend${toQuery({ ...filters })}`);
}

// Traffic

export interface OwnClickFilters extends OwnReportFilters {
  qualityStatus?: string;
  sortBy?: string;
  sortDir?: 'ASC' | 'DESC';
  page?: number;
  pageSize?: number;
}

// Totals travel with the page so the stat tiles describe the whole filtered set, not
// just the rows currently rendered.
export function getOwnClicks(filters: OwnClickFilters = {}): Promise<ClickLogPage<OwnClickLog>> {
  return apiFetch<ClickLogPage<OwnClickLog>>(`/click-logs/mine${toQuery({ ...filters })}`);
}

export function getOwnClickCountries(): Promise<string[]> {
  return apiFetch<string[]>('/click-logs/mine/countries');
}

export interface OwnConversionFilters {
  offerId?: string;
  status?: ConversionStatus | '';
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface OwnConversionList extends Paginated<OwnConversion> {
  totals: { count: number; payout: number };
}

export function getOwnConversions(filters: OwnConversionFilters = {}): Promise<OwnConversionList> {
  return apiFetch<OwnConversionList>(`/conversions/mine${toQuery({ ...filters })}`);
}

// Payments

export function getOwnInvoices(params: { page?: number; pageSize?: number } = {}): Promise<Paginated<Invoice>> {
  return apiFetch<Paginated<Invoice>>(`/invoices/mine${toQuery({ ...params })}`);
}

export function getOwnBalance(): Promise<OwnBalance> {
  return apiFetch<OwnBalance>('/invoices/mine/balance');
}

export interface OwnPointsResult extends Paginated<AffiliatePoint> {
  totalPoints: number;
}

export function getOwnPoints(params: { page?: number; pageSize?: number } = {}): Promise<OwnPointsResult> {
  return apiFetch<OwnPointsResult>(`/affiliate-points/mine${toQuery({ ...params })}`);
}

// Offers & access

export function getOwnAccessRequests(): Promise<AccessRequest[]> {
  return apiFetch<AccessRequest[]>('/offer-access-requests/mine');
}

export function requestOfferAccess(offerId: string, affiliateNote?: string): Promise<AccessRequest> {
  return apiFetch<AccessRequest>('/offer-access-requests', {
    method: 'POST',
    body: JSON.stringify({ offerId, affiliateNote }),
  });
}

export function getSmartLinks(): Promise<SmartLink[]> {
  return apiFetch<SmartLink[]>('/smart-links?status=ACTIVE');
}

// Comms

// The whole conversation, oldest first — a thread is short and always read as a whole,
// so it is not paginated.
export function getOwnThread(): Promise<MessageThreadDetail> {
  return apiFetch<MessageThreadDetail>('/messages/mine');
}

export function getOwnUnreadMessageCount(): Promise<{ unread: number }> {
  return apiFetch<{ unread: number }>('/messages/mine/unread-count');
}

// Marks the messages the network sent this affiliate as read. Without this the
// affiliate's unread count had no way to ever go down.
export function markOwnThreadRead(): Promise<{ marked: number }> {
  return apiFetch<{ marked: number }>('/messages/mine/read', { method: 'PATCH' });
}

export function sendOwnMessage(input: { body: string }): Promise<Message> {
  return apiFetch<Message>('/messages/mine', { method: 'POST', body: JSON.stringify(input) });
}

export function getPublishedNews(): Promise<NewsPost[]> {
  return apiFetch<NewsPost[]>('/news/published');
}

export function getNotifications(
  params: { unreadOnly?: boolean; category?: string; page?: number; pageSize?: number } = {},
): Promise<Paginated<Notification>> {
  return apiFetch<Paginated<Notification>>(`/notifications${toQuery({ ...params })}`);
}

// The newest few for the header bell. A dedicated endpoint so the dropdown isn't
// paging the full list just to read five rows.
export function getRecentNotifications(): Promise<Notification[]> {
  return apiFetch<Notification[]>('/notifications/recent');
}

export function getUnreadNotificationCount(): Promise<{ unread: number }> {
  return apiFetch<{ unread: number }>('/notifications/unread-count');
}

export function markNotificationRead(id: string): Promise<Notification> {
  return apiFetch<Notification>(`/notifications/${id}/read`, { method: 'PATCH' });
}

export function markAllNotificationsRead(): Promise<{ unread: number }> {
  return apiFetch<{ unread: number }>('/notifications/read-all', { method: 'PATCH' });
}
