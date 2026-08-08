import { useMemo, useState } from 'react';
import {
  Button,
  DataTable,
  DateRangeFilter,
  Drawer,
  DrawerRow,
  DrawerRows,
  FilterBar,
  FilterField,
  PageHeader,
  Pagination,
  Select,
  StatCard,
  TableSkeleton,
  defaultRange,
  downloadCsv,
  toApiRange,
  toast,
  useDeferredFilters,
  type DataTableColumn,
  type DateRange,
  type TableSort,
} from '@fatexia/ui';
import type { AffiliateOffer, OwnClickLog } from '@fatexia/types';
import { getOwnClickCountries, getOwnClicks } from '../../lib/portal-api';
import { getAvailableOffers } from '../../lib/offers-api';
import { useAsync } from '../../hooks/useAsync';
import { dateTime, number } from '../../lib/format';
import { StatusPill } from '../../components/StatusPill';

const PAGE_SIZES = [25, 50, 100, 200];

interface ClickFilterDraft {
  range: DateRange;
  offerId: string;
  countryCode: string;
  qualityStatus: string;
}

const EMPTY_FILTERS: ClickFilterDraft = {
  range: defaultRange(),
  offerId: '',
  countryCode: '',
  qualityStatus: '',
};

// What each band means for the affiliate, in payout terms rather than fraud terms —
// the signals behind the score are deliberately not on this side of the API.
const QUALITY_MEANING: Record<OwnClickLog['qualityStatus'], string> = {
  GOOD: 'Passed every quality check and was sent to the advertiser.',
  SUSPECT: 'Delivered, but flagged — conversions from it may be held for review.',
  BLOCKED: 'Failed a quality check and was not sent to the advertiser, so it cannot convert.',
  UNSCORED: 'Delivered before scoring could complete. Treated as normal traffic.',
};

function UniqueBadge({ unique }: { unique: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
        unique ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'
      }`}
    >
      {unique ? 'Yes' : 'No'}
    </span>
  );
}

function versioned(name: string | null, version: string | null): string {
  if (!name) return '—';
  return version ? `${name} ${version}` : name;
}

function ClickDetailDrawer({ click, onClose }: { click: OwnClickLog | null; onClose: () => void }) {
  async function copyClickId() {
    if (!click) return;
    try {
      await navigator.clipboard.writeText(click.id);
      toast.success('Click ID copied');
    } catch {
      toast.error('Could not copy — select the ID and copy manually');
    }
  }

  return (
    <Drawer
      open={!!click}
      onOpenChange={(open) => !open && onClose()}
      title="Click details"
      className="max-w-lg"
      footer={
        click && (
          <div className="flex justify-between gap-2">
            <Button variant="outline" size="sm" onClick={copyClickId}>
              Copy click ID
            </Button>
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        )
      }
    >
      {click && (
        <DrawerRows>
          <DrawerRow label="Click ID" mono>
            {click.id}
          </DrawerRow>
          <DrawerRow label="Date">{dateTime(click.createdAt)}</DrawerRow>
          <DrawerRow label="Offer">{click.offerName ?? '—'}</DrawerRow>
          <DrawerRow label="Country">{click.countryCode ?? click.geoLabel}</DrawerRow>
          <DrawerRow label="City">{click.city ?? '—'}</DrawerRow>
          <DrawerRow label="Region">{click.region ?? '—'}</DrawerRow>
          <DrawerRow label="Device">{click.deviceType ?? '—'}</DrawerRow>
          <DrawerRow label="Device brand">{click.deviceBrand ?? '—'}</DrawerRow>
          <DrawerRow label="IP address" mono>
            {click.ip}
          </DrawerRow>
          <DrawerRow label="Unique">
            <UniqueBadge unique={click.isUnique} />
          </DrawerRow>
          <DrawerRow label="Browser">{versioned(click.browser, click.browserVersion)}</DrawerRow>
          <DrawerRow label="OS version">{versioned(click.os, click.osVersion)}</DrawerRow>
          <DrawerRow label="User agent" mono>
            {click.userAgent ?? '—'}
          </DrawerRow>
          {[click.subId1, click.subId2, click.subId3, click.subId4, click.subId5, click.subId6, click.subId7, click.subId8].map(
            (sub, index) => (
              <DrawerRow key={index} label={`Sub${index + 1}`}>
                {sub ?? '—'}
              </DrawerRow>
            ),
          )}
          <DrawerRow label="Quality">
            <StatusPill status={click.qualityStatus} />
          </DrawerRow>
          <DrawerRow label="What this means">
            <span className="text-muted-foreground">{QUALITY_MEANING[click.qualityStatus]}</span>
          </DrawerRow>
        </DrawerRows>
      )}
    </Drawer>
  );
}

export function Clicks() {
  const { draft, setDraft, applied, apply, clear, dirty } = useDeferredFilters(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sort, setSort] = useState<TableSort>({ key: 'createdAt', direction: 'DESC' });
  const [detail, setDetail] = useState<OwnClickLog | null>(null);

  const apiRange = toApiRange(applied.range);
  const filters = useMemo(
    () => ({
      ...apiRange,
      offerId: applied.offerId || undefined,
      countryCode: applied.countryCode || undefined,
      qualityStatus: applied.qualityStatus || undefined,
      sortBy: sort.key,
      sortDir: sort.direction,
      page,
      pageSize,
    }),
    [apiRange.dateFrom, apiRange.dateTo, applied, sort, page, pageSize],
  );

  const clicks = useAsync(() => getOwnClicks(filters), [filters]);
  const offers = useAsync<AffiliateOffer[]>(() => getAvailableOffers(), []);
  const countries = useAsync<string[]>(() => getOwnClickCountries(), []);

  function runFilter() {
    setPage(1);
    apply();
  }

  function changeSort(next: TableSort) {
    setPage(1);
    setSort(next);
  }

  const rows = clicks.data?.rows ?? [];
  const summary = clicks.data?.summary;

  function exportCsv() {
    downloadCsv(
      'clicks.csv',
      ['Date', 'Offer', 'Country', 'City', 'Device', 'IP', 'Unique', 'Quality', 'Sub1', 'Sub2', 'Sub3'],
      rows.map((row) => [
        dateTime(row.createdAt),
        row.offerName ?? '',
        row.countryCode ?? '',
        row.city ?? '',
        [row.deviceType, row.os, row.browser].filter(Boolean).join(' · '),
        row.ip,
        row.isUnique ? 'Yes' : 'No',
        row.qualityStatus,
        row.subId1 ?? '',
        row.subId2 ?? '',
        row.subId3 ?? '',
      ]),
    );
  }

  const columns: DataTableColumn<OwnClickLog>[] = [
    {
      key: 'createdAt',
      header: 'Date',
      sortable: true,
      render: (row) => (
        <button type="button" onClick={() => setDetail(row)} className="text-left hover:underline">
          {dateTime(row.createdAt)}
        </button>
      ),
    },
    { key: 'offer', header: 'Offer', render: (row) => row.offerName ?? '—' },
    {
      key: 'countryCode',
      header: 'Country',
      sortable: true,
      render: (row) => (
        <div>
          <p className="text-card-foreground">{row.countryCode ?? row.geoLabel}</p>
          {row.city && <p className="text-xs text-muted-foreground">{row.city}</p>}
        </div>
      ),
    },
    { key: 'device', header: 'Device', render: (row) => [row.deviceType, row.os, row.browser].filter(Boolean).join(' · ') || '—' },
    { key: 'ip', header: 'IP', sortable: true, render: (row) => <span className="font-mono text-xs">{row.ip}</span> },
    { key: 'isUnique', header: 'Unique', sortable: true, render: (row) => <UniqueBadge unique={row.isUnique} /> },
    { key: 'quality', header: 'Quality', render: (row) => <StatusPill status={row.qualityStatus} /> },
    { key: 'sub1', header: 'Sub1', render: (row) => row.subId1 ?? '—' },
    { key: 'sub2', header: 'Sub2', render: (row) => row.subId2 ?? '—' },
    { key: 'sub3', header: 'Sub3', render: (row) => row.subId3 ?? '—' },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <Button size="sm" variant="outline" onClick={() => setDetail(row)}>
          Details
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Clicks"
        description="Every click your links generated. Open a row for the full record — blocked clicks never reach the advertiser and cannot convert."
        actions={
          <Button variant="outline" disabled={rows.length === 0} onClick={exportCsv}>
            Export CSV
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4">
        <StatCard tone="traffic" label="Total clicks" value={number(summary?.clicks ?? 0)} />
        <StatCard tone="traffic" label="Unique clicks" value={number(summary?.uniqueClicks ?? 0)} />
      </div>

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

        <FilterField label="Quality">
          <Select value={draft.qualityStatus} onChange={(e) => setDraft({ ...draft, qualityStatus: e.target.value })} className="w-36">
            <option value="">All quality</option>
            <option value="GOOD">Good</option>
            <option value="SUSPECT">Suspect</option>
            <option value="BLOCKED">Blocked</option>
            <option value="UNSCORED">Unscored</option>
          </Select>
        </FilterField>
      </FilterBar>

      {clicks.error && <p className="text-sm text-destructive">{clicks.error}</p>}

      {clicks.loading ? (
        <TableSkeleton columns={11} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={rows}
            getRowKey={(row) => row.id}
            emptyMessage="No clicks matched these filters."
            sort={sort}
            onSortChange={changeSort}
          />
          <Pagination
            page={page}
            pageSize={pageSize}
            total={clicks.data?.total ?? 0}
            onPageChange={setPage}
            pageSizeOptions={PAGE_SIZES}
            onPageSizeChange={(size) => {
              setPage(1);
              setPageSize(size);
            }}
          />
        </>
      )}

      <ClickDetailDrawer click={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
