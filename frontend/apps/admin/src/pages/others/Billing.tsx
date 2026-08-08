import { useState } from 'react';
import {
  Button,
  DataTable,
  FilterBar,
  FilterField,
  Input,
  Modal,
  PageHeader,
  Pagination,
  Select,
  StatCard,
  TableSkeleton,
  Tabs,
  Textarea,
  type DataTableColumn,
} from '@fatexia/ui';
import type { Invoice, InvoiceStatus, PaymentMethod, PendingBalance } from '@fatexia/types';
import { generatePayoutBatch, getInvoices, getPendingBalances, updateInvoiceStatus } from '../../lib/platform-api';
import { runAction, useAsync } from '../../hooks/useAsync';
import { compactMoney, date, dateTime, money, number } from '../../lib/format';
import { StatusPill } from '../../components/StatusPill';
import { daysAgoIso, isoDate } from '../../lib/format';

const PAGE_SIZE = 25;

interface PaymentState {
  invoice: Invoice;
  reference: string;
  notes: string;
}

export function Billing() {
  const [tab, setTab] = useState('balances');
  const [status, setStatus] = useState<InvoiceStatus | ''>('');
  const [page, setPage] = useState(1);
  const [batchOpen, setBatchOpen] = useState(false);
  const [periodFrom, setPeriodFrom] = useState(daysAgoIso(30));
  const [periodTo, setPeriodTo] = useState(isoDate(new Date()));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('BANK_TRANSFER');
  const [generating, setGenerating] = useState(false);
  const [payment, setPayment] = useState<PaymentState | null>(null);
  const [saving, setSaving] = useState(false);

  const balances = useAsync<PendingBalance[]>(() => getPendingBalances(), []);
  const invoices = useAsync(() => getInvoices({ status: status || undefined, page, pageSize: PAGE_SIZE }), [status, page]);

  const payableTotal = (balances.data ?? []).filter((row) => row.meetsThreshold).reduce((sum, row) => sum + row.eligibleAmount, 0);
  const heldTotal = (balances.data ?? []).filter((row) => !row.meetsThreshold).reduce((sum, row) => sum + row.eligibleAmount, 0);

  async function runBatch() {
    setGenerating(true);
    const result = await runAction(
      () => generatePayoutBatch({ periodFrom: `${periodFrom}T00:00:00.000Z`, periodTo: `${periodTo}T23:59:59.999Z`, paymentMethod }),
      {
        success: 'Payout batch generated',
        onDone: () => {
          balances.reload();
          invoices.reload();
        },
      },
    );
    setGenerating(false);
    if (result) {
      setBatchOpen(false);
      setTab('invoices');
    }
  }

  async function markPaid() {
    if (!payment) return;
    setSaving(true);
    const result = await runAction(
      () =>
        updateInvoiceStatus(payment.invoice.id, {
          status: 'PAID',
          paymentReference: payment.reference || undefined,
          notes: payment.notes || undefined,
        }),
      {
        success: `${payment.invoice.invoiceNumber} marked paid`,
        onDone: () => {
          invoices.reload();
          balances.reload();
        },
      },
    );
    setSaving(false);
    if (result) setPayment(null);
  }

  const balanceColumns: DataTableColumn<PendingBalance>[] = [
    { key: 'affiliate', header: 'Affiliate', render: (row) => row.affiliateName ?? row.affiliateId },
    { key: 'conversions', header: 'Eligible conversions', render: (row) => number(row.eligibleConversions) },
    { key: 'amount', header: 'Eligible amount', render: (row) => money(row.eligibleAmount) },
    {
      key: 'threshold',
      header: 'Payable',
      render: (row) =>
        row.meetsThreshold ? (
          <StatusPill status="APPROVED" label="Meets threshold" />
        ) : (
          <StatusPill status="PENDING" label="Below threshold" />
        ),
    },
  ];

  const invoiceColumns: DataTableColumn<Invoice>[] = [
    { key: 'number', header: 'Invoice', render: (row) => row.invoiceNumber },
    { key: 'affiliate', header: 'Affiliate', render: (row) => row.affiliateName ?? row.affiliateId },
    { key: 'period', header: 'Period', render: (row) => `${date(row.periodFrom)} – ${date(row.periodTo)}` },
    { key: 'conversions', header: 'Conversions', render: (row) => number(row.conversionCount) },
    { key: 'amount', header: 'Amount', render: (row) => money(row.amount, row.currency) },
    { key: 'method', header: 'Method', render: (row) => row.paymentMethod.replace(/_/g, ' ').toLowerCase() },
    { key: 'status', header: 'Status', render: (row) => <StatusPill status={row.status} /> },
    { key: 'paidAt', header: 'Paid', render: (row) => dateTime(row.paidAt) },
    {
      key: 'actions',
      header: '',
      render: (row) =>
        row.status === 'PAID' ? null : (
          <Button size="sm" variant="outline" onClick={() => setPayment({ invoice: row, reference: '', notes: '' })}>
            Mark paid
          </Button>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        description="Affiliate payout batches. Balances are recomputed from conversions on every read — nothing here is a stored total that could drift."
        actions={<Button onClick={() => setBatchOpen(true)}>Generate payout batch</Button>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard tone="money" label="Ready to pay" value={compactMoney(payableTotal)} />
        <StatCard tone="warning" label="Below threshold" value={compactMoney(heldTotal)} />
        <StatCard tone="info" label="Affiliates with a balance" value={number((balances.data ?? []).length)} />
        <StatCard tone="info" label="Invoices" value={number(invoices.data?.total ?? 0)} />
      </div>

      <Tabs
        items={[
          { key: 'balances', label: 'Pending balances' },
          { key: 'invoices', label: 'Invoices' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'balances' ? (
        <>
          <p className="text-xs text-muted-foreground">
            What a payout run would pick up right now: approved conversions past the hold window that are not already on an
            invoice. Affiliates below the network minimum are skipped when a batch is generated.
          </p>
          {balances.loading ? (
            <TableSkeleton columns={4} />
          ) : (
            <DataTable
              columns={balanceColumns}
              rows={balances.data ?? []}
              getRowKey={(row) => row.affiliateId}
              emptyMessage="No affiliate currently has payout-eligible conversions."
            />
          )}
        </>
      ) : (
        <>
          <FilterBar>
            <FilterField label="Status">
              <Select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as InvoiceStatus | '');
                  setPage(1);
                }}
                className="w-44"
              >
                <option value="">All statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="PAID">Paid</option>
                <option value="REJECTED">Rejected</option>
              </Select>
            </FilterField>
          </FilterBar>

          {invoices.loading ? (
            <TableSkeleton columns={9} />
          ) : (
            <>
              <DataTable
                columns={invoiceColumns}
                rows={invoices.data?.rows ?? []}
                getRowKey={(row) => row.id}
                emptyMessage="No invoices yet. Generate a payout batch to create the first one."
              />
              <Pagination page={page} pageSize={PAGE_SIZE} total={invoices.data?.total ?? 0} onPageChange={setPage} />
            </>
          )}
        </>
      )}

      <Modal open={batchOpen} onOpenChange={setBatchOpen} title="Generate payout batch">
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            One invoice per affiliate whose eligible balance clears the network minimum. The amount is summed from the
            conversions themselves and each one is stamped with the invoice, so a conversion can never land on two batches.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Period from</span>
              <Input type="date" value={periodFrom} onChange={(event) => setPeriodFrom(event.target.value)} className="mt-1" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Period to</span>
              <Input type="date" value={periodTo} onChange={(event) => setPeriodTo(event.target.value)} className="mt-1" />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Payment method</span>
            <Select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)} className="mt-1">
              <option value="BANK_TRANSFER">Bank transfer</option>
              <option value="PAYPAL">PayPal</option>
              <option value="CRYPTO">Cryptocurrency</option>
            </Select>
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setBatchOpen(false)}>
              Cancel
            </Button>
            <Button disabled={generating} onClick={runBatch}>
              {generating ? 'Generating…' : 'Generate batch'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!payment} onOpenChange={(open) => !open && setPayment(null)} title="Mark invoice paid">
        {payment && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {payment.invoice.invoiceNumber} — {money(payment.invoice.amount, payment.invoice.currency)} to{' '}
              <span className="text-card-foreground">{payment.invoice.affiliateName}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              This also moves the {payment.invoice.conversionCount} conversions on this invoice to PAID — the two are never
              updated independently.
            </p>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Payment reference</span>
              <Input
                value={payment.reference}
                onChange={(event) => setPayment({ ...payment, reference: event.target.value })}
                placeholder="Wire reference or PayPal batch id"
                className="mt-1"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Notes</span>
              <Textarea rows={2} value={payment.notes} onChange={(event) => setPayment({ ...payment, notes: event.target.value })} className="mt-1" />
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPayment(null)}>
                Cancel
              </Button>
              <Button disabled={saving} onClick={markPaid}>
                {saving ? 'Saving…' : 'Mark paid'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
