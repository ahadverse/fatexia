import { NotFoundError, ValidationError } from '../../common/errors';
import { paginate, type Paginated } from '../../common/pagination';
import { affiliateNames } from '../../common/entity-names';
import { conversionRepository } from '../conversions/conversion.repository';
import { affiliateService } from '../affiliates/affiliate.service';
import { networkSettingService } from '../network-settings/network-setting.service';
import { notificationService } from '../notifications/notification.service';
import { NotificationCategory, NotificationLevel } from '../notifications/notification.entity';
import { invoiceRepository } from './invoice.repository';
import { InvoiceStatus } from './invoice.entity';
import {
  toInvoiceDto,
  type GeneratePayoutBatchDto,
  type InvoiceDto,
  type InvoiceFiltersDto,
  type PendingBalanceDto,
  type UpdateInvoiceStatusDto,
} from './invoice.dto';

// Sequential, human-readable, and stable across a batch run. Derived from the total
// invoice count rather than a random id so support can quote "INV-000042" over chat.
function invoiceNumber(sequence: number): string {
  return `INV-${String(sequence).padStart(6, '0')}`;
}

function holdCutoff(holdDays: number): Date {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - holdDays);
  return cutoff;
}

export const invoiceService = {
  async getInvoices(filters: InvoiceFiltersDto): Promise<Paginated<InvoiceDto>> {
    const [rows, total] = await invoiceRepository.findAll(filters);
    const names = await affiliateNames(rows.map((r) => r.affiliateId));
    return paginate(
      rows.map((row) => toInvoiceDto(row, names.get(row.affiliateId) ?? null)),
      total,
      filters,
    );
  },

  // Affiliate self-service: their own invoices only, scoped from the JWT. The invoice
  // shape is already payout-side (an affiliate's own earnings), so no separate
  // projection is needed — but the filter must never come from the client.
  async getOwnInvoices(userId: string, filters: InvoiceFiltersDto): Promise<Paginated<InvoiceDto>> {
    const affiliateId = await affiliateService.resolveAffiliateId(userId);
    return this.getInvoices({ ...filters, affiliateId });
  },

  /**
   * What this affiliate is currently owed.
   *
   * Recomputed from their conversions on every read rather than stored, so it can
   * never drift from the rows behind it — the same query the admin payout preview
   * uses, narrowed to one affiliate.
   */
  async getOwnBalance(userId: string): Promise<PendingBalanceDto> {
    const affiliateId = await affiliateService.resolveAffiliateId(userId);
    const settings = await networkSettingService.getSettings();
    const balances = await invoiceRepository.eligibleBalances(holdCutoff(settings.defaultHoldDays));
    const mine = balances.find((balance) => balance.affiliateId === affiliateId);

    const eligibleAmount = Number(Number(mine?.amount ?? 0).toFixed(2));
    return {
      affiliateId,
      affiliateName: null,
      eligibleAmount,
      eligibleConversions: Number(mine?.count ?? 0),
      meetsThreshold: eligibleAmount >= settings.minimumPayoutThreshold,
    };
  },

  async getInvoice(id: string): Promise<InvoiceDto> {
    const invoice = await invoiceRepository.findById(id);
    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }
    const names = await affiliateNames([invoice.affiliateId]);
    return toInvoiceDto(invoice, names.get(invoice.affiliateId) ?? null);
  },

  // What a payout run would pick up right now, per affiliate. Read-only — this is the
  // preview an admin sees before triggering a batch.
  async getPendingBalances(): Promise<PendingBalanceDto[]> {
    const settings = await networkSettingService.getSettings();
    const balances = await invoiceRepository.eligibleBalances(holdCutoff(settings.defaultHoldDays));
    const names = await affiliateNames(balances.map((b) => b.affiliateId));

    return balances
      .map((balance) => {
        const eligibleAmount = Number(Number(balance.amount ?? 0).toFixed(2));
        return {
          affiliateId: balance.affiliateId,
          affiliateName: names.get(balance.affiliateId) ?? null,
          eligibleAmount,
          eligibleConversions: Number(balance.count),
          meetsThreshold: eligibleAmount >= settings.minimumPayoutThreshold,
        };
      })
      .sort((a, b) => b.eligibleAmount - a.eligibleAmount);
  },

  /**
   * Builds one invoice per affiliate from their payout-eligible conversions.
   *
   * The amount is summed from the conversion rows themselves and each included row is
   * stamped with the invoice id in the same pass, so a conversion can never land on
   * two batches and the invoice total always reconciles against its members. Affiliates
   * below the network's minimum threshold are skipped rather than invoiced for a
   * trivial amount.
   */
  async generateBatch(dto: GeneratePayoutBatchDto): Promise<InvoiceDto[]> {
    const periodFrom = new Date(dto.periodFrom);
    const periodTo = new Date(dto.periodTo);
    if (Number.isNaN(periodFrom.getTime()) || Number.isNaN(periodTo.getTime())) {
      throw new ValidationError('periodFrom and periodTo must be valid dates');
    }
    if (periodFrom > periodTo) {
      throw new ValidationError('periodFrom must be on or before periodTo');
    }

    const settings = await networkSettingService.getSettings();
    const cutoff = holdCutoff(settings.defaultHoldDays);

    let balances = await invoiceRepository.eligibleBalances(cutoff);
    if (dto.affiliateIds && dto.affiliateIds.length > 0) {
      const wanted = new Set(dto.affiliateIds);
      balances = balances.filter((b) => wanted.has(b.affiliateId));
    }

    const payable = balances.filter((b) => Number(b.amount ?? 0) >= settings.minimumPayoutThreshold);
    if (payable.length === 0) {
      throw new ValidationError('No affiliates currently meet the minimum payout threshold');
    }

    let sequence = await invoiceRepository.countAll();
    const created: InvoiceDto[] = [];

    for (const balance of payable) {
      const conversions = await conversionRepository.findPayable(balance.affiliateId, cutoff);
      if (conversions.length === 0) continue;

      const amount = conversions.reduce((sum, c) => sum + Number(c.payoutAmount), 0);

      sequence += 1;
      const invoice = await invoiceRepository.create({
        invoiceNumber: invoiceNumber(sequence),
        affiliateId: balance.affiliateId,
        periodFrom,
        periodTo,
        amount: amount.toFixed(2),
        currency: settings.defaultCurrency,
        conversionCount: conversions.length,
        status: InvoiceStatus.PENDING,
        paymentMethod: dto.paymentMethod,
      });

      await conversionRepository.markInvoiced(
        conversions.map((c) => c.id),
        invoice.id,
      );

      notificationService.safeNotify(
        notificationService.notifyAffiliate(invoice.affiliateId, {
          level: NotificationLevel.INFO,
          category: NotificationCategory.BILLING,
          title: 'Invoice generated',
          body: `${invoice.invoiceNumber} for ${amount.toFixed(2)} ${settings.defaultCurrency} covering ${conversions.length} conversions.`,
          link: '/payments',
        }),
      );

      created.push(await this.getInvoice(invoice.id));
    }

    return created;
  },

  // Marking an invoice PAID is what moves its conversions to PAID — the two are
  // never updated independently, so "paid" always means the same thing on both.
  async updateStatus(id: string, dto: UpdateInvoiceStatusDto): Promise<InvoiceDto> {
    const invoice = await invoiceRepository.findById(id);
    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    const becomingPaid = dto.status === InvoiceStatus.PAID && invoice.status !== InvoiceStatus.PAID;
    const paidAt = becomingPaid ? new Date() : invoice.paidAt;

    await invoiceRepository.update(id, {
      status: dto.status,
      paidAt,
      ...(dto.paymentReference !== undefined && { paymentReference: dto.paymentReference }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
    });

    if (becomingPaid) {
      await conversionRepository.markPaid(id, paidAt!);

      // Money actually moved — the single most useful thing to tell an affiliate.
      notificationService.safeNotify(
        notificationService.notifyAffiliate(invoice.affiliateId, {
          level: NotificationLevel.SUCCESS,
          category: NotificationCategory.BILLING,
          title: 'Payment sent',
          body: `${invoice.invoiceNumber} for ${Number(invoice.amount).toFixed(2)} ${invoice.currency} has been paid.`,
          link: '/payments',
        }),
      );
    }

    return this.getInvoice(id);
  },
};
