import { createHash } from 'crypto';

// Deterministic, stable UUIDs derived from a semantic key. Re-running the seed
// produces the SAME ids for the same keys, so `repository.save()` updates existing
// rows instead of inserting duplicates — this is what makes the seed idempotent.
// Formatted as a valid v5-style UUID (version nibble + RFC-4122 variant bits) so it
// satisfies Postgres `uuid` columns.
export function seedUuid(key: string): string {
  const h = createHash('sha1').update(`fatexia-seed:${key}`).digest('hex');
  const variant = ((parseInt(h[16]!, 16) & 0x3) | 0x8).toString(16);
  return [h.slice(0, 8), h.slice(8, 12), `5${h.slice(13, 16)}`, `${variant}${h.slice(17, 20)}`, h.slice(20, 32)].join(
    '-',
  );
}

export const ids = {
  user: (email: string) => seedUuid(`user:${email}`),
  affiliate: (email: string) => seedUuid(`affiliate:${email}`),
  affiliateGroup: (name: string) => seedUuid(`affiliate-group:${name}`),
  affiliatePoint: (key: string) => seedUuid(`affiliate-point:${key}`),
  manager: (email: string) => seedUuid(`manager:${email}`),
  advertiser: (name: string) => seedUuid(`advertiser:${name}`),
  offerCategory: (name: string) => seedUuid(`offer-category:${name}`),
  offer: (name: string) => seedUuid(`offer:${name}`),
  payoutRule: (offerName: string, index = 0) => seedUuid(`payout-rule:${offerName}:${index}`),
  offerCap: (offerName: string, index = 0) => seedUuid(`offer-cap:${offerName}:${index}`),
  accessRequest: (offerName: string, email: string) => seedUuid(`access-request:${offerName}:${email}`),
  smartLink: (slug: string) => seedUuid(`smart-link:${slug}`),
  click: (index: number) => seedUuid(`click:${index}`),
  conversion: (index: number) => seedUuid(`conversion:${index}`),
  postbackLog: (key: string) => seedUuid(`postback-log:${key}`),
  invoice: (key: string) => seedUuid(`invoice:${key}`),
  subscription: (advertiserName: string) => seedUuid(`subscription:${advertiserName}`),
  message: (key: string) => seedUuid(`message:${key}`),
  notification: (key: string) => seedUuid(`notification:${key}`),
  newsPost: (slug: string) => seedUuid(`news:${slug}`),
  emailTemplate: (key: string) => seedUuid(`email-template:${key}`),
  integration: (provider: string) => seedUuid(`integration:${provider}`),
};
