import type {
  AccessRequest,
  AccessRequestStatus,
  CreateNewsInput,
  CreateSmartLinkInput,
  EmailTemplate,
  Integration,
  Invoice,
  InvoiceStatus,
  Message,
  MessageThread,
  MessageThreadDetail,
  NetworkSettings,
  NewsPost,
  Notification,
  Paginated,
  PaymentMethod,
  PendingBalance,
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

// Billing

export function getInvoices(filters: { status?: InvoiceStatus | ''; affiliateId?: string; page?: number; pageSize?: number } = {}): Promise<Paginated<Invoice>> {
  return apiFetch<Paginated<Invoice>>(`/invoices${toQuery({ ...filters })}`);
}

export function getPendingBalances(): Promise<PendingBalance[]> {
  return apiFetch<PendingBalance[]>('/invoices/pending-balances');
}

export function generatePayoutBatch(input: {
  affiliateIds?: string[];
  periodFrom: string;
  periodTo: string;
  paymentMethod?: PaymentMethod;
}): Promise<Invoice[]> {
  return apiFetch<Invoice[]>('/invoices/batch', { method: 'POST', body: JSON.stringify(input) });
}

export function updateInvoiceStatus(
  id: string,
  input: { status: InvoiceStatus; paymentReference?: string; notes?: string },
): Promise<Invoice> {
  return apiFetch<Invoice>(`/invoices/${id}/status`, { method: 'PATCH', body: JSON.stringify(input) });
}

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

// Network settings

export function getNetworkSettings(): Promise<NetworkSettings> {
  return apiFetch<NetworkSettings>('/network-settings');
}

export function updateNetworkSettings(input: Partial<NetworkSettings>): Promise<NetworkSettings> {
  return apiFetch<NetworkSettings>('/network-settings', { method: 'PATCH', body: JSON.stringify(input) });
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
