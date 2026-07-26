import { useMemo, useState } from 'react';
import {
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
import type { AffiliateOffer, ConversionStatus, OwnConversion } from '@fatexia/types';
import { getOwnConversions } from '../../lib/portal-api';
import { getAvailableOffers } from '../../lib/offers-api';
import { useAsync } from '../../hooks/useAsync';
import { compactMoney, dateTime, money, number } from '../../lib/format';
import { StatusPill } from '../../components/StatusPill';
import { DateRangeFilter, defaultRange, toApiRange, type DateRange } from '../../components/DateRangeFilter';

const PAGE_SIZE = 50;
const STATUS_OPTIONS: ConversionStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'DUPLICATE', 'PAID', 'CHARGEBACK'];

// Read-only: an affiliate can see the status of their conversions but never change it.
// The payload carries payout only — there is no revenue or profit field on it.
export function Conversions() {
  const [range, setRange] = useState<DateRange>(defaultRange());
  const [offerId, setOfferId] = useState('');
  const [status, setStatus] = useState<ConversionStatus | ''>('');
  const [page, setPage] = useState(1);

  const apiRange = toApiRange(range);
  const filters = useMemo(
    () => ({ ...apiRange, offerId: offerId || undefined, status: status || undefined, page, pageSize: PAGE_SIZE }),
    [apiRange.dateFrom, apiRange.dateTo, offerId, status, page],
  );

  const conversions = useAsync(() => getOwnConversions(filters), [filters]);
  const offers = useAsync<AffiliateOffer[]>(() => getAvailableOffers(), []);

  function changeFilter(apply: () => void) {
    apply();
    setPage(1);
  }

  const columns: DataTableColumn<OwnConversion>[] = [
    { key: 'createdAt', header: 'Time', render: (row) => dateTime(row.createdAt) },
    { key: 'offer', header: 'Offer', render: (row) => row.offerName ?? '—' },
    { key: 'country', header: 'Geo', render: (row) => row.countryCode ?? '—' },
    { key: 'payout', header: 'Your payout', render: (row) => money(row.payoutAmount, row.currency) },
    { key: 'status', header: 'Status', render: (row) => <StatusPill status={row.status} /> },
    { key: 'sub1', header: 'Sub ID 1', render: (row) => row.subId1 ?? '—' },
    { key: 'approvedAt', header: 'Approved', render: (row) => dateTime(row.approvedAt) },
    { key: 'paidAt', header: 'Paid', render: (row) => dateTime(row.paidAt) },
  ];

  const totals = conversions.data?.totals;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conversions"
        description="Every conversion credited to you and where it is in the approval process. Approved conversions become payable once the hold window passes."
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
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-2">
          <StatCard label="Conversions" value={number(totals.count)} />
          <StatCard label="Total payout" value={compactMoney(totals.payout)} />
        </div>
      )}

      {conversions.loading ? (
        <TableSkeleton columns={8} />
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
    </div>
  );
}
