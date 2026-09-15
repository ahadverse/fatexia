import type {
  Invoice,
  InvoiceStatus,
  Paginated,
  PaymentMethod,
  PendingBalance,
  Transaction,
  TransactionSummary,
  TransactionType,
} from '@fatexia/types';
import { apiFetch } from './api';
import { toQuery } from './query';

// Billing lives in its own module rather than in platform-api: invoices, payout
// batches and the money ledger are one surface with one set of rules, and they had
// grown past the point where sharing a file with news posts and integrations helped.

// ---------------------------------------------------------------------- invoices

export interface InvoiceFilters {
  status?: InvoiceStatus | '';
  affiliateId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export function getInvoices(filters: InvoiceFilters = {}): Promise<Paginated<Invoice>> {
  return apiFetch<Paginated<Invoice>>(`/invoices${toQuery({ ...filters })}`);
}

export function getInvoice(id: string): Promise<Invoice> {
  return apiFetch<Invoice>(`/invoices/${id}`);
}

export function getPendingBalances(): Promise<PendingBalance[]> {
  return apiFetch<PendingBalance[]>('/invoices/pending-balances');
}

/**
 * The bulk path: one invoice per affiliate with an eligible balance in the period.
 *
 * Applies the network's rules — hold window, minimum threshold — and runs as a single
 * database transaction, so it either produces the whole batch or produces nothing.
 */
export function generatePayoutBatch(input: {
  affiliateIds?: string[];
  periodFrom: string;
  periodTo: string;
  paymentMethod?: PaymentMethod;
  /** Invoice affiliates whose period total is under the network minimum. */
  ignoreThreshold?: boolean;
}): Promise<Invoice[]> {
  return apiFetch<Invoice[]>('/invoices/batch', { method: 'POST', body: JSON.stringify(input) });
}

/**
 * One invoice for one affiliate, with none of the batch's rules applied.
 *
 * No minimum threshold, no hold window when waived, no requirement that any conversion
 * be found, and no requirement that the amount be above zero. `amount` overrides the
 * computed total; leaving it out sums whatever conversions the period holds, which may
 * legitimately be nothing at all.
 */
export function createManualInvoice(input: {
  affiliateId: string;
  periodFrom: string;
  periodTo: string;
  paymentMethod?: PaymentMethod;
  includeConversions?: boolean;
  ignoreHoldWindow?: boolean;
  amount?: number;
  currency?: string;
  status?: InvoiceStatus;
  notes?: string;
}): Promise<Invoice> {
  return apiFetch<Invoice>('/invoices/manual', { method: 'POST', body: JSON.stringify(input) });
}

export function updateInvoiceStatus(
  id: string,
  input: { status: InvoiceStatus; paymentReference?: string; notes?: string },
): Promise<Invoice> {
  return apiFetch<Invoice>(`/invoices/${id}/status`, { method: 'PATCH', body: JSON.stringify(input) });
}

/**
 * Cancels an invoice and puts its conversions back in the payable pool.
 *
 * Rejecting an invoice deliberately leaves them stamped to it, so the failed amount
 * still reconciles. This is the separate, explicit step that frees the money to be
 * invoiced again — refused once the invoice is PAID.
 */
export function releaseInvoice(id: string, input: { notes?: string } = {}): Promise<Invoice> {
  return apiFetch<Invoice>(`/invoices/${id}/release`, { method: 'POST', body: JSON.stringify(input) });
}

// ------------------------------------------------------------------ transactions

export interface TransactionFilters {
  affiliateId?: string;
  invoiceId?: string;
  type?: TransactionType | '';
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export function getTransactions(filters: TransactionFilters = {}): Promise<Paginated<Transaction>> {
  return apiFetch<Paginated<Transaction>>(`/transactions${toQuery({ ...filters })}`);
}

// Totals per event type over the whole filtered set, not just the visible page.
export function getTransactionSummary(filters: TransactionFilters = {}): Promise<TransactionSummary[]> {
  return apiFetch<TransactionSummary[]>(`/transactions/summary${toQuery({ ...filters })}`);
}

// A bonus, a penalty, or a correction. Signed, and never zero.
export function recordAdjustment(input: {
  affiliateId: string;
  amount: number;
  currency?: string;
  description: string;
  reference?: string;
}): Promise<Transaction> {
  return apiFetch<Transaction>('/transactions/adjustment', { method: 'POST', body: JSON.stringify(input) });
}
