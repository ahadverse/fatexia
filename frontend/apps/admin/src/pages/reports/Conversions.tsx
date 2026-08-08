import { useMemo, useState } from 'react';
import {
  Button,
  ConfirmModal,
  DataTable,
  FilterBar,
  FilterField,
  PageHeader,
  Pagination,
  Select,
  StatCard,
  TableSkeleton,
  type DataTableColumn,
} from '@fatexia/ui';
import type { Conversion, ConversionStatus, Offer } from '@fatexia/types';

const DECISION_COPY: Record<'APPROVED' | 'REJECTED' | 'CHARGEBACK', { title: string; description: string; confirmLabel: string; destructive: boolean }> = {
  APPROVED: {
    title: 'Approve this conversion?',
    description: 'Its payout becomes eligible for the next payout batch once the hold period elapses.',
    confirmLabel: 'Approve',
    destructive: false,
  },
  REJECTED: {
    title: 'Reject this conversion?',
    description: 'It will not be paid out.',
    confirmLabel: 'Reject',
    destructive: true,
  },
  CHARGEBACK: {
    title: 'Chargeback this conversion?',
    description: 'This reverses a conversion already marked PAID — use this only when the advertiser has genuinely disputed it.',
    confirmLabel: 'Chargeback',
    destructive: true,
  },
};
import { getConversions, updateConversionStatus } from '../../lib/reports-api';
import { getOffers } from '../../lib/offers-api';
import { runAction, useAsync } from '../../hooks/useAsync';
import { compactMoney, dateTime, duration, money, number } from '../../lib/format';
import { StatusPill } from '../../components/StatusPill';
import { DateRangeFilter, defaultRange, toApiRange, type DateRange } from '../../components/DateRangeFilter';

const STATUS_OPTIONS: ConversionStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'DUPLICATE', 'PAID', 'CHARGEBACK'];
const PAGE_SIZE = 50;

// Row-level conversion list with the review actions. PAID is deliberately absent
// from the row actions — that transition only happens through a payout batch, so a
// stray click here can never mark money as sent.
export function Conversions() {
  const [range, setRange] = useState<DateRange>(defaultRange());
  const [offerId, setOfferId] = useState('');
  const [status, setStatus] = useState<ConversionStatus | ''>('');
  const [page, setPage] = useState(1);
  const [decision, setDecision] = useState<{ row: Conversion; next: 'APPROVED' | 'REJECTED' | 'CHARGEBACK' } | null>(null);
  const [decisionSaving, setDecisionSaving] = useState(false);

  const apiRange = toApiRange(range);
  const filters = useMemo(
    () => ({ ...apiRange, offerId: offerId || undefined, status: status || undefined, page, pageSize: PAGE_SIZE }),
    [apiRange.dateFrom, apiRange.dateTo, offerId, status, page],
  );

  const conversions = useAsync(() => getConversions(filters), [filters]);
  const offers = useAsync<Offer[]>(() => getOffers(), []);

  function changeFilter(apply: () => void) {
    apply();
    setPage(1);
  }

  async function confirmDecision() {
    if (!decision) return;
    setDecisionSaving(true);
    const result = await runAction(() => updateConversionStatus(decision.row.id, decision.next), {
      success: `Conversion marked ${decision.next.toLowerCase()}`,
      onDone: conversions.reload,
    });
    setDecisionSaving(false);
    if (result) setDecision(null);
  }

  const columns: DataTableColumn<Conversion>[] = [
    { key: 'createdAt', header: 'Time', render: (row) => dateTime(row.createdAt) },
    { key: 'offer', header: 'Offer', render: (row) => row.offerName ?? '—' },
    { key: 'affiliate', header: 'Affiliate', render: (row) => row.affiliateName ?? '—' },
    { key: 'country', header: 'Geo', render: (row) => row.countryCode ?? '—' },
    { key: 'payout', header: 'Payout', render: (row) => money(row.payoutAmount, row.currency) },
    { key: 'revenue', header: 'Revenue', render: (row) => money(row.revenueAmount, row.currency) },
    { key: 'profit', header: 'Profit', render: (row) => money(row.profitAmount, row.currency) },
    // Sub-second CTIT is the strongest single conversion-fraud signal, so it gets a column.
    { key: 'ctit', header: 'CTIT', render: (row) => duration(row.ctitMs) },
    { key: 'status', header: 'Status', render: (row) => <StatusPill status={row.status} /> },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex justify-end gap-2">
          {row.status !== 'APPROVED' && row.status !== 'PAID' && (
            <Button size="sm" variant="outline" onClick={() => setDecision({ row, next: 'APPROVED' })}>
              Approve
            </Button>
          )}
          {row.status !== 'REJECTED' && row.status !== 'PAID' && (
            <Button size="sm" variant="destructive" onClick={() => setDecision({ row, next: 'REJECTED' })}>
              Reject
            </Button>
          )}
          {row.status === 'PAID' && (
            <Button size="sm" variant="destructive" onClick={() => setDecision({ row, next: 'CHARGEBACK' })}>
              Chargeback
            </Button>
          )}
        </div>
      ),
    },
  ];

  const totals = conversions.data?.totals;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conversions"
        description="Every conversion received, with the review actions that move it through the approval lifecycle."
      />

      <FilterBar right={<DateRangeFilter value={range} onChange={(next) => changeFilter(() => setRange(next))} />}>
        <FilterField label="Offer">
          <Select value={offerId} onChange={(event) => changeFilter(() => setOfferId(event.target.value))} className="w-52">
            <option value="">All offers</option>
            {(offers.data ?? []).map((offer) => (
              <option key={offer.id} value={offer.id}>
                {offer.name}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Status">
          <Select
            value={status}
            onChange={(event) => changeFilter(() => setStatus(event.target.value as ConversionStatus | ''))}
            className="w-40"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </FilterField>
      </FilterBar>

      {conversions.error && <p className="text-sm text-destructive">{conversions.error}</p>}

      {totals && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard tone="traffic" label="Conversions" value={number(totals.count)} />
          <StatCard tone="money" label="Revenue" value={compactMoney(totals.revenue)} />
          <StatCard tone="money" label="Payout" value={compactMoney(totals.payout)} />
          <StatCard tone="profit" label="Profit" value={compactMoney(totals.profit)} />
        </div>
      )}

      {conversions.loading ? (
        <TableSkeleton columns={10} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={conversions.data?.rows ?? []}
            getRowKey={(row) => row.id}
            emptyMessage="No conversions matched these filters."
          />
          <Pagination page={page} pageSize={PAGE_SIZE} total={conversions.data?.total ?? 0} onPageChange={setPage} />
        </>
      )}

      <ConfirmModal
        open={!!decision}
        onOpenChange={(open) => !open && setDecision(null)}
        title={decision ? DECISION_COPY[decision.next].title : ''}
        description={decision ? DECISION_COPY[decision.next].description : ''}
        confirmLabel={decision ? DECISION_COPY[decision.next].confirmLabel : ''}
        destructive={decision ? DECISION_COPY[decision.next].destructive : false}
        loading={decisionSaving}
        onConfirm={confirmDecision}
      />
    </div>
  );
}
