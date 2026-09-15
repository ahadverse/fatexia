import { z } from 'zod';
import { paginationSchema } from '../../common/pagination';
import { InvoiceStatus, PaymentMethod, type Invoice } from './invoice.entity';

export const invoiceFiltersSchema = paginationSchema.extend({
  affiliateId: z.string().uuid().optional(),
  status: z.nativeEnum(InvoiceStatus).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export type InvoiceFiltersDto = z.infer<typeof invoiceFiltersSchema>;

// Triggers a payout batch. There is no amount field — the total is always computed
// from the eligible conversions, never supplied by the caller (money integrity rule).
// `ignoreThreshold` waives the network minimum, not that rule: the figure is still
// summed from the conversions, so a waived invoice reconciles exactly like any other.
export const generatePayoutBatchSchema = z.object({
  affiliateIds: z.array(z.string().uuid()).optional(),
  periodFrom: z.string(),
  periodTo: z.string(),
  paymentMethod: z.nativeEnum(PaymentMethod).default(PaymentMethod.BANK_TRANSFER),
  /**
   * Invoice an affiliate whose period total is under `minimumPayoutThreshold`.
   *
   * The threshold exists so the network does not spend a bank fee settling $3. Paying
   * someone below it is a deliberate exception — an affiliate leaving, a correction, a
   * balance that will never grow again — so it is opt-in per run and never a default.
   */
  ignoreThreshold: z.boolean().default(false),
});

export type GeneratePayoutBatchDto = z.infer<typeof generatePayoutBatchSchema>;

/**
 * One invoice for one affiliate, raised by hand.
 *
 * Unlike the batch, this path applies no eligibility rules at all: no minimum payout
 * threshold, no hold window, no requirement that any conversion be found, and no
 * requirement that the amount be more than zero. It exists precisely for the cases the
 * batch is designed to skip — a bonus invoice, a placeholder an affiliate asked for, a
 * correction, a zero-value record closing a period off.
 *
 * The one rule that still holds is the money integrity rule, and it holds in a narrower
 * form: when the amount is *computed* it is summed from real conversions and those rows
 * are stamped, exactly as in a batch. `amount` overrides that total only when an admin
 * types one, and the override is recorded on the invoice's notes and its ledger row so
 * it is never mistaken for a computed figure.
 */
export const createManualInvoiceSchema = z.object({
  affiliateId: z.string().uuid(),
  periodFrom: z.string(),
  periodTo: z.string(),
  paymentMethod: z.nativeEnum(PaymentMethod).default(PaymentMethod.BANK_TRANSFER),
  /**
   * Pull the affiliate's payable conversions for the period onto this invoice. Off
   * gives a standalone invoice that touches no conversion at all — which is the only
   * way to raise one for an affiliate who has none.
   */
  includeConversions: z.boolean().default(true),
  /** Waives the hold window as well, so conversions approved minutes ago can be billed. */
  ignoreHoldWindow: z.boolean().default(false),
  /** Overrides the computed total. Zero is allowed and negative is not — a clawback is a transaction adjustment, not an invoice. */
  amount: z.number().min(0).optional(),
  currency: z.string().trim().length(3).optional(),
  status: z.nativeEnum(InvoiceStatus).default(InvoiceStatus.PENDING),
  notes: z.string().trim().max(1000).optional(),
});

export type CreateManualInvoiceDto = z.infer<typeof createManualInvoiceSchema>;

export const releaseInvoiceSchema = z.object({
  notes: z.string().trim().max(1000).optional(),
});

export type ReleaseInvoiceDto = z.infer<typeof releaseInvoiceSchema>;

export const updateInvoiceStatusSchema = z.object({
  status: z.nativeEnum(InvoiceStatus),
  paymentReference: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export type UpdateInvoiceStatusDto = z.infer<typeof updateInvoiceStatusSchema>;

export interface InvoiceDto {
  id: string;
  invoiceNumber: string;
  affiliateId: string;
  affiliateName: string | null;
  periodFrom: string;
  periodTo: string;
  amount: number;
  currency: string;
  conversionCount: number;
  status: InvoiceStatus;
  paymentMethod: PaymentMethod;
  paymentReference: string | null;
  notes: string | null;
  paidAt: string | null;
  /** Set once the invoice's conversions were handed back to the payable pool. */
  releasedAt: string | null;
  createdAt: string;
}

export function toInvoiceDto(invoice: Invoice, affiliateName: string | null = null): InvoiceDto {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    affiliateId: invoice.affiliateId,
    affiliateName,
    periodFrom: invoice.periodFrom.toISOString(),
    periodTo: invoice.periodTo.toISOString(),
    amount: Number(invoice.amount),
    currency: invoice.currency,
    conversionCount: invoice.conversionCount,
    status: invoice.status,
    paymentMethod: invoice.paymentMethod,
    // `?? null` rather than passed straight through: the generation paths now build
    // this from the entity `save()` returned instead of re-reading the row, and a
    // nullable column that was never written comes back undefined — which JSON drops
    // from the response entirely rather than sending as null.
    paymentReference: invoice.paymentReference ?? null,
    notes: invoice.notes ?? null,
    paidAt: invoice.paidAt?.toISOString() ?? null,
    releasedAt: invoice.releasedAt?.toISOString() ?? null,
    createdAt: invoice.createdAt.toISOString(),
  };
}

// Live, unbilled balance per affiliate — recomputed from conversions on every read
// rather than stored, so it can never drift from the source rows.
export interface PendingBalanceDto {
  affiliateId: string;
  affiliateName: string | null;
  eligibleAmount: number;
  eligibleConversions: number;
  meetsThreshold: boolean;
}
