import type { EntityManager } from 'typeorm';
import { AppDataSource } from '../../infra/database/data-source';
import { offsetOf } from '../../common/pagination';
import { Conversion, ConversionStatus } from '../conversions/conversion.entity';
import { Invoice } from './invoice.entity';
import type { InvoiceFiltersDto } from './invoice.dto';

const repository = AppDataSource.getRepository(Invoice);

// Lets a write enlist in an outer transaction — the generation path creates the
// invoice, stamps its conversions and writes its ledger row as one unit.
function repo(manager?: EntityManager) {
  return manager ? manager.getRepository(Invoice) : repository;
}

export interface EligibleBalanceRow {
  affiliateId: string;
  amount: string | null;
  count: string;
}

export const invoiceRepository = {
  findAll(filters: InvoiceFiltersDto): Promise<[Invoice[], number]> {
    const qb = repository.createQueryBuilder('invoice');
    if (filters.affiliateId) {
      qb.andWhere('invoice."affiliateId" = :affiliateId', { affiliateId: filters.affiliateId });
    }
    if (filters.status) {
      qb.andWhere('invoice.status = :status', { status: filters.status });
    }
    if (filters.dateFrom) {
      qb.andWhere('invoice."createdAt" >= :dateFrom', { dateFrom: filters.dateFrom });
    }
    if (filters.dateTo) {
      qb.andWhere('invoice."createdAt" <= :dateTo', { dateTo: filters.dateTo });
    }
    return qb
      .orderBy('invoice."createdAt"', 'DESC')
      .skip(offsetOf(filters))
      .take(filters.pageSize)
      .getManyAndCount();
  },

  findById(id: string, manager?: EntityManager): Promise<Invoice | null> {
    return repo(manager).findOne({ where: { id } });
  },

  /**
   * The next invoice number, from a Postgres sequence.
   *
   * Was derived from `COUNT(*)`, which is only correct while no invoice is ever deleted
   * and no two batches overlap — otherwise two rows claim the same number, the unique
   * index rejects the second, and a batch dies halfway through. `nextval` is atomic and
   * never hands the same value out twice. A rolled-back transaction leaves a gap in the
   * numbering, which is the normal and correct behaviour for an invoice sequence.
   */
  async nextInvoiceNumber(manager?: EntityManager): Promise<string> {
    const runner = manager ?? AppDataSource.manager;
    const rows = (await runner.query(`SELECT nextval('invoice_number_seq') AS value`)) as { value: string }[];
    return `INV-${String(rows[0]!.value).padStart(6, '0')}`;
  },

  create(data: Partial<Invoice>, manager?: EntityManager): Promise<Invoice> {
    const target = repo(manager);
    return target.save(target.create(data));
  },

  async update(id: string, fields: Partial<Invoice>, manager?: EntityManager): Promise<void> {
    await repo(manager).update({ id }, fields);
  },

  async delete(id: string, manager?: EntityManager): Promise<void> {
    await repo(manager).delete({ id });
  },

  // Payout-eligible balance per affiliate: APPROVED, not already on an invoice, and
  // past the hold window. Grouped in SQL so this scales with conversion volume.
  eligibleBalances(eligibleBefore: Date): Promise<EligibleBalanceRow[]> {
    return AppDataSource.getRepository(Conversion)
      .createQueryBuilder('conversion')
      .select('conversion."affiliateId"', 'affiliateId')
      .addSelect('SUM(conversion."payoutAmount")', 'amount')
      .addSelect('COUNT(*)', 'count')
      .where('conversion.status = :status', { status: ConversionStatus.APPROVED })
      .andWhere('conversion."invoiceId" IS NULL')
      .andWhere('conversion."affiliateId" IS NOT NULL')
      .andWhere('conversion."approvedAt" IS NOT NULL')
      .andWhere('conversion."approvedAt" <= :eligibleBefore', { eligibleBefore })
      .groupBy('conversion."affiliateId"')
      .getRawMany<EligibleBalanceRow>();
  },
};
