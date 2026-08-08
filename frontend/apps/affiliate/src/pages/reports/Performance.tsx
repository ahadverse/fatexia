import { useMemo, useState } from 'react';
import {
  Button,
  ColumnPicker,
  DataTable,
  DateRangeFilter,
  FilterBar,
  FilterField,
  PageHeader,
  Pagination,
  Select,
  StatCard,
  TableSkeleton,
  TrendChart,
  defaultRange,
  downloadCsv,
  toApiRange,
  useDeferredFilters,
  type ColumnOption,
  type DataTableColumn,
  type DateRange,
  type TableSort,
} from '@fatexia/ui';
import type { AffiliateOffer, AffiliateReportRow } from '@fatexia/types';
import { getOwnClickCountries, getOwnReport } from '../../lib/portal-api';
import { getAvailableOffers } from '../../lib/offers-api';
import { useAsync } from '../../hooks/useAsync';
import { compactMoney, money, number, percent } from '../../lib/format';

/**
 * Payout-only throughout — the `/reports/mine` payload carries no revenue, profit or
 * margin field, so there is nothing here to hide at render time.
 */

const DIMENSIONS: { value: string; label: string }[] = [
  { value: 'date', label: 'Date' },
  { value: 'offer', label: 'Offer' },
  { value: 'country', label: 'Country' },
  { value: 'city', label: 'City' },
  { value: 'device', label: 'Device' },
  { value: 'os', label: 'OS' },
  { value: 'browser', label: 'Browser' },
  { value: 'subId1', label: 'Sub ID 1' },
  { value: 'subId2', label: 'Sub ID 2' },
  { value: 'subId3', label: 'Sub ID 3' },
  { value: 'subId4', label: 'Sub ID 4' },
  { value: 'subId5', label: 'Sub ID 5' },
  { value: 'subId6', label: 'Sub ID 6' },
  { value: 'subId7', label: 'Sub ID 7' },
  { value: 'subId8', label: 'Sub ID 8' },
];

const ROW_LIMIT = 500;
const PAGE_SIZES = [25, 50, 100, 250];

const METRIC_COLUMNS: (ColumnOption & {
  render: (row: AffiliateReportRow) => string;
  csv: (row: AffiliateReportRow) => string | number;
})[] = [
  { key: 'clicks', label: 'Clicks', render: (r) => number(r.clicks), csv: (r) => r.clicks },
  { key: 'uniqueClicks', label: 'Unique', render: (r) => number(r.uniqueClicks), csv: (r) => r.uniqueClicks },
  { key: 'conversions', label: 'Conversions', render: (r) => number(r.conversions), csv: (r) => r.conversions },
  { key: 'approvedConversions', label: 'Approved', render: (r) => number(r.approvedConversions), csv: (r) => r.approvedConversions },
  { key: 'rejectedConversions', label: 'Rejected', render: (r) => number(r.rejectedConversions), csv: (r) => r.rejectedConversions },
  { key: 'conversionRate', label: 'CR%', render: (r) => percent(r.conversionRate), csv: (r) => r.conversionRate },
  { key: 'payout', label: 'Earnings', render: (r) => money(r.payout), csv: (r) => r.payout },
  { key: 'epc', label: 'EPC', render: (r) => money(r.epc), csv: (r) => r.epc },
];

const DEFAULT_COLUMNS = ['clicks', 'uniqueClicks', 'conversions', 'approvedConversions', 'conversionRate', 'payout', 'epc'];

interface PerformanceFilterDraft {
  range: DateRange;
  offerId: string;
  countryCode: string;
}

export function Performance() {
  const emptyFilters = useMemo<PerformanceFilterDraft>(
    () => ({ range: defaultRange(), offerId: '', countryCode: '' }),
    [],
  );
  const { draft, setDraft, applied, apply, clear, dirty } = useDeferredFilters(emptyFilters);

  const [groupBy, setGroupBy] = useState('date');
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [sort, setSort] = useState<TableSort | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const apiRange = toApiRange(applied.range);
  const filters = useMemo(
    () => ({
      ...apiRange,
      offerId: applied.offerId || undefined,
      countryCode: applied.countryCode || undefined,
    }),
    [apiRange.dateFrom, apiRange.dateTo, applied],
  );

  const report = useAsync(() => getOwnReport(groupBy, filters, ROW_LIMIT), [groupBy, filters]);
  const offers = useAsync<AffiliateOffer[]>(() => getAvailableOffers(), []);
  const countries = useAsync<string[]>(() => getOwnClickCountries(), []);

  const allRows = report.data?.rows ?? [];
  const totals = report.data?.totals;
  const activeMetrics = METRIC_COLUMNS.filter((column) => visibleColumns.includes(column.key));
  const dimensionLabel = DIMENSIONS.find((option) => option.value === groupBy)?.label ?? 'Group';

  // Sorting and paging happen client-side: the server already returns the whole
  // grouped set (capped at ROW_LIMIT), so reordering a few hundred rows in memory is
  // cheaper than a round-trip.
  const sortedRows = useMemo(() => {
    if (!sort) return allRows;
    const factor = sort.direction === 'ASC' ? 1 : -1;
    return [...allRows].sort((a, b) => {
      if (sort.key === 'label') return factor * a.label.localeCompare(b.label);
      return factor * (Number(a[sort.key as keyof AffiliateReportRow]) - Number(b[sort.key as keyof AffiliateReportRow]));
    });
  }, [allRows, sort]);

  const pageRows = useMemo(() => sortedRows.slice((page - 1) * pageSize, page * pageSize), [sortedRows, page, pageSize]);

  function runFilter() {
    setPage(1);
    apply();
  }

  function exportCsv() {
    downloadCsv(
      'performance.csv',
      [dimensionLabel, ...activeMetrics.map((column) => column.label)],
      // Every row of the current result, but only the columns the reader chose.
      sortedRows.map((row) => [row.label, ...activeMetrics.map((column) => column.csv(row))]),
    );
  }

  const columns: DataTableColumn<AffiliateReportRow>[] = [
    { key: 'label', header: dimensionLabel, sortable: true, render: (row) => row.label },
    ...activeMetrics.map((column) => ({
      key: column.key,
      header: column.label,
      sortable: true,
      render: column.render,
    })),
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Performance"
        description="Your traffic and earnings, grouped however you need to read them."
        actions={
          <Button variant="outline" disabled={allRows.length === 0} onClick={exportCsv}>
            Export CSV
          </Button>
        }
      />

      {totals && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatCard tone="traffic" label="Clicks" value={number(totals.clicks)} />
          <StatCard tone="traffic" label="Unique" value={number(totals.uniqueClicks)} />
          <StatCard tone="traffic" label="Conversions" value={number(totals.conversions)} />
          <StatCard tone="info" label="Conversion rate" value={percent(totals.conversionRate)} />
          <StatCard tone="money" label="Earnings" value={compactMoney(totals.payout)} />
        </div>
      )}

      <FilterBar
        title="Filter"
        right={
          <>
            <Button size="sm" onClick={runFilter}>
              {dirty ? 'Apply filters' : 'Filter'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setPage(1); clear(); }}>
              Clear
            </Button>
          </>
        }
      >
        <DateRangeFilter value={draft.range} onChange={(range) => setDraft({ ...draft, range })} />

        <FilterField label="Group by">
          <Select
            value={groupBy}
            onChange={(event) => {
              setPage(1);
              setSort(undefined);
              setGroupBy(event.target.value);
            }}
            className="w-40"
          >
            {DIMENSIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </FilterField>

        <FilterField label="Offer">
          <Select value={draft.offerId} onChange={(e) => setDraft({ ...draft, offerId: e.target.value })} className="w-52">
            <option value="">All offers</option>
            {(offers.data ?? []).map((offer) => (
              <option key={offer.id} value={offer.id}>
                {offer.name}
              </option>
            ))}
          </Select>
        </FilterField>

        <FilterField label="Country">
          <Select value={draft.countryCode} onChange={(e) => setDraft({ ...draft, countryCode: e.target.value })} className="w-36">
            <option value="">All countries</option>
            {(countries.data ?? []).map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
        </FilterField>
      </FilterBar>

      <ColumnPicker options={METRIC_COLUMNS} value={visibleColumns} onChange={setVisibleColumns} />

      {report.error && <p className="text-sm text-destructive">{report.error}</p>}

      {allRows.length === ROW_LIMIT && (
        <p className="text-xs text-warning">
          Showing the first {ROW_LIMIT} groups. Narrow the filters or group by something coarser to see the rest.
        </p>
      )}

      {groupBy === 'date' && report.data && (
        <TrendChart
          points={allRows.map((row) => ({ label: row.label, values: [row.clicks, row.conversions] }))}
          seriesNames={['Clicks', 'Conversions']}
          formatValue={(value) => number(Math.round(value))}
        />
      )}

      {report.loading ? (
        <TableSkeleton columns={activeMetrics.length + 1} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={pageRows}
            getRowKey={(row) => row.key}
            emptyMessage="No traffic in this period."
            sort={sort}
            onSortChange={(next) => {
              setPage(1);
              setSort(next);
            }}
          />
          <Pagination
            page={page}
            pageSize={pageSize}
            total={sortedRows.length}
            onPageChange={setPage}
            pageSizeOptions={PAGE_SIZES}
            onPageSizeChange={(size) => {
              setPage(1);
              setPageSize(size);
            }}
          />
        </>
      )}
    </div>
  );
}
