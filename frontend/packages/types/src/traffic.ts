// Clicks, conversions and postback logs — the tables the Tracker writes and the
// Admin portal reads.

export type ClickQualityStatus = 'GOOD' | 'SUSPECT' | 'BLOCKED' | 'UNSCORED';

/**
 * Everything GeoLite2 resolved about the visitor's address.
 *
 * Shared by the admin and affiliate click rows, because both carry all of it — a
 * visitor's location is the affiliate's own traffic. The fields that stay network-side
 * are the *fraud reasoning* (ASN, registered country, proxy traits, risk score), and
 * those live on `ClickLog` alone. Mirrors `ClickGeoDto` on the backend.
 */
export interface ClickGeo {
  countryCode: string | null;
  countryName: string | null;
  continentCode: string | null;
  continentName: string | null;
  city: string | null;
  /** GeoNames id for the city — the stable handle behind a name with spelling variants. */
  cityGeonameId: number | null;
  region: string | null;
  regionCode: string | null;
  /** Second-level subdivision — a county or district, where MaxMind has one. */
  region2: string | null;
  region2Code: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  /** MaxMind's confidence in the coordinates, in km. 1000 means "somewhere in this country". */
  accuracyRadiusKm: number | null;
  /** IANA zone, e.g. `America/New_York`. */
  timeZone: string | null;
  /** US metro/DMA code; null everywhere else. */
  metroCode: number | null;
  /** Pre-composed "City, ST, US" / "Local network" / "Unknown", built server-side so
   *  an unresolvable address reads as information rather than as a missing value. */
  geoLabel: string;
}

export interface ClickLog extends ClickGeo {
  id: string;
  /** The number the advertiser saw as `click_id` — what a postback dispute quotes. */
  refId: number;
  offerId: string;
  offerName: string | null;
  affiliateId: string | null;
  affiliateName: string | null;
  ip: string;
  userAgent: string | null;
  /** Where the block is registered. A mismatch against `countryCode` reads as a VPN. */
  registeredCountryCode: string | null;
  deviceType: string | null;
  deviceBrand: string | null;
  os: string | null;
  osVersion: string | null;
  browser: string | null;
  browserVersion: string | null;
  asn: string | null;
  /** The same ASN split apart — the number is what a filter can actually match on. */
  asnNumber: number | null;
  asnOrganization: string | null;
  /** MaxMind's own legacy traits; null when GeoLite2 does not set them, which is usual. */
  isAnonymousProxy: boolean | null;
  isSatelliteProvider: boolean | null;
  isDatacenter: boolean;
  // null = the proxy check never resolved, which is not the same as a confirmed false.
  isProxyOrVpn: boolean | null;
  riskScore: number;
  /** First click for this offer from this IP within 24h — decided at write time so
   *  this and the aggregate `uniqueClicks` metric share one definition. */
  isUnique: boolean;
  qualityStatus: ClickQualityStatus;
  subId1: string | null;
  subId2: string | null;
  subId3: string | null;
  subId4: string | null;
  subId5: string | null;
  subId6: string | null;
  subId7: string | null;
  subId8: string | null;
  referer: string | null;
  createdAt: string;
}

export type ConversionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'DUPLICATE' | 'PAID' | 'CHARGEBACK';

export interface Conversion {
  id: string;
  /** The conversion's own short number — what a dispute quotes. */
  refId: number;
  clickId: string | null;
  /** The click's short number: what the advertiser was given and posted back. */
  clickRefId: number | null;
  offerId: string;
  offerName: string | null;
  affiliateId: string | null;
  affiliateName: string | null;
  revenueAmount: number;
  payoutAmount: number;
  profitAmount: number;
  currency: string;
  status: ConversionStatus;
  isDuplicate: boolean;
  isOrphan: boolean;
  leadRiskScore: number;
  ctitMs: number | null;
  subId1: string | null;
  subId2: string | null;
  subId3: string | null;
  countryCode: string | null;
  transactionId: string | null;
  approvedAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface ConversionTotals {
  count: number;
  revenue: number;
  payout: number;
  profit: number;
}

export type PostbackDirection = 'INBOUND' | 'OUTBOUND';

export interface PostbackLog {
  id: string;
  conversionId: string | null;
  offerId: string | null;
  offerName: string | null;
  affiliateId: string | null;
  affiliateName: string | null;
  direction: PostbackDirection;
  url: string | null;
  payload: Record<string, unknown>;
  responseStatus: number | null;
  success: boolean;
  errorMessage: string | null;
  attemptCount: number;
  sourceIp: string | null;
  createdAt: string;
}
