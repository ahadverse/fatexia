import type { EntityManager, SelectQueryBuilder } from 'typeorm';
import { AppDataSource } from '../../infra/database/data-source';
import { offsetOf } from '../../common/pagination';
import { Transaction } from './transaction.entity';
import type { TransactionFiltersDto } from './transaction.dto';

const repository = AppDataSource.getRepository(Transaction);

// Lets a caller enlist a write in an outer transaction. The invoice service records
// its ledger rows this way, so an invoice and the row describing it commit together
// or not at all.
function repo(manager?: EntityManager) {
  return manager ? manager.getRepository(Transaction) : repository;
}

function applyFilters(
  qb: SelectQueryBuilder<Transaction>,
  filters: TransactionFiltersDto,
): SelectQueryBuilder<Transaction> {
  if (filters.affiliateId) {
    qb.andWhere('transaction."affiliateId" = :affiliateId', { affiliateId: filters.affiliateId });
  }
  if (filters.invoiceId) {
    qb.andWhere('transaction."invoiceId" = :invoiceId', { invoiceId: filters.invoiceId });
  }
  if (filters.type) {
    qb.andWhere('transaction.type = :type', { type: filters.type });
  }
  if (filters.dateFrom) {
    qb.andWhere('transaction."createdAt" >= :dateFrom', { dateFrom: filters.dateFrom });
  }
  if (filters.dateTo) {
    qb.andWhere('transaction."createdAt" <= :dateTo', { dateTo: filters.dateTo });
  }
  return qb;
}

export interface TransactionSummaryRow {
  type: string;
  amount: string | null;
  count: string;
}

export const transactionRepository = {
  findAll(filters: TransactionFiltersDto): Promise<[Transaction[], number]> {
    return applyFilters(repository.createQueryBuilder('transaction'), filters)
      .orderBy('transaction."createdAt"', 'DESC')
      .skip(offsetOf(filters))
      .take(filters.pageSize)
      .getManyAndCount();
  },

  // Grouped in SQL over every matching row, so the tiles above the table describe the
  // whole filtered set rather than the 25 rows currently rendered.
  summary(filters: TransactionFiltersDto): Promise<TransactionSummaryRow[]> {
    return applyFilters(repository.createQueryBuilder('transaction'), filters)
      .select('transaction.type', 'type')
      .addSelect('SUM(transaction.amount)', 'amount')
      .addSelect('COUNT(*)', 'count')
      .groupBy('transaction.type')
      .getRawMany<TransactionSummaryRow>();
  },

  create(data: Partial<Transaction>, manager?: EntityManager): Promise<Transaction> {
    const target = repo(manager);
    return target.save(target.create(data));
  },
};
