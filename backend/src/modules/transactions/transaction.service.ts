import { NotFoundError } from '../../common/errors';
import { paginate, type Paginated } from '../../common/pagination';
import { affiliateNames } from '../../common/entity-names';
import { affiliateRepository } from '../affiliates/affiliate.repository';
import { affiliateService } from '../affiliates/affiliate.service';
import { networkSettingService } from '../network-settings/network-setting.service';
import { notificationService } from '../notifications/notification.service';
import { NotificationCategory, NotificationLevel } from '../notifications/notification.entity';
import { transactionRepository } from './transaction.repository';
import { TransactionType } from './transaction.entity';
import {
  toTransactionDto,
  type RecordAdjustmentDto,
  type TransactionDto,
  type TransactionFiltersDto,
  type TransactionSummaryDto,
} from './transaction.dto';

export const transactionService = {
  async getTransactions(filters: TransactionFiltersDto): Promise<Paginated<TransactionDto>> {
    const [rows, total] = await transactionRepository.findAll(filters);
    const names = await affiliateNames(rows.map((row) => row.affiliateId));
    return paginate(
      rows.map((row) => toTransactionDto(row, names.get(row.affiliateId) ?? null)),
      total,
      filters,
    );
  },

  // Affiliate self-service: their own ledger, scoped from the JWT rather than from a
  // client-supplied filter. Read-only — an affiliate never writes to this table.
  async getOwnTransactions(userId: string, filters: TransactionFiltersDto): Promise<Paginated<TransactionDto>> {
    const affiliateId = await affiliateService.resolveAffiliateId(userId);
    return this.getTransactions({ ...filters, affiliateId });
  },

  async getSummary(filters: TransactionFiltersDto): Promise<TransactionSummaryDto[]> {
    const rows = await transactionRepository.summary(filters);
    return rows.map((row) => ({
      type: row.type as TransactionType,
      amount: Number(Number(row.amount ?? 0).toFixed(2)),
      count: Number(row.count),
    }));
  },

  /**
   * A bonus, a penalty, or a correction.
   *
   * Deliberately does not touch conversions or invoices: those carry the money the
   * network computed, and an adjustment is the network saying something different
   * happened. Keeping it as its own ledger row means the computed figures stay
   * reconcilable against their source rows and the exception stays visible as one.
   */
  async recordAdjustment(dto: RecordAdjustmentDto, adminUserId: string): Promise<TransactionDto> {
    const affiliate = await affiliateRepository.findById(dto.affiliateId);
    if (!affiliate) {
      throw new NotFoundError('Affiliate not found');
    }
    const settings = await networkSettingService.getSettings();
    const currency = dto.currency ?? settings.defaultCurrency;

    const row = await transactionRepository.create({
      affiliateId: dto.affiliateId,
      invoiceId: null,
      invoiceNumber: null,
      type: TransactionType.MANUAL_ADJUSTMENT,
      amount: dto.amount.toFixed(2),
      currency,
      reference: dto.reference ?? null,
      description: dto.description,
      createdByUserId: adminUserId,
    });

    // The affiliate finds out from us rather than from a number that changed overnight.
    notificationService.safeNotify(
      notificationService.notifyAffiliate(dto.affiliateId, {
        level: dto.amount > 0 ? NotificationLevel.SUCCESS : NotificationLevel.WARNING,
        category: NotificationCategory.BILLING,
        title: dto.amount > 0 ? 'Account credited' : 'Account adjusted',
        body: `${dto.amount > 0 ? '+' : ''}${dto.amount.toFixed(2)} ${currency} — ${dto.description}`,
        link: '/payments',
      }),
    );

    const names = await affiliateNames([dto.affiliateId]);
    return toTransactionDto(row, names.get(dto.affiliateId) ?? null);
  },
};
