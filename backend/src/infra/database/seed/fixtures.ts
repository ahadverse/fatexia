import { AffiliateMessenger, AffiliatePayoutMethod } from '../../../modules/affiliates/affiliate.entity';
import { ManagerRole, type ManagerPermissions } from '../../../modules/managers/manager.entity';
import { AdvertiserStatus } from '../../../modules/advertisers/advertiser.entity';
import { UserStatus } from '../../../modules/users/user.entity';
import { OfferStatus, TrackingPlatform } from '../../../modules/offers/offer.entity';
import { PayoutMode, PayoutType, RevenueModel } from '../../../modules/offers/payout-rule.entity';
import { CapMetric, CapPeriod } from '../../../modules/offers/offer-cap.entity';
import { EmailTemplateKey } from '../../../modules/email-templates/email-template.entity';
import { IntegrationProvider } from '../../../modules/integrations/integration.entity';

// Shared dev-seed fixture data. Only used by run-seed.ts (never seed:prod).
export const SEED_PASSWORD = 'ChangeMe123!';
export const ADMIN_EMAIL = 'admin@fatexia.dev';
export const MANAGER_EMAIL = 'manager@fatexia.dev';
export const AFFILIATE_EMAIL = 'affiliate@fatexia.dev';

// Kept as named exports because the affiliate/admin portals' verification steps and
// PROGRESS.md refer to this specific advertiser/offer by name.
export const SAMPLE_ADVERTISER_NAME = 'Acme Corp';
export const SAMPLE_CATEGORY_NAME = 'Finance';
export const SAMPLE_OFFER_NAME = 'Acme Credit Card Signup';

export const CATEGORY_NAMES = [
  SAMPLE_CATEGORY_NAME,
  'Nutra & Health',
  'Sweepstakes',
  'Dating',
  'iGaming',
  'E-commerce',
  'Software & VPN',
  'Insurance',
] as const;

export interface ManagerFixture {
  email: string;
  fullName: string;
  managerRole: ManagerRole;
  phone: string;
  skype: string;
  defaultCommissionPercent: number;
  permissions: ManagerPermissions;
}

// Three deliberately different permission sets (issue #20), so the grid on the
// Managers page has something real to show and the guards are exercised by the seed:
// a general manager with everything, an affiliate manager who can approve but not
// touch payouts, and an account manager confined to advertisers and offers.
const GENERAL_MANAGER_PERMISSIONS: ManagerPermissions = {
  'affiliates.view': true,
  'affiliates.create': true,
  'affiliates.edit': true,
  'affiliates.approve': true,
  'affiliates.suspend': true,
  'affiliates.reject': true,
  'affiliates.payout': true,
  'affiliates.impersonate': true,
  'offers.view': true,
  'offers.create': true,
  'offers.edit': true,
  'advertisers.manage': true,
  'reports.view': true,
  'messages.send': true,
};

export const MANAGERS: ManagerFixture[] = [
  {
    email: MANAGER_EMAIL,
    fullName: 'Dana Whitfield',
    managerRole: ManagerRole.GENERAL,
    phone: '+1 415 555 0142',
    skype: 'dana.whitfield',
    defaultCommissionPercent: 5,
    permissions: GENERAL_MANAGER_PERMISSIONS,
  },
  {
    email: 'am.rivera@fatexia.dev',
    fullName: 'Marco Rivera',
    managerRole: ManagerRole.AFFILIATE,
    phone: '+1 415 555 0177',
    skype: 'marco.rivera',
    defaultCommissionPercent: 8,
    permissions: {
      'affiliates.view': true,
      'affiliates.create': true,
      'affiliates.edit': true,
      'affiliates.approve': true,
      'affiliates.suspend': true,
      'affiliates.reject': true,
      'offers.view': true,
      'reports.view': true,
      'messages.send': true,
    },
  },
  {
    email: 'acct.lindqvist@fatexia.dev',
    fullName: 'Elin Lindqvist',
    managerRole: ManagerRole.ACCOUNT,
    phone: '+46 8 555 0110',
    skype: 'elin.lindqvist',
    defaultCommissionPercent: 6,
    permissions: {
      'affiliates.view': true,
      'offers.view': true,
      'offers.create': true,
      'offers.edit': true,
      'advertisers.manage': true,
      'reports.view': true,
    },
  },
];

export interface AffiliateFixture {
  email: string;
  fullName: string;
  companyName: string;
  country: string;
  status: UserStatus;
  messengerType: AffiliateMessenger;
  messengerHandle: string;
  trafficSources: string[];
  verticals: string[];
  monthlyVolume: string;
  referralSource: string;
  phone: string;
  websiteUrl: string;
  payoutMethod: AffiliatePayoutMethod;
  payoutDetails: Record<string, unknown>;
  managerEmail: string | null;
  referredByEmail: string | null;
  referralCode: string;
}

// A deliberate spread of statuses so Affiliates → All / Pending both have rows, and
// two referral chains so the Referral Program page isn't empty.
export const AFFILIATES: AffiliateFixture[] = [
  {
    email: AFFILIATE_EMAIL,
    fullName: 'Jordan Blake',
    companyName: 'Blake Media',
    country: 'United States',
    status: UserStatus.ACTIVE,
    messengerType: AffiliateMessenger.TELEGRAM,
    messengerHandle: '@jordanblake',
    trafficSources: ['Facebook', 'Native'],
    verticals: ['Finance', 'Insurance'],
    monthlyVolume: '$10k-$50k / mo',
    referralSource: 'Search engine',
    phone: '+1 212 555 0198',
    websiteUrl: 'https://blakemedia.example.com',
    payoutMethod: AffiliatePayoutMethod.PAYPAL,
    payoutDetails: { paypalEmail: 'billing@blakemedia.example.com' },
    managerEmail: 'am.rivera@fatexia.dev',
    referredByEmail: null,
    referralCode: 'JORDAN24',
  },
  {
    email: 'sofia.marino@partners.dev',
    fullName: 'Sofia Marino',
    companyName: 'Marino Performance',
    country: 'Italy',
    status: UserStatus.ACTIVE,
    messengerType: AffiliateMessenger.SKYPE,
    messengerHandle: 'sofia.marino',
    trafficSources: ['Push', 'Pop'],
    verticals: ['Sweepstakes', 'Dating'],
    monthlyVolume: '$50k+ / mo',
    referralSource: 'Affiliate forum',
    phone: '+39 02 555 0122',
    websiteUrl: 'https://marinoperf.example.com',
    payoutMethod: AffiliatePayoutMethod.BANK_TRANSFER,
    payoutDetails: { bankName: 'Intesa', accountLast4: '4821' },
    managerEmail: 'am.rivera@fatexia.dev',
    referredByEmail: AFFILIATE_EMAIL,
    referralCode: 'SOFIA88',
  },
  {
    email: 'kenji.tanaka@partners.dev',
    fullName: 'Kenji Tanaka',
    companyName: 'Tanaka Digital',
    country: 'Japan',
    status: UserStatus.ACTIVE,
    messengerType: AffiliateMessenger.TELEGRAM,
    messengerHandle: '@kenjitanaka',
    trafficSources: ['SEO', 'Email'],
    verticals: ['Software & VPN', 'E-commerce'],
    monthlyVolume: '$10k-$50k / mo',
    referralSource: 'Social media',
    phone: '+81 3 5555 0144',
    websiteUrl: 'https://tanakadigital.example.com',
    payoutMethod: AffiliatePayoutMethod.PAYPAL,
    payoutDetails: { paypalEmail: 'kenji@tanakadigital.example.com' },
    managerEmail: 'am.rivera@fatexia.dev',
    referredByEmail: AFFILIATE_EMAIL,
    referralCode: 'KENJI31',
  },
  {
    email: 'amara.okafor@partners.dev',
    fullName: 'Amara Okafor',
    companyName: 'Okafor Growth',
    country: 'Nigeria',
    status: UserStatus.ACTIVE,
    messengerType: AffiliateMessenger.WHATSAPP,
    messengerHandle: '+234 802 555 0166',
    trafficSources: ['Facebook', 'Influencer'],
    verticals: ['iGaming', 'Nutra & Health'],
    monthlyVolume: '$1k-$10k / mo',
    referralSource: 'Friend or referral',
    phone: '+234 802 555 0166',
    websiteUrl: 'https://okaforgrowth.example.com',
    payoutMethod: AffiliatePayoutMethod.BANK_TRANSFER,
    payoutDetails: { bankName: 'GTBank', accountLast4: '7093' },
    managerEmail: 'acct.lindqvist@fatexia.dev',
    referredByEmail: 'sofia.marino@partners.dev',
    referralCode: 'AMARA07',
  },
  {
    email: 'lucas.silva@partners.dev',
    fullName: 'Lucas Silva',
    companyName: 'Silva Traffic',
    country: 'Brazil',
    status: UserStatus.ACTIVE,
    messengerType: AffiliateMessenger.TELEGRAM,
    messengerHandle: '@lucassilva',
    trafficSources: ['Pop', 'Native'],
    verticals: ['Sweepstakes', 'iGaming'],
    monthlyVolume: 'Under $1k / mo',
    referralSource: 'Event or conference',
    phone: '+55 11 5555 0133',
    websiteUrl: 'https://silvatraffic.example.com',
    payoutMethod: AffiliatePayoutMethod.PAYPAL,
    payoutDetails: { paypalEmail: 'lucas@silvatraffic.example.com' },
    managerEmail: 'acct.lindqvist@fatexia.dev',
    referredByEmail: null,
    referralCode: 'LUCAS55',
  },
  {
    email: 'priya.nair@partners.dev',
    fullName: 'Priya Nair',
    companyName: 'Nair Acquisition',
    country: 'India',
    status: UserStatus.PENDING,
    messengerType: AffiliateMessenger.WHATSAPP,
    messengerHandle: '+91 98 5555 0121',
    trafficSources: ['Google', 'SEO'],
    verticals: ['Finance', 'Software & VPN'],
    monthlyVolume: '$1k-$10k / mo',
    referralSource: 'Search engine',
    phone: '+91 98 5555 0121',
    websiteUrl: 'https://nairacq.example.com',
    payoutMethod: AffiliatePayoutMethod.BANK_TRANSFER,
    payoutDetails: { bankName: 'HDFC', accountLast4: '5512' },
    managerEmail: null,
    referredByEmail: null,
    referralCode: 'PRIYA19',
  },
  {
    email: 'tomas.novak@partners.dev',
    fullName: 'Tomáš Novák',
    companyName: 'Novak Ads',
    country: 'Czechia',
    status: UserStatus.PENDING,
    messengerType: AffiliateMessenger.SKYPE,
    messengerHandle: 'tomas.novak',
    trafficSources: ['Push'],
    verticals: ['Dating'],
    monthlyVolume: 'Just starting out',
    referralSource: 'Other',
    phone: '+420 2 5555 0177',
    websiteUrl: 'https://novakads.example.com',
    payoutMethod: AffiliatePayoutMethod.PAYPAL,
    payoutDetails: { paypalEmail: 'tomas@novakads.example.com' },
    managerEmail: null,
    referredByEmail: 'kenji.tanaka@partners.dev',
    referralCode: 'TOMAS42',
  },
  {
    email: 'hana.yilmaz@partners.dev',
    fullName: 'Hana Yılmaz',
    companyName: 'Yilmaz Network',
    country: 'Türkiye',
    status: UserStatus.BLOCKED,
    messengerType: AffiliateMessenger.TELEGRAM,
    messengerHandle: '@hanayilmaz',
    trafficSources: ['Pop', 'Push'],
    verticals: ['iGaming'],
    monthlyVolume: '$1k-$10k / mo',
    referralSource: 'Affiliate forum',
    phone: '+90 212 555 0188',
    websiteUrl: 'https://yilmaznet.example.com',
    payoutMethod: AffiliatePayoutMethod.BANK_TRANSFER,
    payoutDetails: { bankName: 'Garanti', accountLast4: '3310' },
    managerEmail: 'acct.lindqvist@fatexia.dev',
    referredByEmail: null,
    referralCode: 'HANA76',
  },
];

export interface AdvertiserFixture {
  name: string;
  status: AdvertiserStatus;
  contactName: string;
  contactEmail: string;
  phone: string;
  country: string;
  websiteUrl: string;
  accountManagerEmail: string | null;
}

export const ADVERTISERS: AdvertiserFixture[] = [
  {
    name: SAMPLE_ADVERTISER_NAME,
    status: AdvertiserStatus.ACTIVE,
    contactName: 'Rachel Kim',
    contactEmail: 'partners@acme.example.com',
    phone: '+1 650 555 0100',
    country: 'United States',
    websiteUrl: 'https://acme.example.com',
    accountManagerEmail: 'acct.lindqvist@fatexia.dev',
  },
  {
    name: 'Northwind Health',
    status: AdvertiserStatus.ACTIVE,
    contactName: 'Peter Grant',
    contactEmail: 'affiliates@northwind.example.com',
    phone: '+44 20 5555 0111',
    country: 'United Kingdom',
    websiteUrl: 'https://northwind.example.com',
    accountManagerEmail: 'acct.lindqvist@fatexia.dev',
  },
  {
    name: 'Lumen Casino',
    status: AdvertiserStatus.ACTIVE,
    contactName: 'Ivo Petrov',
    contactEmail: 'partners@lumen.example.com',
    phone: '+356 21 555 0122',
    country: 'Malta',
    websiteUrl: 'https://lumen.example.com',
    accountManagerEmail: 'acct.lindqvist@fatexia.dev',
  },
  {
    name: 'Vertex Software',
    status: AdvertiserStatus.PENDING,
    contactName: 'Nadia Haddad',
    contactEmail: 'bd@vertex.example.com',
    phone: '+971 4 555 0133',
    country: 'United Arab Emirates',
    websiteUrl: 'https://vertex.example.com',
    accountManagerEmail: null,
  },
];

export interface OfferFixture {
  name: string;
  advertiserName: string;
  category: string;
  status: OfferStatus;
  defaultPayoutAmount: string;
  revenueAmount: string;
  payoutMode: PayoutMode;
  revenueModel: RevenueModel;
  trafficTypes: string[];
  featured: boolean;
  countries: string[];
  kpi: string;
  description: string;
  holdDays: number;
  capMetric: CapMetric;
  capLimit: string;
  // Only APPROVED offers satisfy the four-field activation gate; PENDING ones are
  // deliberately left incomplete so the gate is exercised by real data.
  activated: boolean;
}

export const OFFERS: OfferFixture[] = [
  {
    name: SAMPLE_OFFER_NAME,
    advertiserName: SAMPLE_ADVERTISER_NAME,
    category: 'Finance',
    status: OfferStatus.APPROVED,
    defaultPayoutAmount: '25.00',
    revenueAmount: '35.00',
    payoutMode: PayoutMode.CPA,
    revenueModel: RevenueModel.RPA,
    trafficTypes: ['search', 'social'],
    featured: true,
    countries: ['US', 'CA'],
    kpi: 'Approved card application, no chargeback within 30 days.',
    description: 'Credit card signup flow with instant decision. Strong converter on search and social.',
    holdDays: 30,
    capMetric: CapMetric.CONVERSIONS,
    capLimit: '500',
    activated: true,
  },
  {
    name: 'Acme Personal Loan Lead',
    advertiserName: SAMPLE_ADVERTISER_NAME,
    category: 'Finance',
    status: OfferStatus.APPROVED,
    defaultPayoutAmount: '18.00',
    revenueAmount: '26.50',
    payoutMode: PayoutMode.CPL,
    revenueModel: RevenueModel.RPA,
    trafficTypes: ['search', 'email'],
    featured: false,
    countries: ['US'],
    kpi: 'Valid lead with verified phone and income above $30k.',
    description: 'Personal loan lead-gen form. Rejects duplicate phone numbers within 90 days.',
    holdDays: 21,
    capMetric: CapMetric.CONVERSIONS,
    capLimit: '300',
    activated: true,
  },
  {
    name: 'Northwind Vitamin Trial',
    advertiserName: 'Northwind Health',
    category: 'Nutra & Health',
    status: OfferStatus.APPROVED,
    defaultPayoutAmount: '32.00',
    revenueAmount: '48.00',
    payoutMode: PayoutMode.CPS,
    revenueModel: RevenueModel.RPA,
    trafficTypes: ['native', 'social'],
    featured: true,
    countries: ['GB', 'IE', 'AU'],
    kpi: 'Completed trial checkout with valid card.',
    description: 'Subscription trial for a daily vitamin pack. High AOV, strict on incentivised traffic.',
    holdDays: 30,
    capMetric: CapMetric.PAYOUT,
    capLimit: '10000',
    activated: true,
  },
  {
    name: 'Northwind Sleep Program',
    advertiserName: 'Northwind Health',
    category: 'Nutra & Health',
    status: OfferStatus.PAUSED,
    defaultPayoutAmount: '22.00',
    revenueAmount: '31.00',
    payoutMode: PayoutMode.CPA,
    revenueModel: RevenueModel.RPA,
    trafficTypes: ['native'],
    featured: false,
    countries: ['GB'],
    kpi: 'Program signup with valid email confirmation.',
    description: 'Sleep coaching program. Paused while the advertiser reworks the landing page.',
    holdDays: 30,
    capMetric: CapMetric.CLICKS,
    capLimit: '20000',
    activated: true,
  },
  {
    name: 'Lumen Casino First Deposit',
    advertiserName: 'Lumen Casino',
    category: 'iGaming',
    status: OfferStatus.APPROVED,
    defaultPayoutAmount: '95.00',
    revenueAmount: '140.00',
    payoutMode: PayoutMode.CPA,
    revenueModel: RevenueModel.RPA,
    trafficTypes: ['push', 'pop', 'social'],
    featured: true,
    countries: ['BR', 'TR', 'NG'],
    kpi: 'First deposit of at least $20, no bonus abuse.',
    description: 'First-time depositor payout. Highest payout on the network; watched closely for fraud.',
    holdDays: 45,
    capMetric: CapMetric.CONVERSIONS,
    capLimit: '150',
    activated: true,
  },
  {
    name: 'Lumen Sportsbook Signup',
    advertiserName: 'Lumen Casino',
    category: 'iGaming',
    status: OfferStatus.APPROVED,
    defaultPayoutAmount: '60.00',
    revenueAmount: '88.00',
    payoutMode: PayoutMode.CPA,
    revenueModel: RevenueModel.RPA,
    trafficTypes: ['social', 'influencer'],
    featured: false,
    countries: ['BR', 'IT'],
    kpi: 'Registered account with verified identity.',
    description: 'Sportsbook registration. Seasonal — expect volume swings around major fixtures.',
    holdDays: 45,
    capMetric: CapMetric.CONVERSIONS,
    capLimit: '200',
    activated: true,
  },
  {
    name: 'Vertex VPN Annual',
    advertiserName: 'Vertex Software',
    category: 'Software & VPN',
    status: OfferStatus.PENDING,
    defaultPayoutAmount: '40.00',
    revenueAmount: '58.00',
    payoutMode: PayoutMode.CPS,
    revenueModel: RevenueModel.RPA,
    trafficTypes: ['search', 'seo'],
    featured: false,
    countries: ['US', 'GB', 'DE'],
    kpi: 'Annual plan purchase, no refund within 14 days.',
    description: 'Annual VPN subscription. Awaiting postback verification before it can go live.',
    holdDays: 14,
    capMetric: CapMetric.CONVERSIONS,
    capLimit: '400',
    activated: false,
  },
  {
    name: 'Vertex Password Manager',
    advertiserName: 'Vertex Software',
    category: 'Software & VPN',
    status: OfferStatus.REJECTED,
    defaultPayoutAmount: '15.00',
    revenueAmount: '21.00',
    payoutMode: PayoutMode.CPS,
    revenueModel: RevenueModel.RPA,
    trafficTypes: ['seo'],
    featured: false,
    countries: ['US'],
    kpi: 'Paid plan purchase.',
    description: 'Rejected — the advertiser could not supply a working postback endpoint.',
    holdDays: 14,
    capMetric: CapMetric.CONVERSIONS,
    capLimit: '100',
    activated: false,
  },
];

export const PAYOUT_TYPE = PayoutType.FLAT;
export const CAP_PERIOD = CapPeriod.MONTHLY;
export const DEFAULT_TRACKING_PLATFORM = TrackingPlatform.DIRECT;

export interface AffiliateGroupFixture {
  name: string;
  description: string;
  memberEmails: string[];
}

export const AFFILIATE_GROUPS: AffiliateGroupFixture[] = [
  {
    name: 'Tier 1 Finance',
    description: 'Vetted affiliates cleared for US/CA finance offers.',
    memberEmails: [AFFILIATE_EMAIL, 'kenji.tanaka@partners.dev'],
  },
  {
    name: 'iGaming LATAM',
    description: 'Affiliates running Brazilian and LATAM gambling traffic.',
    memberEmails: ['lucas.silva@partners.dev', 'sofia.marino@partners.dev'],
  },
  {
    name: 'Watchlist',
    description: 'Under review for traffic-quality issues. Excluded from high-payout offers.',
    memberEmails: ['hana.yilmaz@partners.dev'],
  },
];

export interface SmartLinkFixture {
  name: string;
  slug: string;
  description: string;
  offerNames: string[];
  countries: string[];
  devices: string[];
}

export const SMART_LINKS: SmartLinkFixture[] = [
  {
    name: 'Finance Rotator',
    slug: 'finance-rotator',
    description: 'Rotates between live finance offers by highest payout.',
    offerNames: [SAMPLE_OFFER_NAME, 'Acme Personal Loan Lead'],
    countries: ['US', 'CA'],
    devices: ['mobile', 'desktop'],
  },
  {
    name: 'iGaming LATAM Rotator',
    slug: 'igaming-latam',
    description: 'Brazil-weighted rotation across the Lumen offers.',
    offerNames: ['Lumen Casino First Deposit', 'Lumen Sportsbook Signup'],
    countries: ['BR', 'TR'],
    devices: ['mobile'],
  },
];

export interface EmailTemplateFixture {
  templateKey: EmailTemplateKey;
  name: string;
  subject: string;
  body: string;
  availableMacros: string[];
}

export const EMAIL_TEMPLATES: EmailTemplateFixture[] = [
  {
    templateKey: EmailTemplateKey.AFFILIATE_WELCOME,
    name: 'Affiliate welcome',
    subject: 'Verify your email for {network_name}',
    body: 'Hi {affiliate_name},\n\nThanks for applying to {network_name}. First, verify your email with the code below — it expires in 15 minutes.\n\n{code}\n\nOnce verified, your application moves to review and we usually respond within one business day.\n\n— The {network_name} team',
    availableMacros: ['{affiliate_name}', '{network_name}', '{support_email}', '{code}'],
  },
  {
    templateKey: EmailTemplateKey.PASSWORD_RESET,
    name: 'Password reset',
    subject: 'Reset your {network_name} password',
    body: 'Hi {affiliate_name},\n\nUse the link below to set a new password. It expires in one hour.\n\n{reset_link}\n\nIf you did not request this, you can ignore this email.',
    availableMacros: ['{affiliate_name}', '{network_name}', '{reset_link}'],
  },
  {
    templateKey: EmailTemplateKey.ACCESS_REQUEST_APPROVED,
    name: 'Offer access approved',
    subject: 'You now have access to {offer_name}',
    body: 'Hi {affiliate_name},\n\nYour request for {offer_name} was approved. Your tracking link is ready in the portal.\n\n{offer_link}',
    availableMacros: ['{affiliate_name}', '{offer_name}', '{offer_link}', '{network_name}'],
  },
  {
    templateKey: EmailTemplateKey.ACCESS_REQUEST_REJECTED,
    name: 'Offer access declined',
    subject: 'Update on your request for {offer_name}',
    body: 'Hi {affiliate_name},\n\nWe could not approve access to {offer_name} at this time.\n\nReason: {decision_note}\n\nYour manager is happy to talk through alternatives.',
    availableMacros: ['{affiliate_name}', '{offer_name}', '{decision_note}', '{network_name}'],
  },
  {
    templateKey: EmailTemplateKey.AFFILIATE_APPROVED,
    name: 'Account approved',
    subject: 'Your {network_name} account is live',
    body: 'Hi {affiliate_name},\n\nYour account is approved — you can log in now and start sending traffic.\n\n{portal_link}\n\nA few things worth doing first:\n\n- Browse the offers you have access to and grab a tracking link\n- Set your payout method under Profile\n- Add your postback URL so your own tracker stays in sync\n\nYour manager is **{manager_name}**, and they are the person to ask about caps, payout bumps or new offers.',
    availableMacros: ['{affiliate_name}', '{network_name}', '{manager_name}', '{portal_link}'],
  },
  {
    templateKey: EmailTemplateKey.AFFILIATE_REJECTED,
    name: 'Application declined',
    subject: 'Update on your {network_name} application',
    body: 'Hi {affiliate_name},\n\nThanks for your interest in {network_name}. After reviewing your application we are not able to approve an account for you at this time.\n\nThis is not always final — traffic sources and volumes change, and you are welcome to apply again later or reply to this email if you would like to talk it through.\n\n— The {network_name} team',
    availableMacros: ['{affiliate_name}', '{network_name}', '{support_email}'],
  },
  {
    templateKey: EmailTemplateKey.AFFILIATE_SUSPENDED,
    name: 'Account suspended',
    subject: 'Your {network_name} account has been suspended',
    body: 'Hi {affiliate_name},\n\nYour account has been suspended pending a traffic-quality review. Reply to this email to discuss it with your manager.',
    availableMacros: ['{affiliate_name}', '{network_name}', '{support_email}'],
  },
  {
    templateKey: EmailTemplateKey.PAYOUT_SENT,
    name: 'Payout sent',
    subject: 'Payment {invoice_number} sent - {amount}',
    body: 'Hi {affiliate_name},\n\nYour payout has been sent. Here are the details:\n\n- Amount: **{amount}**\n- Invoice: {invoice_number}\n- Period: {period}\n- Reference: {payment_reference}\n\nDepending on your payout method it can take a few business days to arrive.',
    availableMacros: ['{affiliate_name}', '{invoice_number}', '{amount}', '{period}', '{payment_reference}'],
  },
  {
    templateKey: EmailTemplateKey.OFFER_LIVE,
    name: 'Offer is live',
    subject: '{offer_name} is now live',
    body: 'Hi {affiliate_name},\n\n**{offer_name}** is live and ready for traffic, paying **{payout}** per conversion.\n\n{offer_link}\n\nCheck the offer page for the current caps and geo targeting before you scale.',
    availableMacros: ['{affiliate_name}', '{offer_name}', '{payout}', '{offer_link}'],
  },
];

export interface IntegrationFixture {
  provider: IntegrationProvider;
  name: string;
  description: string;
  config: Record<string, unknown>;
}

// Seeded with no credentials — real keys are entered by an admin on the Integrations
// page, never checked into the repository or written by a seed script.
export const INTEGRATIONS: IntegrationFixture[] = [
  {
    provider: IntegrationProvider.IPHUB,
    name: 'IPHub',
    description: 'Residential-proxy and VPN detection. First provider in the fraud cascade.',
    config: { dailyQuota: 1000, endpoint: 'https://v2.api.iphub.info/ip' },
  },
  {
    provider: IntegrationProvider.IPAPI_IS,
    name: 'ipapi.is',
    description: 'Second provider in the proxy-detection cascade, used when IPHub is exhausted.',
    config: { dailyQuota: 1000, endpoint: 'https://api.ipapi.is' },
  },
  {
    provider: IntegrationProvider.IPQS,
    name: 'IPQualityScore',
    description: 'Final fallback for proxy detection. Monthly quota rather than daily.',
    config: { monthlyQuota: 5000, endpoint: 'https://ipqualityscore.com/api/json/ip' },
  },
  {
    provider: IntegrationProvider.MAXMIND,
    name: 'MaxMind GeoIP2',
    description: 'License key for automated GeoLite2 City/ASN database updates.',
    config: { databases: ['GeoLite2-City', 'GeoLite2-ASN'] },
  },
  {
    provider: IntegrationProvider.SMTP,
    name: 'Brevo',
    description: 'Sends every transactional email template through the Brevo transactional email API.',
    config: {},
  },
  {
    provider: IntegrationProvider.PAYPAL,
    name: 'PayPal Payouts',
    description: 'Mass-payout API for affiliates who chose PayPal.',
    config: { mode: 'sandbox' },
  },
  {
    provider: IntegrationProvider.WISE,
    name: 'Wise',
    description: 'Bank transfer rails for affiliates paid by wire.',
    config: { mode: 'sandbox' },
  },
  {
    provider: IntegrationProvider.S3,
    name: 'Amazon S3',
    description: 'Stores offer thumbnails and news cover images, served through a CDN.',
    config: { bucket: '', region: '', cdnBaseUrl: '' },
  },
];

export interface NewsFixture {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  pinned: boolean;
  publishedDaysAgo: number | null;
}

export const NEWS_POSTS: NewsFixture[] = [
  {
    title: 'Lumen Casino payout raised to $95',
    slug: 'lumen-payout-raise',
    excerpt: 'First-deposit payout is up from $80 for all approved LATAM traffic.',
    body: 'Effective immediately, Lumen Casino First Deposit pays $95 per approved first-time depositor, up from $80.\n\nThe increase applies to Brazil, Türkiye and Nigeria. Caps are unchanged at 150 conversions per month, so speak to your manager before scaling hard.',
    pinned: true,
    publishedDaysAgo: 4,
  },
  {
    title: 'New sub-id reporting is live',
    slug: 'sub-id-reporting',
    excerpt: 'Pass sub1, sub2 and sub3 on any tracking link and break your traffic down by source.',
    body: 'Every tracking link now accepts sub1, sub2 and sub3 parameters. They are captured on the click and carried through to the conversion, so you can break performance down by placement, creative or campaign in Reports → Sub-ID Tracking.',
    pinned: false,
    publishedDaysAgo: 11,
  },
  {
    title: 'Payment cycle moving to Net-30',
    slug: 'net-30-payments',
    excerpt: 'Approved conversions clear the hold window 30 days after approval.',
    body: 'From next month the network runs a Net-30 payout cycle. A conversion becomes payout-eligible 30 days after it is approved, and batches are issued once your balance clears the $50 minimum.',
    pinned: false,
    publishedDaysAgo: 25,
  },
  {
    title: 'Q3 vertical outlook',
    slug: 'q3-vertical-outlook',
    excerpt: 'Draft — internal notes on where we expect volume next quarter.',
    body: 'Draft post. Finance and iGaming are carrying volume; nutra is soft after the landing-page rework at Northwind.',
    pinned: false,
    publishedDaysAgo: null,
  },
];

// Geo pool for generated traffic. Weighted implicitly by repetition — US appears more
// often, which is what real network traffic looks like.
export const TRAFFIC_COUNTRIES = ['US', 'US', 'US', 'GB', 'BR', 'BR', 'IT', 'TR', 'NG', 'JP', 'DE', 'CA', 'IN'] as const;

/**
 * Real, publicly-routable consumer IP ranges per country.
 *
 * The seed used to synthesise `203.0.x.x` addresses — TEST-NET-3, which MaxMind has no
 * record for — and pick a country independently of them. The stored country and the
 * stored IP therefore contradicted each other, and re-running a geo lookup over seeded
 * rows produced nothing. Using addresses that genuinely resolve means the seed exercises
 * the real geo pipeline and every seeded row gets a city and region that agree with its
 * country.
 *
 * These are ISP netblocks, not hosts: nothing here is contacted, they are only ever
 * passed to a local .mmdb lookup.
 */
export const COUNTRY_IP_POOLS: Record<string, readonly string[]> = {
  US: ['24.60.1.25', '68.80.14.7', '73.162.90.11', '98.208.74.149', '76.77.236.150'],
  GB: ['81.135.20.14', '86.130.44.9', '51.148.6.31', '2.24.90.140'],
  BR: ['189.6.44.10', '177.98.130.22', '191.32.16.9', '200.150.90.4'],
  IT: ['79.14.60.22', '93.32.140.7', '151.42.90.18', '82.51.30.5'],
  TR: ['88.240.16.9', '78.180.44.20', '95.70.130.6', '85.105.90.14'],
  NG: ['105.112.30.8', '197.210.44.16', '41.58.90.5', '102.89.20.11'],
  JP: ['126.24.90.7', '133.106.44.19', '210.153.30.6', '60.34.120.15'],
  DE: ['79.194.60.12', '91.44.130.8', '84.164.90.21', '87.138.20.5'],
  CA: ['24.114.60.9', '99.246.130.17', '70.51.90.6', '142.116.20.13'],
  IN: ['49.36.44.10', '117.196.130.7', '106.208.90.19', '43.241.20.4'],
};

// Device/OS/browser are drawn together rather than independently: picking each from
// its own pool produces impossible rows like "desktop · Android · Safari", which reads
// as broken data the moment anyone opens the click log.
export interface DeviceProfile {
  deviceType: string;
  deviceBrand: string | null;
  os: string;
  osVersion: string;
  browsers: readonly string[];
  browserVersion: string;
}

// `deviceBrand` is null on desktops for the same reason UAParser returns no vendor for
// them: a desktop user agent does not carry a manufacturer.
export const TRAFFIC_DEVICE_PROFILES: readonly DeviceProfile[] = [
  { deviceType: 'mobile', deviceBrand: 'Samsung', os: 'Android', osVersion: '14', browsers: ['Chrome', 'Chrome', 'Samsung Internet', 'Firefox'], browserVersion: '131.0' },
  { deviceType: 'mobile', deviceBrand: 'Xiaomi', os: 'Android', osVersion: '13', browsers: ['Chrome', 'Samsung Internet'], browserVersion: '130.0' },
  { deviceType: 'mobile', deviceBrand: 'Apple', os: 'iOS', osVersion: '18.1', browsers: ['Safari', 'Safari', 'Chrome'], browserVersion: '18.1' },
  { deviceType: 'desktop', deviceBrand: null, os: 'Windows', osVersion: '10.0', browsers: ['Chrome', 'Chrome', 'Edge', 'Firefox'], browserVersion: '131.0' },
  { deviceType: 'desktop', deviceBrand: 'Apple', os: 'macOS', osVersion: '15.1', browsers: ['Safari', 'Chrome', 'Firefox'], browserVersion: '18.1' },
  { deviceType: 'desktop', deviceBrand: null, os: 'Linux', osVersion: '6.8', browsers: ['Firefox', 'Chrome'], browserVersion: '133.0' },
  { deviceType: 'tablet', deviceBrand: 'Apple', os: 'iOS', osVersion: '18.0', browsers: ['Safari', 'Chrome'], browserVersion: '18.0' },
  { deviceType: 'tablet', deviceBrand: 'Samsung', os: 'Android', osVersion: '14', browsers: ['Chrome'], browserVersion: '131.0' },
] as const;

export const TRAFFIC_SUB_IDS = ['fb_camp_01', 'fb_camp_02', 'push_a', 'push_b', 'seo_home', 'native_x', ''] as const;
export const TRAFFIC_ASNS = [
  'AS15169 Google LLC',
  'AS16509 Amazon.com, Inc.',
  'AS7922 Comcast Cable',
  'AS3320 Deutsche Telekom AG',
  'AS28573 Claro NXT',
  'AS9121 Turk Telekom',
  'AS14061 DigitalOcean, LLC',
] as const;
