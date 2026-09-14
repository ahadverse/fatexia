import { NotFoundError, ValidationError } from '../../common/errors';
import { paginate, type Paginated } from '../../common/pagination';
import { affiliateNames } from '../../common/entity-names';
import { conversionRepository } from '../conversions/conversion.repository';
import { affiliateService } from '../affiliates/affiliate.service';
import { affiliateRepository } from '../affiliates/affiliate.repository';
import { networkSettingService } from '../network-settings/network-setting.service';
import { notificationService } from '../notifications/notification.service';
import { NotificationCategory, NotificationLevel } from '../notifications/notification.entity';
import { sendTemplateEmail, safeSendEmail } from '../../infra/email/brevo-mailer';
import { EmailTemplateKey } from '../email-templates/email-template.entity';
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
   * two batches and the invoice total always reconciles against its members.
   *
   * Only conversions inside the requested period are included. The threshold is then
   * tested against that period total rather than the affiliate's lifetime unbilled
   * balance — otherwise an affiliate sitting on a large balance from earlier months
   * would clear the minimum and be handed an August invoice for whatever scraps August
   * happened to hold. `ignoreThreshold` waives the minimum for the whole run.
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

    // A bare `YYYY-MM-DD` parses to midnight, so used as-is the last day of the period
    // contributes nothing and an August invoice silently drops everything that
    // converted on the 31st. Extended to end-of-day only in that case: the admin UI
    // already sends a full `…T23:59:59.999Z`, and blanket-normalising that with
    // setHours() would re-interpret it in the server's local zone and cut hours off
    // the window instead of adding them.
    const periodEnd = /^\d{4}-\d{2}-\d{2}$/.test(dto.periodTo)
      ? new Date(`${dto.periodTo}T23:59:59.999Z`)
      : periodTo;
    const period = { from: periodFrom, to: periodEnd };

    const settings = await networkSettingService.getSettings();
    const cutoff = holdCutoff(settings.defaultHoldDays);

    let balances = await invoiceRepository.eligibleBalances(cutoff);
    if (dto.affiliateIds && dto.affiliateIds.length > 0) {
      const wanted = new Set(dto.affiliateIds);
      balances = balances.filter((b) => wanted.has(b.affiliateId));
    }

    if (balances.length === 0) {
      throw new ValidationError('No affiliates currently have payout-eligible conversions');
    }

    let sequence = await invoiceRepository.countAll();
    const created: InvoiceDto[] = [];
    // Tracked so the "nothing was created" case can say which of the two reasons it
    // was. "No eligible conversions" and "everyone was under the minimum" send an
    // admin looking in completely different places.
    let skippedBelowThreshold = 0;

    for (const balance of balances) {
      const conversions = await conversionRepository.findPayable(balance.affiliateId, cutoff, period);
      if (conversions.length === 0) continue;

      const amount = conversions.reduce((sum, c) => sum + Number(c.payoutAmount), 0);

      if (!dto.ignoreThreshold && amount < settings.minimumPayoutThreshold) {
        skippedBelowThreshold += 1;
        continue;
      }

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

    // An empty run is always a mistake from the admin's side, so it fails loudly rather
    // than returning [] and letting the UI report "0 invoices" as if that were a result.
    if (created.length === 0) {
      throw new ValidationError(
        skippedBelowThreshold > 0
          ? `No invoices created — every affiliate in this period is below the ${settings.minimumPayoutThreshold} ${settings.defaultCurrency} minimum. Re-run with the minimum waived to pay them anyway.`
          : 'No invoices created — no payout-eligible conversions fall inside this period.',
      );
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
    // Guarded on the transition, not the target, for the same reason as `becomingPaid`:
    // re-saving an already-rejected invoice to add a note must not mail the affiliate
    // a second time telling them their payout failed.
    const becomingRejected = dto.status === InvoiceStatus.REJECTED && invoice.status !== InvoiceStatus.REJECTED;
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

      const affiliate = await affiliateRepository.findById(invoice.affiliateId);
      if (affiliate?.user?.email) {
        safeSendEmail(
          sendTemplateEmail({
            templateKey: EmailTemplateKey.PAYOUT_SENT,
            to: { email: affiliate.user.email, name: affiliate.fullName },
            macros: {
              affiliate_name: affiliate.fullName ?? 'there',
              invoice_number: invoice.invoiceNumber,
              amount: `${Number(invoice.amount).toFixed(2)} ${invoice.currency}`,
              period: `${invoice.periodFrom.toISOString().slice(0, 10)} to ${invoice.periodTo.toISOString().slice(0, 10)}`,
              payment_reference: dto.paymentReference ?? '',
            },
          }),
        );
      }
    }

    /**
     * A rejected payout used to change nothing the affiliate could see: the status
     * moved, their balance stopped, and no message went anywhere. They found out by
     * noticing money had not arrived.
     *
     * The conversions are deliberately NOT touched here. They were stamped with this
     * invoice by `generateBatch` and stay stamped, so the amount remains reconcilable
     * against the invoice that failed — un-stamping them would silently roll the money
     * back into the next batch and leave a rejected invoice pointing at nothing. Which
     * is also why the copy says the earnings return "on the next run once this is
     * sorted", rather than claiming it has already happened.
     */
    if (becomingRejected) {
      notificationService.safeNotify(
        notificationService.notifyAffiliate(invoice.affiliateId, {
          level: NotificationLevel.WARNING,
          category: NotificationCategory.BILLING,
          title: 'Payment could not be processed',
          body: `${invoice.invoiceNumber} for ${Number(invoice.amount).toFixed(2)} ${invoice.currency} was not paid.${dto.notes ? ` ${dto.notes}` : ''}`,
          link: '/payments',
        }),
      );

      const affiliate = await affiliateRepository.findById(invoice.affiliateId);
      if (affiliate?.user?.email) {
        safeSendEmail(
          sendTemplateEmail({
            templateKey: EmailTemplateKey.PAYOUT_REJECTED,
            to: { email: affiliate.user.email, name: affiliate.fullName },
            macros: {
              affiliate_name: affiliate.fullName ?? 'there',
              invoice_number: invoice.invoiceNumber,
              amount: `${Number(invoice.amount).toFixed(2)} ${invoice.currency}`,
              period: `${invoice.periodFrom.toISOString().slice(0, 10)} to ${invoice.periodTo.toISOString().slice(0, 10)}`,
              // The admin's note is the whole reason this email is worth sending. With
              // nothing to say, a neutral line beats the word "Reason:" over a blank.
              decision_note: dto.notes?.trim() || 'Your manager will follow up with the details.',
            },
          }),
        );
      }
    }

    return this.getInvoice(id);
  },
};
