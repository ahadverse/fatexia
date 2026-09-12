import { useCallback, useMemo, useState } from 'react';
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
  presetRange,
  toApiRange,
  useDeferredFilters,
  type ColumnOption,
  type DataTableColumn,
  type DateRange,
  type FixedPresetId,
  type TableSort,
} from '@fatexia/ui';
import type { Advertiser, Affiliate, Offer, ReportDimension, ReportRow } from '@fatexia/types';
import { getClickCountries, getGroupedReport } from '../lib/reports-api';
import { getOffers } from '../lib/offers-api';
import { getAffiliates } from '../lib/affiliates-api';
import { getAdvertisers } from '../lib/advertisers-api';
import { useAsync } from '../hooks/useAsync';
import { compactMoney, money, number, percent } from '../lib/format';

/**
 * The shared body of every grouped report page.
 *
 * PLAN-admin.md calls for one reporting module with shared filter components rather
 * than 13 one-off pages — the report screens differ only by which dimension they group
 * on and whether the reader can change it, so they all render through this.
 */

export interface ReportViewProps {
  title: string;
  description: string;
  /** Fixed grouping, e.g. the per-offer report. Omit to let the reader pick. */
  dimension?: ReportDimension;
  /**
   * Window the page opens on. Defaults to today, which suits a report someone checks
   * during the day; an overview page opening on a quiet morning would show an empty
   * table and read as broken, so those pass a wider one. A preset id rather than a
   * range so the value is stable across renders.
   */
  initialPreset?: FixedPresetId;
  /** Dimensions offered in the group-by picker when `dimension` is not fixed. */
  selectableDimensions?: ReportDimension[];
  /** Renders the trend chart above the table. Only meaningful for date grouping. */
  showTrend?: boolean;
}

const DIMENSION_LABELS: Record<ReportDimension, string> = {
  date: 'Date',
  offer: 'Offer',
  affiliate: 'Affiliate',
  advertiser: 'Advertiser',
  country: 'Country',
  city: 'City',
  device: 'Device',
  os: 'OS',
  browser: 'Browser',
  subId1: 'Sub ID 1',
  subId2: 'Sub ID 2',
  subId3: 'Sub ID 3',
  subId4: 'Sub ID 4',
  subId5: 'Sub ID 5',
  subId6: 'Sub ID 6',
  subId7: 'Sub ID 7',
  subId8: 'Sub ID 8',
};

// The server caps a grouped report at this many rows. Grouping by city or a sub-id can
// exceed it, and a silently truncated report is worse than a visible warning.
const ROW_LIMIT = 500;
const PAGE_SIZES = [25, 50, 100, 250];

// Metric columns the reader can show or hide. The grouped dimension itself is always
// present — a report with no label column is not a report.
const METRIC_COLUMNS: (ColumnOption & { render: (row: ReportRow) => string; csv: (row: ReportRow) => string | number })[] = [
  { key: 'clicks', label: 'Clicks', render: (r) => number(r.clicks), csv: (r) => r.clicks },
  { key: 'uniqueClicks', label: 'Unique', render: (r) => number(r.uniqueClicks), csv: (r) => r.uniqueClicks },
  { key: 'conversions', label: 'Conversions', render: (r) => number(r.conversions), csv: (r) => r.conversions },
  { key: 'approvedConversions', label: 'Approved', render: (r) => number(r.approvedConversions), csv: (r) => r.approvedConversions },
  { key: 'rejectedConversions', label: 'Rejected', render: (r) => number(r.rejectedConversions), csv: (r) => r.rejectedConversions },
  { key: 'conversionRate', label: 'CR%', render: (r) => percent(r.conversionRate), csv: (r) => r.conversionRate },
  { key: 'revenue', label: 'Revenue', render: (r) => money(r.revenue), csv: (r) => r.revenue },
  { key: 'payout', label: 'Payout', render: (r) => money(r.payout), csv: (r) => r.payout },
  { key: 'profit', label: 'Profit', render: (r) => money(r.profit), csv: (r) => r.profit },
  { key: 'epc', label: 'EPC', render: (r) => money(r.epc), csv: (r) => r.epc },
  { key: 'blockedClicks', label: 'Blocked', render: (r) => number(r.blockedClicks), csv: (r) => r.blockedClicks },
  { key: 'suspectClicks', label: 'Suspect', render: (r) => number(r.suspectClicks), csv: (r) => r.suspectClicks },
];

const DEFAULT_COLUMNS = ['clicks', 'uniqueClicks', 'conversions', 'conversionRate', 'revenue', 'payout', 'profit', 'epc'];

// The range is not in here: it lives in the page header and applies on selection, so it
// is never part of what the Apply button has pending.
interface ReportFilterDraft {
  offerId: string;
  affiliateId: string;
  advertiserId: string;
  countryCode: string;
}

const EMPTY_FILTERS: ReportFilterDraft = { offerId: '', affiliateId: '', advertiserId: '', countryCode: '' };

export function ReportView({ title, description, dimension, initialPreset, selectableDimensions, showTrend }: ReportViewProps) {
  // Resolved on each call rather than memoised: "last 30 days" fixed at mount would hand
  // back a stale window to someone who left the tab open overnight.
  const baseRange = useCallback(() => (initialPreset ? presetRange(initialPreset) : defaultRange()), [initialPreset]);

  /*
   * The date range is the one filter that sits beside the title and takes effect as soon
   * as it is picked — the same place and behaviour as the dashboard, conversions and
   * postback logs. Buried among the selects behind an Apply button it read as a
   * different control from the one on every other screen, which is the complaint that
   * moved it.
   */
  const [range, setRange] = useState<DateRange>(baseRange);
  const { draft, setDraft, applied, apply, clear, dirty } = useDeferredFilters(EMPTY_FILTERS);

  const [groupBy, setGroupBy] = useState<ReportDimension>(dimension ?? selectableDimensions?.[0] ?? 'date');
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [sort, setSort] = useState<TableSort | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const apiRange = toApiRange(range);
  const activeDimension = dimension ?? groupBy;

  const filters = useMemo(
    () => ({
      ...apiRange,
      offerId: applied.offerId || undefined,
      affiliateId: applied.affiliateId || undefined,
      advertiserId: applied.advertiserId || undefined,
      countryCode: applied.countryCode || undefined,
    }),
    [apiRange.dateFrom, apiRange.dateTo, applied],
  );

  const report = useAsync(() => getGroupedReport(activeDimension, filters, ROW_LIMIT), [activeDimension, filters]);

  // Filter option lists are loaded once and reused across every filter change.
  const offers = useAsync<Offer[]>(() => getOffers(), []);
  // ACTIVE only: a pending or rejected application has never sent traffic, so it can
  // only ever filter the report down to nothing.
  const affiliates = useAsync<Affiliate[]>(() => getAffiliates({ status: 'ACTIVE' }), []);
  const advertisers = useAsync<Advertiser[]>(() => getAdvertisers(), []);
  const countries = useAsync<string[]>(() => getClickCountries(), []);

  const allRows = report.data?.rows ?? [];
  const totals = report.data?.totals;
  const activeMetrics = METRIC_COLUMNS.filter((column) => visibleColumns.includes(column.key));

  // Sorting and paging happen client-side: the server already returns the whole
  // grouped set (capped at ROW_LIMIT), and re-querying to reorder a few hundred rows
  // in memory would be a round-trip for nothing.
  const sortedRows = useMemo(() => {
    if (!sort) return allRows;
    const factor = sort.direction === 'ASC' ? 1 : -1;
    return [...allRows].sort((a, b) => {
      if (sort.key === 'label') return factor * a.label.localeCompare(b.label);
      const left = a[sort.key as keyof ReportRow];
      const right = b[sort.key as keyof ReportRow];
      return factor * (Number(left) - Number(right));
    });
  }, [allRows, sort]);

  const pageRows = useMemo(
    () => sortedRows.slice((page - 1) * pageSize, page * pageSize),
    [sortedRows, page, pageSize],
  );

  function runFilter() {
    setPage(1);
    apply();
  }

  function exportCsv() {
    downloadCsv(
      `${activeDimension}-report.csv`,
      [DIMENSION_LABELS[activeDimension], ...activeMetrics.map((column) => column.label)],
      // Exports every row of the current result, not just the visible page, but only
      // the columns the reader chose to see.
      sortedRows.map((row) => [row.label, ...activeMetrics.map((column) => column.csv(row))]),
    );
  }

  const columns: DataTableColumn<ReportRow>[] = [
    { key: 'label', header: DIMENSION_LABELS[activeDimension], sortable: true, render: (row) => row.label },
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
        title={title}
        description={description}
        actions={
          <>
            {/* No label above the trigger — in the header it stands beside a button, and
                the label would offset it by half a line. The trigger reads the range out
                itself, and carries it in aria-label. */}
            <DateRangeFilter
              value={range}
              label=""
              onChange={(next) => {
                setPage(1);
                setRange(next);
              }}
            />
            <Button variant="outline" disabled={allRows.length === 0} onClick={exportCsv}>
              Export CSV
            </Button>
          </>
        }
      />

      {totals && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatCard tone="traffic" label="Clicks" value={number(totals.clicks)} />
          <StatCard tone="traffic" label="Unique" value={number(totals.uniqueClicks)} />
          <StatCard tone="traffic" label="Conversions" value={number(totals.conversions)} />
          <StatCard tone="money" label="Payout" value={compactMoney(totals.payout)} />
          <StatCard tone="profit" label="Profit" value={compactMoney(totals.profit)} />
        </div>
      )}

      <FilterBar
        title="Filter"
        right={
          <>
            <Button size="sm" onClick={runFilter}>
              {dirty ? 'Apply filters' : 'Filter'}
            </Button>
            {/* Clear puts the date back to the page's own window too, so it returns the
                screen to the state it opened in rather than only half of it. */}
            <Button size="sm" variant="outline" onClick={() => { setPage(1); setRange(baseRange()); clear(); }}>
              Clear
            </Button>
          </>
        }
      >
        {!dimension && selectableDimensions && (
          <FilterField label="Group by">
            <Select
              value={groupBy}
              onChange={(event) => {
                setPage(1);
                setSort(undefined);
                setGroupBy(event.target.value as ReportDimension);
              }}
              className="w-40"
            >
              {selectableDimensions.map((option) => (
                <option key={option} value={option}>
                  {DIMENSION_LABELS[option]}
                </option>
              ))}
            </Select>
          </FilterField>
        )}

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

        <FilterField label="Affiliate">
          <Select value={draft.affiliateId} onChange={(e) => setDraft({ ...draft, affiliateId: e.target.value })} className="w-52">
            <option value="">All affiliates</option>
            {(affiliates.data ?? []).map((affiliate) => (
              <option key={affiliate.id} value={affiliate.id}>
                {affiliate.fullName ?? affiliate.email}
              </option>
            ))}
          </Select>
        </FilterField>

        <FilterField label="Advertiser">
          <Select value={draft.advertiserId} onChange={(e) => setDraft({ ...draft, advertiserId: e.target.value })} className="w-52">
            <option value="">All advertisers</option>
            {(advertisers.data ?? []).map((advertiser) => (
              <option key={advertiser.id} value={advertiser.id}>
                {advertiser.name}
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

      {showTrend && report.data && (
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
            emptyMessage="No traffic matched these filters."
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
