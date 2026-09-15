import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  Textarea,
  type DataTableColumn,
} from '@fatexia/ui';
import type { Affiliate, Transaction, TransactionType } from '@fatexia/types';
import { getTransactionSummary, getTransactions, recordAdjustment } from '../../lib/billing-api';
import { getAffiliates } from '../../lib/affiliates-api';
import { runAction, useAsync } from '../../hooks/useAsync';
import { compactMoney, dateTime, daysAgoIso, isoDate, money } from '../../lib/format';
import { StatusPill } from '../../components/StatusPill';

const PAGE_SIZE = 25;

const TYPE_LABEL: Record<TransactionType, string> = {
  INVOICE_GENERATED: 'Invoice raised',
  PAYOUT_SENT: 'Payout sent',
  PAYOUT_REJECTED: 'Payout rejected',
  INVOICE_RELEASED: 'Invoice released',
  MANUAL_ADJUSTMENT: 'Manual adjustment',
};

// Reuses the shared status→colour mapping rather than inventing a second palette for
// this page, so "sent" reads green here exactly as PAID does on the invoice table.
const TYPE_STATUS: Record<TransactionType, string> = {
  INVOICE_GENERATED: 'PENDING',
  PAYOUT_SENT: 'PAID',
  PAYOUT_REJECTED: 'REJECTED',
  INVOICE_RELEASED: 'DUPLICATE',
  MANUAL_ADJUSTMENT: 'INFO',
};

/**
 * The money ledger: every payout event, in the order it happened.
 *
 * Deliberately append-only and read-only apart from adjustments — invoice rows are
 * written by the server inside the same transaction that moves the invoice, so this
 * page can be trusted as a record of what actually happened rather than a second
 * opinion about it.
 */
export function Transactions() {
  // Arrives from the invoice dialog's "view in the ledger" link, so opening one
  // invoice's history is one click rather than a filter the reader has to reconstruct.
  const [searchParams, setSearchParams] = useSearchParams();
  const invoiceId = searchParams.get('invoiceId') ?? '';

  const [affiliateId, setAffiliateId] = useState('');
  const [type, setType] = useState<TransactionType | ''>('');
  const [dateFrom, setDateFrom] = useState(daysAgoIso(30));
  const [dateTo, setDateTo] = useState(isoDate(new Date()));
  const [page, setPage] = useState(1);

  // An invoice link is asking for that invoice's whole history, so the date window —
  // which would otherwise hide rows older than 30 days — does not apply to it.
  const filters = invoiceId
    ? { invoiceId }
    : {
        affiliateId: affiliateId || undefined,
        type: type || undefined,
        dateFrom: `${dateFrom}T00:00:00.000Z`,
        dateTo: `${dateTo}T23:59:59.999Z`,
      };

  const affiliates = useAsync<Affiliate[]>(() => getAffiliates(), []);
  const rows = useAsync(() => getTransactions({ ...filters, page, pageSize: PAGE_SIZE }), [
    invoiceId,
    affiliateId,
    type,
    dateFrom,
    dateTo,
    page,
  ]);
  const summary = useAsync(() => getTransactionSummary(filters), [invoiceId, affiliateId, type, dateFrom, dateTo]);

  function totalFor(wanted: TransactionType): number {
    return (summary.data ?? []).find((row) => row.type === wanted)?.amount ?? 0;
  }

  function reload() {
    rows.reload();
    summary.reload();
  }

  function resetPage<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  const columns: DataTableColumn<Transaction>[] = [
    { key: 'createdAt', header: 'When', render: (row) => dateTime(row.createdAt) },
    { key: 'affiliate', header: 'Affiliate', render: (row) => row.affiliateName ?? row.affiliateId },
    { key: 'type', header: 'Event', render: (row) => <StatusPill status={TYPE_STATUS[row.type]} label={TYPE_LABEL[row.type]} /> },
    {
      key: 'invoice',
      header: 'Invoice',
      render: (row) => <span className="text-xs text-muted-foreground">{row.invoiceNumber ?? '—'}</span>,
    },
    {
      key: 'amount',
      header: 'Amount',
      // Only an adjustment is ever negative, and when one is, the sign is the whole
      // point of the row — so it gets the colour rather than the type does.
      render: (row) => (
        <span className={row.amount < 0 ? 'text-destructive' : undefined}>
          {row.amount > 0 && row.type === 'MANUAL_ADJUSTMENT' ? '+' : ''}
          {money(row.amount, row.currency)}
        </span>
      ),
    },
    {
      key: 'reference',
      header: 'Reference',
      render: (row) => <span className="text-xs text-muted-foreground">{row.reference ?? '—'}</span>,
    },
    {
      key: 'description',
      header: 'Detail',
      render: (row) => <span className="text-xs text-muted-foreground">{row.description ?? '—'}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        description="Every money event on the network, in the order it happened. Invoice events are written alongside the invoice itself, so the two can never disagree."
        actions={<AdjustmentButton affiliates={affiliates.data ?? []} onDone={reload} />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard tone="money" label="Paid out" value={compactMoney(totalFor('PAYOUT_SENT'))} />
        <StatCard tone="info" label="Invoiced" value={compactMoney(totalFor('INVOICE_GENERATED'))} />
        <StatCard tone="warning" label="Rejected" value={compactMoney(totalFor('PAYOUT_REJECTED'))} />
        <StatCard tone="profit" label="Adjustments" value={compactMoney(totalFor('MANUAL_ADJUSTMENT'))} />
      </div>

      {invoiceId ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">
            Showing every ledger entry for one invoice — the date window does not apply.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSearchParams({});
              setPage(1);
            }}
          >
            Show all transactions
          </Button>
        </div>
      ) : (
        <FilterBar>
          <FilterField label="Affiliate">
            <Select value={affiliateId} onChange={(event) => resetPage(setAffiliateId)(event.target.value)} className="w-64">
              <option value="">All affiliates</option>
              {(affiliates.data ?? []).map((affiliate) => (
                <option key={affiliate.id} value={affiliate.id}>
                  {affiliate.fullName ?? affiliate.companyName ?? affiliate.email}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="Event">
            <Select
              value={type}
              onChange={(event) => resetPage(setType)(event.target.value as TransactionType | '')}
              className="w-48"
            >
              <option value="">All events</option>
              {Object.entries(TYPE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="From">
            <Input type="date" value={dateFrom} onChange={(event) => resetPage(setDateFrom)(event.target.value)} />
          </FilterField>
          <FilterField label="To">
            <Input type="date" value={dateTo} onChange={(event) => resetPage(setDateTo)(event.target.value)} />
          </FilterField>
        </FilterBar>
      )}

      {rows.loading ? (
        <TableSkeleton columns={7} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={rows.data?.rows ?? []}
            getRowKey={(row) => row.id}
            emptyMessage="No transactions in this range. Generating a payout batch or marking an invoice paid records one here."
          />
          <Pagination page={page} pageSize={PAGE_SIZE} total={rows.data?.total ?? 0} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

/**
 * A bonus, a penalty, or a correction.
 *
 * Its own ledger row rather than an edit to an invoice or a conversion: those carry the
 * money the network computed, and an adjustment is the network saying something
 * different happened. Keeping the two apart is what lets every computed figure stay
 * reconcilable against the rows behind it.
 */
function AdjustmentButton({ affiliates, onDone }: { affiliates: Affiliate[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [affiliateId, setAffiliateId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);

  const parsed = Number(amount);
  const valid = affiliateId !== '' && amount.trim() !== '' && Number.isFinite(parsed) && parsed !== 0 && description.trim() !== '';

  async function run() {
    setSaving(true);
    const result = await runAction(
      () =>
        recordAdjustment({
          affiliateId,
          amount: parsed,
          description: description.trim(),
          ...(reference.trim() !== '' && { reference: reference.trim() }),
        }),
      { success: 'Adjustment recorded', onDone },
    );
    setSaving(false);
    if (result) setOpen(false);
  }

  return (
    <>
      <Button
        onClick={() => {
          setAffiliateId('');
          setAmount('');
          setDescription('');
          setReference('');
          setOpen(true);
        }}
      >
        Record adjustment
      </Button>

      <Modal open={open} onOpenChange={setOpen} title="Record adjustment">
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            A bonus, a penalty, or a correction, recorded against an affiliate. It does not change any invoice or conversion —
            those carry the figures the network computed, and this is the separate, visible exception to them.
          </p>

          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Affiliate</span>
            <Select value={affiliateId} onChange={(event) => setAffiliateId(event.target.value)} className="mt-1">
              <option value="">Select an affiliate…</option>
              {affiliates.map((affiliate) => (
                <option key={affiliate.id} value={affiliate.id}>
                  {affiliate.fullName ?? affiliate.companyName ?? affiliate.email}
                </option>
              ))}
            </Select>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Amount</span>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="250 for a bonus, -50 for a deduction"
              className="mt-1"
            />
            <span className="mt-1 block text-[11px] text-muted-foreground">
              Signed: positive credits the affiliate, negative deducts. Zero records nothing and is rejected.
            </span>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Reason</span>
            <Textarea
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Q3 performance bonus"
              className="mt-1"
            />
            <span className="mt-1 block text-[11px] text-muted-foreground">
              Shown to the affiliate and kept on the ledger row — this is the only entry with no invoice behind it to explain
              itself.
            </span>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Reference (optional)</span>
            <Input value={reference} onChange={(event) => setReference(event.target.value)} className="mt-1" />
          </label>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={saving || !valid} onClick={run}>
              {saving ? 'Saving…' : 'Record adjustment'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
