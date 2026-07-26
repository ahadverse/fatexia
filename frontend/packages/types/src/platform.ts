// Access requests, smart-links, billing, messaging, content and platform config.

export type AccessRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface AccessRequest {
  id: string;
  offerId: string;
  offerName: string | null;
  affiliateId: string;
  affiliateName: string | null;
  affiliateEmail: string | null;
  status: AccessRequestStatus;
  affiliateNote: string | null;
  decisionNote: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export type SmartLinkStatus = 'ACTIVE' | 'PAUSED';
export type SmartLinkRotation = 'TOP_PAYOUT' | 'ROUND_ROBIN' | 'BEST_CR';

export interface SmartLink {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  offerIds: string[];
  offerCount: number;
  countries: string[];
  devices: string[];
  rotation: SmartLinkRotation;
  status: SmartLinkStatus;
  fallbackUrl: string | null;
  smartLinkUrl: string;
  createdAt: string;
}

export interface CreateSmartLinkInput {
  name: string;
  slug: string;
  description?: string;
  offerIds: string[];
  countries?: string[];
  devices?: string[];
  rotation?: SmartLinkRotation;
  status?: SmartLinkStatus;
  fallbackUrl?: string;
}

export type InvoiceStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'PAID' | 'REJECTED';
// Mirrors AffiliatePayoutMethod — a batch must be recordable on every rail an
// affiliate can select on their payout profile.
export type PaymentMethod = 'BANK_TRANSFER' | 'PAYPAL' | 'CRYPTO';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  affiliateId: string;
  affiliateName: string | null;
  periodFrom: string;
  periodTo: string;
  amount: number;
  currency: string;
  conversionCount: number;
  status: InvoiceStatus;
  paymentMethod: PaymentMethod;
  paymentReference: string | null;
  notes: string | null;
  paidAt: string | null;
  createdAt: string;
}

// Recomputed from conversions on every read — never a stored balance.
export interface PendingBalance {
  affiliateId: string;
  affiliateName: string | null;
  eligibleAmount: number;
  eligibleConversions: number;
  meetsThreshold: boolean;
}

export type SubscriptionPlan = 'STARTER' | 'GROWTH' | 'ENTERPRISE';
export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED';
export type BillingCycle = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';

export interface Subscription {
  id: string;
  advertiserId: string;
  advertiserName: string | null;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  amount: number;
  currency: string;
  startedAt: string;
  renewsAt: string | null;
  cancelledAt: string | null;
  notes: string | null;
  createdAt: string;
}

// INBOUND = the affiliate wrote it, OUTBOUND = the network did. `readAt` records that
// the *recipient* read it, and which party that is follows from the direction — the
// network's inbox is INBOUND, the affiliate's is OUTBOUND.
export type MessageDirection = 'INBOUND' | 'OUTBOUND';

export interface Message {
  id: string;
  affiliateId: string;
  affiliateName: string | null;
  direction: MessageDirection;
  // No subject: one conversation per affiliate, so there was nothing for a per-message
  // subject line to group or route.
  body: string;
  readAt: string | null;
  createdAt: string;
}

// A conversation summary — enough for a sidebar row without loading its messages.
export interface MessageThread {
  affiliateId: string;
  affiliateName: string | null;
  affiliateEmail: string | null;
  lastMessageAt: string;
  lastPreview: string | null;
  lastDirection: MessageDirection | null;
  messageCount: number;
  // Unread from the caller's own side only.
  unreadCount: number;
}

export interface MessageThreadDetail {
  affiliateId: string;
  affiliateName: string | null;
  affiliateEmail: string | null;
  messages: Message[];
}

export type NotificationLevel = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
export type NotificationCategory = 'OFFER' | 'AFFILIATE' | 'CONVERSION' | 'FRAUD' | 'BILLING' | 'SYSTEM';

export interface Notification {
  id: string;
  // Always set — notifications are fanned out per recipient, so audience and read
  // state are properties of the row rather than of the query that fetched it.
  userId: string;
  level: NotificationLevel;
  category: NotificationCategory;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export type NewsStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type NewsAudience = 'ALL' | 'AFFILIATES' | 'ADVERTISERS';

export interface NewsPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body: string;
  status: NewsStatus;
  audience: NewsAudience;
  pinned: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNewsInput {
  title: string;
  slug: string;
  excerpt?: string;
  body: string;
  status?: NewsStatus;
  audience?: NewsAudience;
  pinned?: boolean;
}

export type EmailTemplateKey =
  | 'AFFILIATE_WELCOME'
  | 'PASSWORD_RESET'
  | 'ACCESS_REQUEST_APPROVED'
  | 'ACCESS_REQUEST_REJECTED'
  | 'AFFILIATE_APPROVED'
  | 'AFFILIATE_SUSPENDED'
  | 'PAYOUT_SENT'
  | 'OFFER_LIVE';

export interface EmailTemplate {
  id: string;
  templateKey: EmailTemplateKey;
  name: string;
  subject: string;
  body: string;
  availableMacros: string[];
  enabled: boolean;
  updatedAt: string;
}

export interface NetworkSettings {
  networkName: string;
  supportEmail: string | null;
  defaultCurrency: string;
  timezone: string;
  defaultHoldDays: number;
  minimumPayoutThreshold: number;
  payoutCycleDays: number;
  autoApproveAffiliates: boolean;
  autoApproveConversions: boolean;
  pointsPerConversion: number;
  fraudSuspectThreshold: number;
  fraudBlockThreshold: number;
  // Where BLOCKED traffic is sent instead of the advertiser. Null uses the tracker's
  // built-in default; an offer may override it per-offer.
  blockedRedirectUrl: string | null;
  loginRateLimitPerMinute: number;
  clickRateLimitPerMinute: number;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpFromEmail: string | null;
  updatedAt: string;
}

export type IntegrationProvider = 'IPHUB' | 'IPAPI_IS' | 'IPQS' | 'MAXMIND' | 'SMTP' | 'PAYPAL' | 'WISE';
export type IntegrationStatus = 'NOT_CONFIGURED' | 'ACTIVE' | 'DISABLED' | 'ERROR';

export interface Integration {
  id: string;
  provider: IntegrationProvider;
  name: string;
  description: string | null;
  // Masked previews only — the API never returns a raw secret.
  apiKeyPreview: string | null;
  apiSecretPreview: string | null;
  hasApiKey: boolean;
  hasApiSecret: boolean;
  config: Record<string, unknown>;
  status: IntegrationStatus;
  lastCheckedAt: string | null;
  lastError: string | null;
  updatedAt: string;
}
