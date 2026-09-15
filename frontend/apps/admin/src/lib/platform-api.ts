import type {
  AccessRequest,
  AccessRequestStatus,
  CreateNewsInput,
  GlobalPostback,
  GlobalPostbackInput,
  CreateSmartLinkInput,
  EmailTemplate,
  Integration,
  IntegrationProvider,
  Message,
  MessageThread,
  MessageThreadDetail,
  NetworkSettings,
  NewsPost,
  Notification,
  Paginated,
  SmartLink,
  Subscription,
} from '@fatexia/types';
import { apiFetch } from './api';
import { toQuery } from './query';

// Offer access requests

export function getAccessRequests(filters: { status?: AccessRequestStatus | ''; offerId?: string } = {}): Promise<AccessRequest[]> {
  return apiFetch<AccessRequest[]>(`/offer-access-requests${toQuery({ ...filters })}`);
}

export function decideAccessRequest(
  id: string,
  status: 'APPROVED' | 'REJECTED',
  decisionNote?: string,
): Promise<AccessRequest> {
  return apiFetch<AccessRequest>(`/offer-access-requests/${id}/decision`, {
    method: 'PATCH',
    body: JSON.stringify({ status, decisionNote }),
  });
}

// Smart-links

export function getSmartLinks(filters: { status?: string; search?: string } = {}): Promise<SmartLink[]> {
  return apiFetch<SmartLink[]>(`/smart-links${toQuery({ ...filters })}`);
}

export function createSmartLink(input: CreateSmartLinkInput): Promise<SmartLink> {
  return apiFetch<SmartLink>('/smart-links', { method: 'POST', body: JSON.stringify(input) });
}

export function updateSmartLink(id: string, input: Partial<CreateSmartLinkInput>): Promise<SmartLink> {
  return apiFetch<SmartLink>(`/smart-links/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function deleteSmartLink(id: string): Promise<void> {
  return apiFetch<void>(`/smart-links/${id}`, { method: 'DELETE' });
}

// Billing (invoices, payout batches and the money ledger) lives in ./billing-api.

// Subscriptions

export function getSubscriptions(filters: { status?: string; plan?: string } = {}): Promise<Subscription[]> {
  return apiFetch<Subscription[]>(`/subscriptions${toQuery({ ...filters })}`);
}

export function createSubscription(input: Record<string, unknown>): Promise<Subscription> {
  return apiFetch<Subscription>('/subscriptions', { method: 'POST', body: JSON.stringify(input) });
}

export function updateSubscription(id: string, input: Record<string, unknown>): Promise<Subscription> {
  return apiFetch<Subscription>(`/subscriptions/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

// Messages

export function getMessages(filters: { affiliateId?: string; unreadOnly?: boolean; page?: number; pageSize?: number } = {}): Promise<Paginated<Message>> {
  return apiFetch<Paginated<Message>>(`/messages${toQuery({ ...filters })}`);
}

// Conversation list, grouped server-side — paginates over threads, not messages.
export function getMessageThreads(filters: { unreadOnly?: boolean; page?: number; pageSize?: number } = {}): Promise<Paginated<MessageThread>> {
  return apiFetch<Paginated<MessageThread>>(`/messages/threads${toQuery({ ...filters })}`);
}

export function getMessageThread(affiliateId: string): Promise<MessageThreadDetail> {
  return apiFetch<MessageThreadDetail>(`/messages/threads/${affiliateId}`);
}

// Marks the whole conversation read for the network side only — it cannot touch the
// affiliate's own unread state (see the routes file for why this is per-thread and
// not per-message).
export function markThreadRead(affiliateId: string): Promise<{ marked: number }> {
  return apiFetch<{ marked: number }>(`/messages/threads/${affiliateId}/read`, { method: 'PATCH' });
}

export function getUnreadMessageCount(): Promise<{ unread: number }> {
  return apiFetch<{ unread: number }>('/messages/unread-count');
}

export function sendMessage(input: { affiliateId: string; body: string }): Promise<Message> {
  return apiFetch<Message>('/messages', { method: 'POST', body: JSON.stringify(input) });
}

// Notifications

export function getNotifications(filters: { unreadOnly?: boolean; category?: string; page?: number; pageSize?: number } = {}): Promise<Paginated<Notification>> {
  return apiFetch<Paginated<Notification>>(`/notifications${toQuery({ ...filters })}`);
}

export function getUnreadNotificationCount(): Promise<{ unread: number }> {
  return apiFetch<{ unread: number }>('/notifications/unread-count');
}

// The newest few for the header bell. A dedicated endpoint so the dropdown isn't
// paging the full list just to read five rows.
export function getRecentNotifications(): Promise<Notification[]> {
  return apiFetch<Notification[]>('/notifications/recent');
}

export function markNotificationRead(id: string): Promise<Notification> {
  return apiFetch<Notification>(`/notifications/${id}/read`, { method: 'PATCH' });
}

export function markAllNotificationsRead(): Promise<{ unread: number }> {
  return apiFetch<{ unread: number }>('/notifications/read-all', { method: 'PATCH' });
}

// News

export function getNewsPosts(filters: { status?: string; search?: string } = {}): Promise<NewsPost[]> {
  return apiFetch<NewsPost[]>(`/news${toQuery({ ...filters })}`);
}

export function createNewsPost(input: CreateNewsInput): Promise<NewsPost> {
  return apiFetch<NewsPost>('/news', { method: 'POST', body: JSON.stringify(input) });
}

export function updateNewsPost(id: string, input: Partial<CreateNewsInput>): Promise<NewsPost> {
  return apiFetch<NewsPost>(`/news/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function deleteNewsPost(id: string): Promise<void> {
  return apiFetch<void>(`/news/${id}`, { method: 'DELETE' });
}

// Email templates

export function getEmailTemplates(): Promise<EmailTemplate[]> {
  return apiFetch<EmailTemplate[]>('/email-templates');
}

export function updateEmailTemplate(
  id: string,
  input: { name?: string; subject?: string; body?: string; enabled?: boolean },
): Promise<EmailTemplate> {
  return apiFetch<EmailTemplate>(`/email-templates/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

// Manual send

export const MAX_MANUAL_RECIPIENTS = 25;

export interface SendEmailResult {
  sent: string[];
  failed: { email: string; error: string }[];
}

export interface ManualEmailContent {
  subject: string;
  body: string;
  macros?: Record<string, string>;
}

// Resolves even when some recipients were rejected — the per-recipient breakdown is
// the answer, so failures come back in `failed` rather than as a thrown error.
export function sendManualEmail(input: ManualEmailContent & { recipients: string[] }): Promise<SendEmailResult> {
  return apiFetch<SendEmailResult>('/emails/send', { method: 'POST', body: JSON.stringify(input) });
}

// Rendered by the server through the same layout the send path uses, so what this
// shows is what actually goes out — a preview built client-side would drift.
export function previewManualEmail(
  input: ManualEmailContent,
): Promise<{ subject: string; html: string; unresolved: string[] }> {
  return apiFetch<{ subject: string; html: string; unresolved: string[] }>('/emails/preview', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// Network settings

export function getNetworkSettings(): Promise<NetworkSettings> {
  return apiFetch<NetworkSettings>('/network-settings');
}

export function updateNetworkSettings(input: Partial<NetworkSettings>): Promise<NetworkSettings> {
  return apiFetch<NetworkSettings>('/network-settings', { method: 'PATCH', body: JSON.stringify(input) });
}

// GeoIP database — the Tracker's MaxMind .mmdb files. Never downloaded
// automatically (build or startup); an admin triggers it here. The API proxies to
// the Tracker service, which owns the files — see backend/src/modules/geoip.

export type GeoipEditionKey = 'GeoLite2-City' | 'GeoLite2-ASN';

export interface GeoipEditionStatus {
  /** On the Tracker's disk right now — what its lookups actually use. */
  present: boolean;
  updatedAt: string | null;
  /**
   * When it was last downloaded from MaxMind, per the copy kept in Postgres. Differs
   * from `updatedAt` after a restart, when the file's timestamp is the moment it was
   * restored from that copy rather than when the data was fetched.
   */
  storedAt: string | null;
}

export type GeoipEditionOutcome = 'downloaded' | 'skipped-cooldown' | 'failed';

/**
 * What the current or last download run is doing.
 *
 * The fetch no longer happens inside the request that starts it — moving ~74MB takes
 * longer than the platform holds a connection open, which used to report a successful
 * download as a 502. The button starts the run; this says how it went.
 */
export interface GeoipFetchState {
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  editions: Record<GeoipEditionKey, GeoipEditionOutcome> | null;
  error: string | null;
}

export interface GeoipStatus {
  editions: Record<GeoipEditionKey, GeoipEditionStatus>;
  fetch: GeoipFetchState;
}

export function getGeoipStatus(): Promise<GeoipStatus> {
  return apiFetch<GeoipStatus>('/geoip/status');
}

// Returns as soon as the download is under way, not when it finishes. Poll
// `getGeoipStatus` until `fetch.running` goes false.
export function fetchGeoipNow(): Promise<GeoipFetchState> {
  return apiFetch<GeoipFetchState>('/geoip/fetch', { method: 'POST' });
}

// Integrations

export function getIntegrations(): Promise<Integration[]> {
  return apiFetch<Integration[]>('/integrations');
}

// A blank apiKey/apiSecret means "leave the stored secret unchanged" — the form
// renders a masked preview and only sends a value when one is actually typed.
export function updateIntegration(
  id: string,
  input: { apiKey?: string; apiSecret?: string; config?: Record<string, unknown>; status?: string },
): Promise<Integration> {
  return apiFetch<Integration>(`/integrations/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

// Makes a real call to the provider with the stored key and records the outcome on
// the row. A failed test resolves normally — the failure is reported via the returned
// integration's `status`/`lastError`, not by rejecting.
export function testIntegration(id: string): Promise<Integration> {
  return apiFetch<Integration>(`/integrations/${id}/test`, { method: 'POST' });
}

// Adds another credential to a provider that cascades (the fraud providers). Appended
// at the end of that provider's order, so the keys already carrying traffic keep
// precedence over a freshly pasted spare.
export function addIntegrationCredential(provider: IntegrationProvider, name?: string): Promise<Integration> {
  return apiFetch<Integration>('/integrations', { method: 'POST', body: JSON.stringify({ provider, name }) });
}

// Refused for a provider's last remaining credential — clearing the key or disabling
// the row is how a provider is turned off.
export function deleteIntegration(id: string): Promise<void> {
  return apiFetch<void>(`/integrations/${id}`, { method: 'DELETE' });
}

/**
 * Cover image for a news card. Same S3-backed endpoint family as the offer
 * thumbnail upload — the server picks the bucket folder from the route, so the
 * client never names a storage path.
 */
export function uploadNewsImage(file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append('image', file);
  return apiFetch<{ url: string }>('/uploads/news-image', { method: 'POST', body: formData });
}

// Network-level postbacks (Admin → Settings). Admin-only on the server.
export function getGlobalPostbacks(): Promise<GlobalPostback[]> {
  return apiFetch<GlobalPostback[]>('/global-postbacks');
}

export function createGlobalPostback(input: GlobalPostbackInput): Promise<GlobalPostback> {
  return apiFetch<GlobalPostback>('/global-postbacks', { method: 'POST', body: JSON.stringify(input) });
}

export function updateGlobalPostback(id: string, input: Partial<GlobalPostbackInput>): Promise<GlobalPostback> {
  return apiFetch<GlobalPostback>(`/global-postbacks/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function deleteGlobalPostback(id: string): Promise<void> {
  return apiFetch<void>(`/global-postbacks/${id}`, { method: 'DELETE' });
}
