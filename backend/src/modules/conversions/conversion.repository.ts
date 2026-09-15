import type { EntityManager, SelectQueryBuilder } from 'typeorm';
import { AppDataSource } from '../../infra/database/data-source';
import { offsetOf } from '../../common/pagination';
import { applyManagerScope } from '../../common/manager-scope-sql';
import { Conversion, ConversionStatus } from './conversion.entity';
import type { ConversionFiltersDto } from './conversion.dto';

const repository = AppDataSource.getRepository(Conversion);

// Lets the billing paths run their reads and writes inside one database transaction —
// an invoice and the stamp that binds its conversions to it must commit together.
function repo(manager?: EntityManager) {
  return manager ? manager.getRepository(Conversion) : repository;
}

function applyFilters(qb: SelectQueryBuilder<Conversion>, filters: ConversionFiltersDto): SelectQueryBuilder<Conversion> {
  if (filters.offerId) {
    qb.andWhere('conversion."offerId" = :offerId', { offerId: filters.offerId });
  }
  if (filters.affiliateId) {
    qb.andWhere('conversion."affiliateId" = :affiliateId', { affiliateId: filters.affiliateId });
  }
  if (filters.clickId) {
    qb.andWhere('conversion."clickId" = :clickId', { clickId: filters.clickId });
  }
  applyManagerScope(qb, 'conversion', filters.managerScopeId);
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
  //
  // `period` restricts the rows to conversions that happened inside the invoice's own
  // window. It is optional only so a caller can deliberately sweep everything unbilled;
  // the batch always passes one, because an invoice labelled "August" that carries
  // July's conversions reconciles against nothing a human can check.
  //
  // Scoped on `createdAt` — when the conversion happened — not `approvedAt`, which is
  // when an admin got round to it. That matches how every report filters by date, so
  // an August invoice totals the same as an August report.
  findPayable(
    affiliateId: string,
    eligibleBefore: Date,
    period?: { from: Date; to: Date },
    manager?: EntityManager,
  ): Promise<Conversion[]> {
    const qb = repo(manager)
      .createQueryBuilder('conversion')
      .where('conversion."affiliateId" = :affiliateId', { affiliateId })
      .andWhere('conversion.status = :status', { status: ConversionStatus.APPROVED })
      .andWhere('conversion."invoiceId" IS NULL')
      .andWhere('conversion."approvedAt" IS NOT NULL')
      .andWhere('conversion."approvedAt" <= :eligibleBefore', { eligibleBefore });

    if (period) {
      qb.andWhere('conversion."createdAt" >= :periodFrom', { periodFrom: period.from }).andWhere(
        'conversion."createdAt" <= :periodTo',
        { periodTo: period.to },
      );
    }

    return qb.getMany();
  },

  async markInvoiced(ids: string[], invoiceId: string, manager?: EntityManager): Promise<void> {
    if (ids.length === 0) return;
    await repo(manager)
      .createQueryBuilder()
      .update(Conversion)
      .set({ invoiceId })
      .whereInIds(ids)
      .execute();
  },

  async markPaid(invoiceId: string, paidAt: Date, manager?: EntityManager): Promise<void> {
    await repo(manager)
      .createQueryBuilder()
      .update(Conversion)
      .set({ status: ConversionStatus.PAID, paidAt })
      .where('"invoiceId" = :invoiceId', { invoiceId })
      .execute();
  },

  /**
   * Un-stamps an invoice's conversions so they return to the payable pool.
   *
   * Both payable queries filter on `invoiceId IS NULL`, so clearing the stamp is the
   * whole mechanism — the rows are picked up by the next batch on their own. Guarded on
   * status: a PAID conversion is never released, or the same money could be invoiced
   * and paid twice.
   */
  async releaseFromInvoice(invoiceId: string, manager?: EntityManager): Promise<number> {
    const result = await repo(manager)
      .createQueryBuilder()
      .update(Conversion)
      .set({ invoiceId: null })
      .where('"invoiceId" = :invoiceId', { invoiceId })
      .andWhere('status != :paid', { paid: ConversionStatus.PAID })
      .execute();
    return result.affected ?? 0;
  },
};
