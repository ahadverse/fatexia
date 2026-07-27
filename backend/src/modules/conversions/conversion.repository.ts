import type { SelectQueryBuilder } from 'typeorm';
import { AppDataSource } from '../../infra/database/data-source';
import { offsetOf } from '../../common/pagination';
import { Conversion, ConversionStatus } from './conversion.entity';
import type { ConversionFiltersDto } from './conversion.dto';

const repository = AppDataSource.getRepository(Conversion);

function applyFilters(qb: SelectQueryBuilder<Conversion>, filters: ConversionFiltersDto): SelectQueryBuilder<Conversion> {
  if (filters.offerId) {
    qb.andWhere('conversion."offerId" = :offerId', { offerId: filters.offerId });
  }
  if (filters.affiliateId) {
    qb.andWhere('conversion."affiliateId" = :affiliateId', { affiliateId: filters.affiliateId });
  }
  if (filters.status) {
    qb.andWhere('conversion.status = :status', { status: filters.status });
  }
  if (filters.countryCode) {
    qb.andWhere('conversion."countryCode" = :countryCode', { countryCode: filters.countryCode });
  }
  if (filters.subId1) {
    qb.andWhere('conversion."subId1" = :subId1', { subId1: filters.subId1 });
  }
  if (filters.isDuplicate !== undefined) {
    qb.andWhere('conversion."isDuplicate" = :isDuplicate', { isDuplicate: filters.isDuplicate });
  }
  if (filters.isOrphan !== undefined) {
    qb.andWhere('conversion."isOrphan" = :isOrphan', { isOrphan: filters.isOrphan });
  }
  if (filters.dateFrom) {
    qb.andWhere('conversion."createdAt" >= :dateFrom', { dateFrom: filters.dateFrom });
  }
  if (filters.dateTo) {
    qb.andWhere('conversion."createdAt" <= :dateTo', { dateTo: filters.dateTo });
  }
  return qb;
}

export interface ConversionTotalsRow {
  count: string;
  revenue: string | null;
  payout: string | null;
}

export const conversionRepository = {
  findAll(filters: ConversionFiltersDto): Promise<[Conversion[], number]> {
    return applyFilters(repository.createQueryBuilder('conversion'), filters)
      .orderBy('conversion."createdAt"', 'DESC')
      .skip(offsetOf(filters))
      .take(filters.pageSize)
      .getManyAndCount();
  },

  // Totals for the current filter set, computed in SQL over every matching row —
  // not just the page being displayed, which would make the footer lie.
  totals(filters: ConversionFiltersDto): Promise<ConversionTotalsRow | undefined> {
    return applyFilters(repository.createQueryBuilder('conversion'), filters)
      .select('COUNT(*)', 'count')
      .addSelect('SUM(conversion."revenueAmount")', 'revenue')
      .addSelect('SUM(conversion."payoutAmount")', 'payout')
      .getRawOne<ConversionTotalsRow>();
  },

  findById(id: string): Promise<Conversion | null> {
    return repository.findOne({ where: { id } });
  },

  // Duplicate-postback detection — a second postback for the same click_id is the
  // most common accidental double-fire (advertiser retry, reloaded pixel).
  findByClickId(clickId: string): Promise<Conversion | null> {
    return repository.findOne({ where: { clickId } });
  },

  create(data: Partial<Conversion>): Promise<Conversion> {
    return repository.save(repository.create(data));
  },

  async update(id: string, fields: Partial<Conversion>): Promise<void> {
    await repository.update({ id }, fields);
  },

  // Payout-eligible = APPROVED and past the hold window. Used by the billing module
  // to build a batch; the amount is always recomputed from these rows.
  findPayable(affiliateId: string, eligibleBefore: Date): Promise<Conversion[]> {
    return repository
      .createQueryBuilder('conversion')
      .where('conversion."affiliateId" = :affiliateId', { affiliateId })
      .andWhere('conversion.status = :status', { status: ConversionStatus.APPROVED })
      .andWhere('conversion."invoiceId" IS NULL')
      .andWhere('conversion."approvedAt" IS NOT NULL')
      .andWhere('conversion."approvedAt" <= :eligibleBefore', { eligibleBefore })
      .getMany();
  },

  async markInvoiced(ids: string[], invoiceId: string): Promise<void> {
    if (ids.length === 0) return;
    await repository
      .createQueryBuilder()
      .update(Conversion)
      .set({ invoiceId })
      .whereInIds(ids)
      .execute();
  },

  async markPaid(invoiceId: string, paidAt: Date): Promise<void> {
    await repository
      .createQueryBuilder()
      .update(Conversion)
      .set({ status: ConversionStatus.PAID, paidAt })
      .where('"invoiceId" = :invoiceId', { invoiceId })
      .execute();
  },
};
