import { In } from 'typeorm';
import { AppDataSource } from '../infra/database/data-source';
import { Offer } from '../modules/offers/offer.entity';
import { Advertiser } from '../modules/advertisers/advertiser.entity';
import { Affiliate } from '../modules/affiliates/affiliate.entity';

/**
 * Batched id → display-name lookups.
 *
 * Every list surface in the Admin portal shows names next to the ids stored on
 * clicks/conversions/invoices, but those tables hold ids only (denormalizing a name
 * onto a click row would go stale the moment an offer is renamed). Resolving one name
 * per row would be N+1; these helpers take the whole page's ids and issue one query.
 */

export type NameMap = Map<string, string>;

async function lookup<T extends { id: string }>(
  entity: new () => T,
  ids: string[],
  label: (row: T) => string,
): Promise<NameMap> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const rows = await AppDataSource.getRepository(entity).find({ where: { id: In(unique) } as never });
  return new Map(rows.map((row) => [row.id, label(row)]));
}

export function offerNames(ids: string[]): Promise<NameMap> {
  return lookup(Offer, ids, (offer) => offer.name);
}

export function advertiserNames(ids: string[]): Promise<NameMap> {
  return lookup(Advertiser, ids, (advertiser) => advertiser.name);
}

// Falls back to the company name, then the id itself — an affiliate row created
// before the profile fields existed can have a null fullName, and a blank cell in a
// report is worse than a raw id.
export function affiliateNames(ids: string[]): Promise<NameMap> {
  return lookup(Affiliate, ids, (affiliate) => affiliate.fullName ?? affiliate.companyName ?? affiliate.id);
}
