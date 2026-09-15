import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Button,
  ConfirmModal,
  DataTable,
  FilterBar,
  FilterField,
  Input,
  Modal,
  PageHeader,
  Pagination,
  Select,
  SelectCombobox,
  StatCard,
  TableSkeleton,
  Tabs,
  Textarea,
  type DataTableColumn,
  type SelectComboboxOption,
} from '@fatexia/ui';
import type { Affiliate, Invoice, InvoiceStatus, Paginated, PaymentMethod, PendingBalance } from '@fatexia/types';
import {
  createManualInvoice,
  deleteInvoice,
  generatePayoutBatch,
  getInvoices,
  getPendingBalances,
  releaseInvoice,
  updateInvoiceStatus,
} from '../../lib/billing-api';
import { getAffiliates } from '../../lib/affiliates-api';
import { runAction, useAsync, type AsyncState } from '../../hooks/useAsync';
import { compactMoney, date, dateTime, daysAgoIso, isoDate, money, number } from '../../lib/format';
import { StatusPill } from '../../components/StatusPill';

const PAGE_SIZE = 25;

const METHOD_LABEL: Record<PaymentMethod, string> = {
  BANK_TRANSFER: 'Bank transfer',
  PAYPAL: 'PayPal',
  CRYPTO: 'Cryptocurrency',
};

/** Which panel the invoice dialog is showing: its details, or one of the actions. */
type InvoiceAction = 'details' | 'pay' | 'reject' | 'release';

/**
 * Affiliates as combobox rows.
 *
 * The public id (`AFF-1011`) is displayed, not just searchable: it is what support, the
 * affiliate and an invoice conversation all quote, and two affiliates on a network
 * genuinely can share a display name. An older row without one falls back to the email
 * rather than showing a bare name with nothing to tell it apart.
 */
function affiliateOptions(affiliates: Affiliate[]): SelectComboboxOption[] {
  return affiliates.map((affiliate) => ({
    value: affiliate.id,
    label: affiliate.fullName ?? affiliate.companyName ?? affiliate.email,
    sublabel: affiliate.publicId ?? affiliate.email,
    // Matched but not shown: the email behind a row labelled by name, and the uuid that
    // turns up in URLs and logs when someone is chasing a specific record.
    keywords: `${affiliate.email} ${affiliate.id}`,
  }));
}

/**
 * The same, for the payout-batch picker, which lists balances rather than affiliates.
 *
 * Here the unbilled figure takes the visible slot — it is the reason that list exists —
 * and the id stays findable through `keywords`, joined from the affiliate list since a
 * balance row carries only a name.
 */
function balanceOptions(balances: PendingBalance[], affiliates: Affiliate[]): SelectComboboxOption[] {
  const byId = new Map(affiliates.map((affiliate) => [affiliate.id, affiliate]));
  return balances.map((row) => {
    const affiliate = byId.get(row.affiliateId);
    return {
      value: row.affiliateId,
      label: row.affiliateName ?? row.affiliateId,
      sublabel: `${money(row.eligibleAmount)} unbilled`,
      keywords: `${affiliate?.publicId ?? ''} ${affiliate?.email ?? ''} ${row.affiliateId}`,
    };
  });
}

export function Invoices() {
  // Invoices, not balances: the page is called Invoices and this is what someone opening
  // it came to see. Pending balances is the preview you check *before* a batch, which is
  // a step behind — and on a network with no unbilled conversions it opens onto an empty
  // table, making the whole page look broken.
  const [tab, setTab] = useState('invoices');
  const [status, setStatus] = useState<InvoiceStatus | ''>('');
  const [affiliateFilter, setAffiliateFilter] = useState('');
  const [page, setPage] = useState(1);

  const balances = useAsync<PendingBalance[]>(() => getPendingBalances(), []);
  const affiliates = useAsync<Affiliate[]>(() => getAffiliates(), []);
  const invoices = useAsync(
    () =>
      getInvoices({
        status: status || undefined,
        affiliateId: affiliateFilter || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    [status, affiliateFilter, page],
  );

  function reloadAll() {
    balances.reload();
    invoices.reload();
  }

  const payableTotal = (balances.data ?? []).filter((row) => row.meetsThreshold).reduce((sum, row) => sum + row.eligibleAmount, 0);
  const heldTotal = (balances.data ?? []).filter((row) => !row.meetsThreshold).reduce((sum, row) => sum + row.eligibleAmount, 0);

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="Affiliate payout batches. Balances are recomputed from conversions on every read — nothing here is a stored total that could drift."
        actions={
          <div className="flex flex-wrap gap-2">
            <ManualInvoiceButton affiliates={affiliates.data ?? []} balances={balances.data ?? []} onDone={reloadAll} />
            <BatchButton
              balances={balances.data ?? []}
              affiliates={affiliates.data ?? []}
              onDone={reloadAll}
              onGenerated={() => setTab('invoices')}
            />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            invoice. A batch skips affiliates below the network minimum — <span className="text-card-foreground">Create invoice</span>{' '}
            raises one for anybody, at any amount, including zero.
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
        <InvoiceList
          invoices={invoices}
          affiliates={affiliates.data ?? []}
          status={status}
          affiliateFilter={affiliateFilter}
          page={page}
          onStatusChange={(next) => {
            setStatus(next);
            setPage(1);
          }}
          onAffiliateChange={(next) => {
            setAffiliateFilter(next);
            setPage(1);
          }}
          onPageChange={setPage}
          onChanged={reloadAll}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------ invoice list

function InvoiceList({
  invoices,
  affiliates,
  status,
  affiliateFilter,
  page,
  onStatusChange,
  onAffiliateChange,
  onPageChange,
  onChanged,
}: {
  invoices: AsyncState<Paginated<Invoice>>;
  affiliates: Affiliate[];
  status: InvoiceStatus | '';
  affiliateFilter: string;
  page: number;
  onStatusChange: (status: InvoiceStatus | '') => void;
  onAffiliateChange: (affiliateId: string) => void;
  onPageChange: (page: number) => void;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState<Invoice | null>(null);

  const columns: DataTableColumn<Invoice>[] = [
    { key: 'number', header: 'Invoice', render: (row) => row.invoiceNumber },
    { key: 'affiliate', header: 'Affiliate', render: (row) => row.affiliateName ?? row.affiliateId },
    { key: 'period', header: 'Period', render: (row) => `${date(row.periodFrom)} – ${date(row.periodTo)}` },
    { key: 'conversions', header: 'Conversions', render: (row) => number(row.conversionCount) },
    { key: 'amount', header: 'Amount', render: (row) => money(row.amount, row.currency) },
    { key: 'method', header: 'Method', render: (row) => METHOD_LABEL[row.paymentMethod] },
    {
      key: 'status',
      header: 'Status',
      // A released invoice is stored as REJECTED, but the two mean different things to
      // whoever is looking at this row: one failed and still holds its conversions, the
      // other gave them back. The pill says which.
      render: (row) => <StatusPill status={row.status} label={row.releasedAt ? 'RELEASED' : undefined} />,
    },
    { key: 'paidAt', header: 'Paid', render: (row) => dateTime(row.paidAt) },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <Button size="sm" variant="outline" onClick={() => setOpen(row)}>
          Manage
        </Button>
      ),
    },
  ];

  return (
    <>
      <FilterBar>
        <FilterField label="Status">
          <Select value={status} onChange={(event) => onStatusChange(event.target.value as InvoiceStatus | '')} className="w-44">
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="PAID">Paid</option>
            <option value="REJECTED">Rejected</option>
          </Select>
        </FilterField>
        <FilterField label="Affiliate">
          <SelectCombobox
            options={affiliateOptions(affiliates)}
            value={affiliateFilter}
            onChange={onAffiliateChange}
            placeholder="All affiliates"
            clearLabel="All affiliates"
            className="w-64"
          />
        </FilterField>
      </FilterBar>

      {invoices.loading ? (
        <TableSkeleton columns={9} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={invoices.data?.rows ?? []}
            getRowKey={(row) => row.id}
            emptyMessage="No invoices match this filter. Generate a payout batch, or create one for a single affiliate."
          />
          <Pagination page={page} pageSize={PAGE_SIZE} total={invoices.data?.total ?? 0} onPageChange={onPageChange} />
        </>
      )}

      <InvoiceDialog
        invoice={open}
        onClose={() => setOpen(null)}
        onChanged={() => {
          setOpen(null);
          onChanged();
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------- invoice dialog

/**
 * One dialog for everything an invoice can have done to it.
 *
 * The actions used to be separate buttons in the table row, which meant the row could
 * only ever afford one of them ("Mark paid") and the rest did not exist. Opening the
 * invoice first also puts the amount, the period and the note in front of whoever is
 * about to say money moved.
 */
function InvoiceDialog({
  invoice,
  onClose,
  onChanged,
}: {
  invoice: Invoice | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [action, setAction] = useState<InvoiceAction>('details');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function close() {
    setAction('details');
    setReference('');
    setNotes('');
    setConfirmingDelete(false);
    onClose();
  }

  async function confirmDelete() {
    if (!invoice) return;
    setDeleting(true);
    const result = await runAction(() => deleteInvoice(invoice.id), { success: `${invoice.invoiceNumber} deleted` });
    setDeleting(false);
    if (result !== null) {
      setConfirmingDelete(false);
      onChanged();
    }
  }

  async function run(work: () => Promise<unknown>, success: string) {
    setSaving(true);
    const result = await runAction(work, { success });
    setSaving(false);
    if (result) {
      setAction('details');
      setReference('');
      setNotes('');
      onChanged();
    }
  }

  // After the hooks, so the dialog's draft state is reset by `close()` rather than by
  // being unmounted — reopening a different invoice must not inherit the last note.
  if (!invoice) return null;

  const released = !!invoice.releasedAt;
  const paid = invoice.status === 'PAID';
  // The only status where no money moved — a paid invoice is real payout history and
  // stays undeletable regardless of whether it was later released.
  const canDelete = invoice.status === 'REJECTED';

  return (
    <Modal open onOpenChange={(next) => !next && close()} title={invoice.invoiceNumber}>
      <div className="space-y-4">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Affiliate" value={invoice.affiliateName ?? invoice.affiliateId} />
          <Field label="Amount" value={money(invoice.amount, invoice.currency)} />
          <Field label="Period" value={`${date(invoice.periodFrom)} – ${date(invoice.periodTo)}`} />
          <Field label="Conversions" value={number(invoice.conversionCount)} />
          <Field label="Method" value={METHOD_LABEL[invoice.paymentMethod]} />
          <Field label="Raised" value={dateTime(invoice.createdAt)} />
          <Field label="Paid" value={dateTime(invoice.paidAt)} />
          <Field label="Reference" value={invoice.paymentReference ?? '—'} />
        </dl>

        {invoice.notes && <p className="whitespace-pre-line rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">{invoice.notes}</p>}

        {released && (
          <p className="rounded-md border border-border p-3 text-xs text-warning">
            Released on {dateTime(invoice.releasedAt)} — its conversions went back into the payable pool and are billed on a
            later invoice. This one can no longer be paid.
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          <Link to={`/billing/transactions?invoiceId=${invoice.id}`} className="text-primary hover:underline">
            View this invoice in the transaction ledger
          </Link>
        </p>

        {action === 'details' ? (
          <div className="flex flex-wrap justify-end gap-2">
            {canDelete && (
              <Button variant="destructive" disabled={saving} onClick={() => setConfirmingDelete(true)}>
                Delete
              </Button>
            )}
            {!paid && !released && invoice.status !== 'APPROVED' && (
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => run(() => updateInvoiceStatus(invoice.id, { status: 'APPROVED' }), `${invoice.invoiceNumber} approved`)}
              >
                Approve
              </Button>
            )}
            {!paid && !released && (
              <Button variant="outline" onClick={() => setAction('reject')}>
                Reject
              </Button>
            )}
            {!paid && !released && (
              <Button variant="outline" onClick={() => setAction('release')}>
                Release
              </Button>
            )}
            {!paid && !released && <Button onClick={() => setAction('pay')}>Mark paid</Button>}
            {(paid || released) && (
              <Button variant="outline" onClick={close}>
                Close
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4 border-t border-border pt-4">
            {action === 'pay' && (
              <>
                <p className="text-xs text-muted-foreground">
                  This also moves the {number(invoice.conversionCount)} conversions on this invoice to PAID — the two are never
                  updated independently.
                </p>
                <label className="block">
                  <span className="text-xs font-medium text-muted-foreground">Payment reference</span>
                  <Input
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                    placeholder="Wire reference or PayPal batch id"
                    className="mt-1"
                  />
                </label>
              </>
            )}

            {action === 'reject' && (
              <p className="text-xs text-muted-foreground">
                Records that the payout failed and emails the affiliate your note. The conversions stay attached to this
                invoice, so the amount still reconciles — use <span className="text-card-foreground">Release</span> to put them
                back in the payable pool.
              </p>
            )}

            {action === 'release' && (
              <p className="text-xs text-warning">
                Cancels this invoice and returns its {number(invoice.conversionCount)} conversions to the payable pool, where the
                next batch will pick them up. This cannot be undone, and the invoice can never be paid afterwards.
              </p>
            )}

            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">
                {action === 'pay' ? 'Notes' : action === 'reject' ? 'Reason (sent to the affiliate)' : 'Reason'}
              </span>
              <Textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1" />
            </label>

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => setAction('details')}>
                Back
              </Button>
              <Button
                disabled={saving}
                onClick={() => {
                  if (action === 'pay') {
                    return run(
                      () =>
                        updateInvoiceStatus(invoice.id, {
                          status: 'PAID',
                          paymentReference: reference || undefined,
                          notes: notes || undefined,
                        }),
                      `${invoice.invoiceNumber} marked paid`,
                    );
                  }
                  if (action === 'reject') {
                    return run(
                      () => updateInvoiceStatus(invoice.id, { status: 'REJECTED', notes: notes || undefined }),
                      `${invoice.invoiceNumber} rejected`,
                    );
                  }
                  return run(
                    () => releaseInvoice(invoice.id, { notes: notes || undefined }),
                    `${invoice.invoiceNumber} released — its conversions are payable again`,
                  );
                }}
              >
                {saving ? 'Saving…' : action === 'pay' ? 'Mark paid' : action === 'reject' ? 'Reject payout' : 'Release invoice'}
              </Button>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={`Delete ${invoice.invoiceNumber}?`}
        description={`This permanently removes the invoice row. ${
          released
            ? 'Its conversions are already back in the payable pool.'
            : 'Its conversions are still stamped with it and will be returned to the payable pool as part of this delete.'
        } The ledger rows it produced stay on the Transactions page as history. This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={confirmDelete}
      />
    </Modal>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-card-foreground">{value}</dd>
    </div>
  );
}

// ------------------------------------------------------------------ batch dialog

function BatchButton({
  balances,
  affiliates,
  onDone,
  onGenerated,
}: {
  balances: PendingBalance[];
  affiliates: Affiliate[];
  onDone: () => void;
  onGenerated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [periodFrom, setPeriodFrom] = useState(daysAgoIso(30));
  const [periodTo, setPeriodTo] = useState(isoDate(new Date()));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('BANK_TRANSFER');
  // '' = every affiliate with an eligible balance, which is the original batch
  // behaviour and stays the default.
  const [affiliateId, setAffiliateId] = useState('');
  const [ignoreThreshold, setIgnoreThreshold] = useState(false);
  const [generating, setGenerating] = useState(false);

  async function run() {
    setGenerating(true);
    const result = await runAction(
      () =>
        generatePayoutBatch({
          periodFrom: `${periodFrom}T00:00:00.000Z`,
          periodTo: `${periodTo}T23:59:59.999Z`,
          paymentMethod,
          ...(affiliateId && { affiliateIds: [affiliateId] }),
          ignoreThreshold,
        }),
      { success: 'Payout batch generated', onDone },
    );
    setGenerating(false);
    if (result) {
      setOpen(false);
      onGenerated();
    }
  }

  return (
    <>
      <Button
        onClick={() => {
          // Both exceptions reset on open — a waived minimum left armed from a
          // previous run would quietly pay out the next batch below threshold.
          setAffiliateId('');
          setIgnoreThreshold(false);
          setOpen(true);
        }}
      >
        Generate payout batch
      </Button>

      <Modal open={open} onOpenChange={setOpen} title="Generate payout batch">
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            One invoice per affiliate, covering only the conversions that fall inside the period below. The whole run is a
            single database transaction: the amount is summed from the conversions themselves and each one is stamped with its
            invoice in the same commit, so a conversion can never land on two batches.
          </p>

          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Affiliate</span>
            <div className="mt-1">
              <SelectCombobox
                options={balanceOptions(balances, affiliates)}
                value={affiliateId}
                onChange={setAffiliateId}
                placeholder="Everyone with an eligible balance"
                clearLabel="Everyone with an eligible balance"
              />
            </div>
            <span className="mt-1 block text-[11px] text-muted-foreground">
              The figure shown is the affiliate's whole unbilled balance. What actually gets invoiced is only the part of it
              inside the period.
            </span>
          </label>

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
            <Select
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
              className="mt-1"
            >
              {Object.entries(METHOD_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </label>

          {/* The minimum exists so the network doesn't spend a bank fee settling a
              trivial amount. Waiving it is a deliberate exception — an affiliate
              leaving, a correction, a balance that will never grow — so it is off by
              default and re-arms every time the dialog opens. */}
          <Checkbox
            checked={ignoreThreshold}
            onChange={setIgnoreThreshold}
            title="Pay below the network minimum"
            description="Invoice the affiliate even if their total for this period is under the minimum payout threshold. The amount is still summed from their real conversions."
          />

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={generating} onClick={run}>
              {generating ? 'Generating…' : 'Generate batch'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// ----------------------------------------------------------------- manual invoice

/**
 * One invoice for one affiliate, with none of the batch's rules.
 *
 * The batch is the safe bulk path and is right almost every time; this exists for the
 * cases it deliberately skips — a bonus invoice, a correction, an affiliate leaving
 * with a few dollars on the books, a zero-value record closing a period off. So there
 * is no threshold, no requirement that conversions be found, and no requirement that
 * the amount be above zero.
 */
function ManualInvoiceButton({
  affiliates,
  balances,
  onDone,
}: {
  affiliates: Affiliate[];
  balances: PendingBalance[];
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [affiliateId, setAffiliateId] = useState('');
  const [periodFrom, setPeriodFrom] = useState(daysAgoIso(30));
  const [periodTo, setPeriodTo] = useState(isoDate(new Date()));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('BANK_TRANSFER');
  const [status, setStatus] = useState<InvoiceStatus>('PENDING');
  const [includeConversions, setIncludeConversions] = useState(true);
  const [ignoreHoldWindow, setIgnoreHoldWindow] = useState(false);
  // Left blank the server sums whatever conversions the period holds — which may be
  // nothing. A typed value overrides that total and is recorded as an override.
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const unbilled = balances.find((row) => row.affiliateId === affiliateId);

  async function run() {
    setSaving(true);
    const result = await runAction(
      () =>
        createManualInvoice({
          affiliateId,
          periodFrom: `${periodFrom}T00:00:00.000Z`,
          periodTo: `${periodTo}T23:59:59.999Z`,
          paymentMethod,
          status,
          includeConversions,
          ignoreHoldWindow,
          // `''` means "compute it"; `'0'` means a deliberate zero, so the check is on
          // the empty string rather than on falsiness.
          ...(amount.trim() !== '' && { amount: Number(amount) }),
          ...(notes.trim() !== '' && { notes }),
        }),
      { success: 'Invoice created', onDone },
    );
    setSaving(false);
    if (result) setOpen(false);
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setAffiliateId('');
          setAmount('');
          setNotes('');
          setIncludeConversions(true);
          setIgnoreHoldWindow(false);
          setStatus('PENDING');
          setOpen(true);
        }}
      >
        Create invoice
      </Button>

      <Modal open={open} onOpenChange={setOpen} title="Create invoice">
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            One invoice for one affiliate, with none of the batch's rules applied: no minimum threshold, no requirement that
            conversions exist, and no requirement that the amount be above zero.
          </p>

          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Affiliate</span>
            <div className="mt-1">
              {/* No `clearLabel`: an invoice must belong to somebody, so there is no
                  "none" state to offer here. */}
              <SelectCombobox
                options={affiliateOptions(affiliates)}
                value={affiliateId}
                onChange={setAffiliateId}
                placeholder="Select an affiliate…"
              />
            </div>
            <span className="mt-1 block text-[11px] text-muted-foreground">
              {affiliateId
                ? unbilled
                  ? `${money(unbilled.eligibleAmount)} unbilled across ${number(unbilled.eligibleConversions)} conversions.`
                  : 'No payout-eligible conversions — an invoice raised here will be for whatever amount you enter.'
                : 'Every affiliate can be invoiced, not only those with a balance.'}
            </span>
          </label>

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

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Payment method</span>
              <Select
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                className="mt-1"
              >
                {Object.entries(METHOD_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Status</span>
              <Select value={status} onChange={(event) => setStatus(event.target.value as InvoiceStatus)} className="mt-1">
                <option value="DRAFT">Draft</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
              </Select>
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Amount</span>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder={includeConversions ? 'Leave blank to sum the conversions' : '0.00'}
              className="mt-1"
            />
            <span className="mt-1 block text-[11px] text-muted-foreground">
              Blank sums the conversions found in the period. A typed value overrides that total and is recorded on the invoice
              as an override, so it is never mistaken for a computed figure. Zero is allowed.
            </span>
          </label>

          <Checkbox
            checked={includeConversions}
            onChange={setIncludeConversions}
            title="Attach the affiliate's payable conversions"
            description="Pulls their approved, unbilled conversions for this period onto the invoice and stamps them, exactly as a batch does. Off raises a standalone invoice that touches no conversion at all."
          />

          {includeConversions && (
            <Checkbox
              checked={ignoreHoldWindow}
              onChange={setIgnoreHoldWindow}
              title="Ignore the hold window"
              description="Includes conversions approved too recently to have cleared the network's hold period."
            />
          )}

          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Notes</span>
            <Textarea
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Why this invoice was raised by hand"
              className="mt-1"
            />
          </label>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={saving || !affiliateId} onClick={run}>
              {saving ? 'Creating…' : 'Create invoice'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// A labelled checkbox in a bordered block — the shape both dialogs use for an
// exception the admin is opting into, so the two read the same way.
function Checkbox({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-primary"
      />
      <span className="min-w-0">
        <span className="block text-sm text-card-foreground">{title}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}
