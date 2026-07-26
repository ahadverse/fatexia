import { useMemo, useState } from 'react';
import { DataTable, FilterBar, PageHeader, TableSkeleton, type DataTableColumn } from '@fatexia/ui';
import type { AffiliateOfferCr } from '@fatexia/types';
import { getAffiliateOfferCr } from '../../lib/reports-api';
import { useAsync } from '../../hooks/useAsync';
import { money, number, percent } from '../../lib/format';
import { DateRangeFilter, defaultRange, toApiRange, type DateRange } from '../../components/DateRangeFilter';

// The cross-tab of affiliate × offer — which affiliates convert well on which offers.
// Useful input for access-request approvals and manager commission decisions
// (PLAN-admin.md).
export function AffiliateOfferCr() {
  const [range, setRange] = useState<DateRange>(defaultRange());
  const apiRange = toApiRange(range);
  const filters = useMemo(() => apiRange, [apiRange.dateFrom, apiRange.dateTo]);

  const result = useAsync(() => getAffiliateOfferCr(filters), [filters]);

  const columns: DataTableColumn<AffiliateOfferCr>[] = [
    { key: 'affiliate', header: 'Affiliate', render: (row) => row.affiliateName },
    { key: 'offer', header: 'Offer', render: (row) => row.offerName },
    { key: 'clicks', header: 'Clicks', render: (row) => number(row.clicks) },
    { key: 'conversions', header: 'Conversions', render: (row) => number(row.conversions) },
    { key: 'cr', header: 'CR', render: (row) => percent(row.conversionRate) },
    { key: 'payout', header: 'Payout', render: (row) => money(row.payout) },
    { key: 'epc', header: 'EPC', render: (row) => money(row.epc) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Affiliate × Offer CR"
        description="Every affiliate/offer pairing that saw traffic in this period, ranked by conversions."
      />

      <FilterBar>
        <DateRangeFilter value={range} onChange={setRange} />
      </FilterBar>

      {result.error && <p className="text-sm text-destructive">{result.error}</p>}

      {result.loading ? (
        <TableSkeleton columns={7} />
      ) : (
        <DataTable
          columns={columns}
          rows={result.data ?? []}
          getRowKey={(row) => `${row.affiliateId}:${row.offerId}`}
          emptyMessage="No affiliate/offer pairs saw traffic in this period."
        />
      )}
    </div>
  );
}
