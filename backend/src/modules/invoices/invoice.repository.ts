import { AppDataSource } from '../../infra/database/data-source';
import { offsetOf } from '../../common/pagination';
import { Conversion, ConversionStatus } from '../conversions/conversion.entity';
import { Invoice } from './invoice.entity';
import type { InvoiceFiltersDto } from './invoice.dto';

const repository = AppDataSource.getRepository(Invoice);

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

  findById(id: string): Promise<Invoice | null> {
    return repository.findOne({ where: { id } });
  },

  countAll(): Promise<number> {
    return repository.count();
  },

  create(data: Partial<Invoice>): Promise<Invoice> {
    return repository.save(repository.create(data));
  },

  async update(id: string, fields: Partial<Invoice>): Promise<void> {
    await repository.update({ id }, fields);
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
