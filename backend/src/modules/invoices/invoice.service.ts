import type { EntityManager } from 'typeorm';
import { AppDataSource } from '../../infra/database/data-source';
import { NotFoundError, ValidationError } from '../../common/errors';
import { paginate, type Paginated } from '../../common/pagination';
import { affiliateNames } from '../../common/entity-names';
import { conversionRepository } from '../conversions/conversion.repository';
import { affiliateService } from '../affiliates/affiliate.service';
import { affiliateRepository } from '../affiliates/affiliate.repository';
import { networkSettingService } from '../network-settings/network-setting.service';
import { notificationService } from '../notifications/notification.service';
import { NotificationCategory, NotificationLevel } from '../notifications/notification.entity';
import { transactionRepository } from '../transactions/transaction.repository';
import { TransactionType } from '../transactions/transaction.entity';
import { sendTemplateEmail, safeSendEmail } from '../../infra/email/brevo-mailer';
import { EmailTemplateKey } from '../email-templates/email-template.entity';
import { invoiceRepository } from './invoice.repository';
import { InvoiceStatus, type Invoice, type PaymentMethod } from './invoice.entity';
import {
  toInvoiceDto,
  type CreateManualInvoiceDto,
  type GeneratePayoutBatchDto,
  type InvoiceDto,
  type InvoiceFiltersDto,
  type PendingBalanceDto,
  type ReleaseInvoiceDto,
  type UpdateInvoiceStatusDto,
} from './invoice.dto';

function holdCutoff(holdDays: number): Date {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - holdDays);
  return cutoff;
}

/**
 * The real end of a period, given whatever the caller wrote.
 *
 * A bare `YYYY-MM-DD` parses to midnight, so used as-is the last day of the period
 * contributes nothing and an August invoice silently drops everything that converted on
 * the 31st. Extended to end-of-day only in that case: the admin UI already sends a full
 * `…T23:59:59.999Z`, and blanket-normalising that with setHours() would re-interpret it
 * in the server's local zone and cut hours off the window instead of adding them.
 */
function endOfPeriod(raw: string, parsed: Date): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T23:59:59.999Z`) : parsed;
}

function parsePeriod(rawFrom: string, rawTo: string): { from: Date; to: Date } {
  const from = new Date(rawFrom);
  const to = new Date(rawTo);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new ValidationError('periodFrom and periodTo must be valid dates');
  }
  if (from > to) {
    throw new ValidationError('periodFrom must be on or before periodTo');
  }
  return { from, to: endOfPeriod(rawTo, to) };
}

interface NewInvoice {
  affiliateId: string;
  periodFrom: Date;
  periodTo: Date;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  paymentMethod: PaymentMethod;
  notes: string | null;
  /** Stamped with the invoice id in the same transaction, so they can never be billed twice. */
  conversionIds: string[];
  createdByUserId: string | null;
  /** What the ledger row should say this invoice was. */
  ledgerDescription: string;
}

/**
 * Creates one invoice, binds its conversions to it, and records it in the ledger.
 *
 * All three writes go through the caller's `manager`, so they commit together or not at
 * all. Before this was transactional, a failure between the insert and the stamp left an
 * invoice whose conversions were still unbilled — and the next batch happily invoiced
 * and paid the same money a second time.
 */
async function writeInvoice(manager: EntityManager, input: NewInvoice): Promise<Invoice> {
  const invoiceNumber = await invoiceRepository.nextInvoiceNumber(manager);

  const invoice = await invoiceRepository.create(
    {
      invoiceNumber,
      affiliateId: input.affiliateId,
      periodFrom: input.periodFrom,
      periodTo: input.periodTo,
      amount: input.amount.toFixed(2),
      currency: input.currency,
      conversionCount: input.conversionIds.length,
      status: input.status,
      paymentMethod: input.paymentMethod,
      notes: input.notes,
    },
    manager,
  );

  await conversionRepository.markInvoiced(input.conversionIds, invoice.id, manager);

  await transactionRepository.create(
    {
      affiliateId: input.affiliateId,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      type: TransactionType.INVOICE_GENERATED,
      amount: input.amount.toFixed(2),
      currency: input.currency,
      reference: null,
      description: input.ledgerDescription,
      createdByUserId: input.createdByUserId,
    },
    manager,
  );

  return invoice;
}

// Announced only after the surrounding transaction has committed — an affiliate must
// never be told about an invoice that was rolled back.
function announceInvoice(invoice: Invoice): void {
  notificationService.safeNotify(
    notificationService.notifyAffiliate(invoice.affiliateId, {
      level: NotificationLevel.INFO,
      category: NotificationCategory.BILLING,
      title: 'Invoice generated',
      body: `${invoice.invoiceNumber} for ${Number(invoice.amount).toFixed(2)} ${invoice.currency} covering ${invoice.conversionCount} conversions.`,
      link: '/payments',
    }),
  );
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
   *
   * The whole run is one database transaction: "generate batch" either happened or it
   * did not, rather than leaving half the affiliates invoiced behind an error message.
   * To raise an invoice that the rules here would skip, use `createManual`, which
   * applies none of them.
   */
  async generateBatch(dto: GeneratePayoutBatchDto, adminUserId: string | null = null): Promise<InvoiceDto[]> {
    const period = parsePeriod(dto.periodFrom, dto.periodTo);
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

    // Tracked so the "nothing was created" case can say which of the two reasons it
    // was. "No eligible conversions" and "everyone was under the minimum" send an
    // admin looking in completely different places.
    let skippedBelowThreshold = 0;

    const created = await AppDataSource.transaction(async (manager) => {
      const invoices: Invoice[] = [];

      for (const balance of balances) {
        const conversions = await conversionRepository.findPayable(balance.affiliateId, cutoff, period, manager);
        if (conversions.length === 0) continue;

        const amount = conversions.reduce((sum, c) => sum + Number(c.payoutAmount), 0);

        if (!dto.ignoreThreshold && amount < settings.minimumPayoutThreshold) {
          skippedBelowThreshold += 1;
          continue;
        }

        invoices.push(
          await writeInvoice(manager, {
            affiliateId: balance.affiliateId,
            periodFrom: period.from,
            periodTo: period.to,
            amount,
            currency: settings.defaultCurrency,
            status: InvoiceStatus.PENDING,
            paymentMethod: dto.paymentMethod,
            notes: null,
            conversionIds: conversions.map((c) => c.id),
            createdByUserId: adminUserId,
            ledgerDescription: `Payout batch — ${conversions.length} conversions`,
          }),
        );
      }

      // An empty run is always a mistake from the admin's side, so it fails loudly
      // rather than returning [] and letting the UI report "0 invoices" as a result.
      // Thrown inside the transaction so nothing from a partial run survives.
      if (invoices.length === 0) {
        throw new ValidationError(
          skippedBelowThreshold > 0
            ? `No invoices created — every affiliate in this period is below the ${settings.minimumPayoutThreshold} ${settings.defaultCurrency} minimum. Re-run with the minimum waived to pay them anyway.`
            : 'No invoices created — no payout-eligible conversions fall inside this period.',
        );
      }

      return invoices;
    });

    created.forEach(announceInvoice);

    const names = await affiliateNames(created.map((invoice) => invoice.affiliateId));
    return created.map((invoice) => toInvoiceDto(invoice, names.get(invoice.affiliateId) ?? null));
  },

  /**
   * One invoice for one affiliate, on the admin's terms.
   *
   * This is the deliberate exception to every rule `generateBatch` enforces: no minimum
   * threshold, no hold window if waived, no requirement that conversions exist, and no
   * requirement that the amount be above zero. The batch is the safe bulk path; this is
   * the one for the cases it is designed to skip.
   *
   * What does not change is that conversions pulled onto the invoice are stamped in the
   * same transaction as the invoice and its ledger row, and that a typed-in amount is
   * recorded as a typed-in amount rather than passed off as a computed total.
   */
  async createManual(dto: CreateManualInvoiceDto, adminUserId: string | null = null): Promise<InvoiceDto> {
    const affiliate = await affiliateRepository.findById(dto.affiliateId);
    if (!affiliate) {
      throw new NotFoundError('Affiliate not found');
    }

    const period = parsePeriod(dto.periodFrom, dto.periodTo);
    const settings = await networkSettingService.getSettings();
    const currency = dto.currency ?? settings.defaultCurrency;
    // `new Date()` rather than the hold cutoff: everything approved up to this moment
    // qualifies, which is what waiving the hold window means.
    const cutoff = dto.ignoreHoldWindow ? new Date() : holdCutoff(settings.defaultHoldDays);

    const invoice = await AppDataSource.transaction(async (manager) => {
      const conversions = dto.includeConversions
        ? await conversionRepository.findPayable(dto.affiliateId, cutoff, period, manager)
        : [];
      const computed = conversions.reduce((sum, c) => sum + Number(c.payoutAmount), 0);
      const amount = dto.amount ?? computed;
      const overridden = dto.amount !== undefined && Math.abs(dto.amount - computed) >= 0.005;

      // The override is written onto the invoice, not just the ledger: whoever opens
      // this invoice in six months has to be able to see that its total was not summed
      // from the rows attached to it.
      const overrideNote = overridden
        ? `Amount set manually to ${amount.toFixed(2)} ${currency} (computed total was ${computed.toFixed(2)} ${currency}).`
        : null;
      const notes = [dto.notes, overrideNote].filter(Boolean).join('\n') || null;

      return writeInvoice(manager, {
        affiliateId: dto.affiliateId,
        periodFrom: period.from,
        periodTo: period.to,
        amount,
        currency,
        status: dto.status,
        paymentMethod: dto.paymentMethod,
        notes,
        conversionIds: conversions.map((c) => c.id),
        createdByUserId: adminUserId,
        ledgerDescription: overridden
          ? `Manual invoice — amount entered by admin${conversions.length > 0 ? `, ${conversions.length} conversions attached` : ''}`
          : `Manual invoice — ${conversions.length} conversions`,
      });
    });

    announceInvoice(invoice);
    return toInvoiceDto(invoice, affiliate.fullName ?? affiliate.companyName ?? null);
  },

  // Marking an invoice PAID is what moves its conversions to PAID — the two are
  // never updated independently, so "paid" always means the same thing on both.
  async updateStatus(id: string, dto: UpdateInvoiceStatusDto, adminUserId: string | null = null): Promise<InvoiceDto> {
    const invoice = await invoiceRepository.findById(id);
    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    const becomingPaid = dto.status === InvoiceStatus.PAID && invoice.status !== InvoiceStatus.PAID;
    // Guarded on the transition, not the target, for the same reason as `becomingPaid`:
    // re-saving an already-rejected invoice to add a note must not mail the affiliate
    // a second time telling them their payout failed.
    const becomingRejected = dto.status === InvoiceStatus.REJECTED && invoice.status !== InvoiceStatus.REJECTED;

    // A released invoice has no conversions left on it — they went back into the pool
    // and are very likely on a later invoice by now. Paying this one would pay for
    // nothing, or pay for the same conversions twice.
    if (becomingPaid && invoice.releasedAt) {
      throw new ValidationError(
        'This invoice was released — its conversions returned to the payable pool and are billed elsewhere. Raise a new invoice instead.',
      );
    }

    const paidAt = becomingPaid ? new Date() : invoice.paidAt;
    const amount = Number(invoice.amount);

    await AppDataSource.transaction(async (manager) => {
      await invoiceRepository.update(
        id,
        {
          status: dto.status,
          paidAt,
          ...(dto.paymentReference !== undefined && { paymentReference: dto.paymentReference }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
        },
        manager,
      );

      if (becomingPaid) {
        await conversionRepository.markPaid(id, paidAt!, manager);
        await transactionRepository.create(
          {
            affiliateId: invoice.affiliateId,
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            type: TransactionType.PAYOUT_SENT,
            amount: amount.toFixed(2),
            currency: invoice.currency,
            reference: dto.paymentReference ?? null,
            description: dto.notes ?? `Payout for ${invoice.invoiceNumber}`,
            createdByUserId: adminUserId,
          },
          manager,
        );
      }

      if (becomingRejected) {
        await transactionRepository.create(
          {
            affiliateId: invoice.affiliateId,
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            type: TransactionType.PAYOUT_REJECTED,
            amount: amount.toFixed(2),
            currency: invoice.currency,
            reference: dto.paymentReference ?? null,
            description: dto.notes ?? `Payout for ${invoice.invoiceNumber} could not be sent`,
            createdByUserId: adminUserId,
          },
          manager,
        );
      }
    });

    if (becomingPaid) {
      // Money actually moved — the single most useful thing to tell an affiliate.
      notificationService.safeNotify(
        notificationService.notifyAffiliate(invoice.affiliateId, {
          level: NotificationLevel.SUCCESS,
          category: NotificationCategory.BILLING,
          title: 'Payment sent',
          body: `${invoice.invoiceNumber} for ${amount.toFixed(2)} ${invoice.currency} has been paid.`,
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
              amount: `${amount.toFixed(2)} ${invoice.currency}`,
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
     * invoice when it was raised and stay stamped, so the amount remains reconcilable
     * against the invoice that failed. Handing them back to the payable pool is a
     * separate, explicit decision — `releaseInvoice` — which is what the copy below
     * points at rather than promising something rejection alone does not do.
     */
    if (becomingRejected) {
      notificationService.safeNotify(
        notificationService.notifyAffiliate(invoice.affiliateId, {
          level: NotificationLevel.WARNING,
          category: NotificationCategory.BILLING,
          title: 'Payment could not be processed',
          body: `${invoice.invoiceNumber} for ${amount.toFixed(2)} ${invoice.currency} was not paid.${dto.notes ? ` ${dto.notes}` : ''}`,
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
              amount: `${amount.toFixed(2)} ${invoice.currency}`,
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

  /**
   * Cancels an invoice and hands its conversions back to the payable pool.
   *
   * Without this, a rejected invoice was a dead end: its conversions stayed stamped
   * with it forever, so that money could never be invoiced again and the only way out
   * was editing the database by hand. Both payable queries filter on
   * `invoiceId IS NULL`, so clearing the stamp is the entire mechanism — the next batch
   * picks the rows up on its own.
   *
   * Refused once the invoice is PAID: that money has moved, and releasing it would put
   * conversions that were already paid for back in the queue to be paid again.
   */
  async releaseInvoice(id: string, dto: ReleaseInvoiceDto, adminUserId: string | null = null): Promise<InvoiceDto> {
    const invoice = await invoiceRepository.findById(id);
    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }
    if (invoice.status === InvoiceStatus.PAID) {
      throw new ValidationError('A paid invoice cannot be released — its conversions have already been settled.');
    }
    if (invoice.releasedAt) {
      throw new ValidationError('This invoice has already been released.');
    }

    const releasedAt = new Date();
    const amount = Number(invoice.amount);
    const notes = [invoice.notes, dto.notes].filter(Boolean).join('\n') || null;

    const releasedCount = await AppDataSource.transaction(async (manager) => {
      const count = await conversionRepository.releaseFromInvoice(id, manager);

      await invoiceRepository.update(
        id,
        { status: InvoiceStatus.REJECTED, releasedAt, notes },
        manager,
      );

      await transactionRepository.create(
        {
          affiliateId: invoice.affiliateId,
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          type: TransactionType.INVOICE_RELEASED,
          amount: amount.toFixed(2),
          currency: invoice.currency,
          reference: null,
          description: dto.notes ?? `${invoice.invoiceNumber} cancelled — ${count} conversions returned to the payable pool`,
          createdByUserId: adminUserId,
        },
        manager,
      );

      return count;
    });

    // Worth telling the affiliate, and now it is true rather than a promise: the
    // earnings really are back in the pool and the next run will pick them up.
    notificationService.safeNotify(
      notificationService.notifyAffiliate(invoice.affiliateId, {
        level: NotificationLevel.INFO,
        category: NotificationCategory.BILLING,
        title: 'Invoice cancelled — earnings returned',
        body: `${invoice.invoiceNumber} was cancelled. ${releasedCount} conversions are back in your balance and will be included in the next payout run.${dto.notes ? ` ${dto.notes}` : ''}`,
        link: '/payments',
      }),
    );

    return this.getInvoice(id);
  },
};
