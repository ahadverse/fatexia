import { z } from 'zod';
import { paginationSchema } from '../../common/pagination';
import { TransactionType, type Transaction } from './transaction.entity';

export const transactionFiltersSchema = paginationSchema.extend({
  affiliateId: z.string().uuid().optional(),
  invoiceId: z.string().uuid().optional(),
  type: z.nativeEnum(TransactionType).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export type TransactionFiltersDto = z.infer<typeof transactionFiltersSchema>;

/**
 * A bonus, a penalty, or a correction, recorded against an affiliate.
 *
 * Signed and deliberately not zero — a zero-amount adjustment records nothing and is
 * always a mis-typed form rather than an intent. A reason is required because this is
 * the one ledger row with no invoice behind it to explain itself.
 */
export const recordAdjustmentSchema = z.object({
  affiliateId: z.string().uuid(),
  amount: z.number().refine((value) => value !== 0, { message: 'Amount must not be zero' }),
  currency: z.string().trim().length(3).optional(),
  description: z.string().trim().min(1).max(500),
  reference: z.string().trim().max(160).optional(),
});

export type RecordAdjustmentDto = z.infer<typeof recordAdjustmentSchema>;

export interface TransactionDto {
  id: string;
  affiliateId: string;
  affiliateName: string | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
  type: TransactionType;
  amount: number;
  currency: string;
  reference: string | null;
  description: string | null;
  createdAt: string;
}

export function toTransactionDto(row: Transaction, affiliateName: string | null = null): TransactionDto {
  return {
    id: row.id,
    affiliateId: row.affiliateId,
    affiliateName,
    invoiceId: row.invoiceId,
    invoiceNumber: row.invoiceNumber,
    type: row.type,
    amount: Number(row.amount),
    currency: row.currency,
    reference: row.reference,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Totals per event type over the whole filtered set, not just the page on screen.
 *
 * Per type rather than one grand total: the types measure different things, so a single
 * sum across them would double-count an invoice that was raised and then paid.
 */
export interface TransactionSummaryDto {
  type: TransactionType;
  amount: number;
  count: number;
}
