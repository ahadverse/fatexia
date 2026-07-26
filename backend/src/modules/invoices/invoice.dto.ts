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
export const generatePayoutBatchSchema = z.object({
  affiliateIds: z.array(z.string().uuid()).optional(),
  periodFrom: z.string(),
  periodTo: z.string(),
  paymentMethod: z.nativeEnum(PaymentMethod).default(PaymentMethod.BANK_TRANSFER),
});

export type GeneratePayoutBatchDto = z.infer<typeof generatePayoutBatchSchema>;

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
    paymentReference: invoice.paymentReference,
    notes: invoice.notes,
    paidAt: invoice.paidAt?.toISOString() ?? null,
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
