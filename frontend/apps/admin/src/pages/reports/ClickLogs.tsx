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
import type { Affiliate, ClickLog, Offer } from '@fatexia/types';
import { getClickCountries, getClickLogs } from '../../lib/reports-api';
import { getOffers } from '../../lib/offers-api';
import { getAffiliates } from '../../lib/affiliates-api';
import { useAsync } from '../../hooks/useAsync';
import { dateTime, number } from '../../lib/format';
import { StatusPill } from '../../components/StatusPill';

const QUALITY_OPTIONS = ['GOOD', 'SUSPECT', 'BLOCKED', 'UNSCORED'];
const PAGE_SIZES = [25, 50, 100, 200];

interface ClickFilterDraft {
  range: DateRange;
  offerId: string;
  affiliateId: string;
  countryCode: string;
  qualityStatus: string;
}

const EMPTY_FILTERS: ClickFilterDraft = {
  range: defaultRange(),
  offerId: '',
  affiliateId: '',
  countryCode: '',
  qualityStatus: '',
};

// Tri-state, because the proxy check has three outcomes and collapsing "never ran"
// into "no" would present an unscored click as a clean one.
function flag(value: boolean | null): string {
  if (value === null) return 'Not checked';
  return value ? 'Yes' : 'No';
}

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

/** "Chrome 131.0" — the version is only useful attached to the name. */
function versioned(name: string | null, version: string | null): string {
  if (!name) return '—';
  return version ? `${name} ${version}` : name;
}

function ClickDetailDrawer({ click, onClose }: { click: ClickLog | null; onClose: () => void }) {
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
          <DrawerRow label="Affiliate">{click.affiliateName ?? 'Unattributed'}</DrawerRow>
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

          {/* Admin-only fraud reasoning — deliberately absent from the affiliate drawer. */}
          <DrawerRow label="Quality">
            <StatusPill status={click.qualityStatus} />
          </DrawerRow>
          <DrawerRow label="Risk score">{number(click.riskScore)}</DrawerRow>
          <DrawerRow label="Datacenter IP">{flag(click.isDatacenter)}</DrawerRow>
          <DrawerRow label="Proxy / VPN">{flag(click.isProxyOrVpn)}</DrawerRow>
          <DrawerRow label="ASN">{click.asn ?? '—'}</DrawerRow>
          <DrawerRow label="Referer" mono>
            {click.referer ?? '—'}
          </DrawerRow>
        </DrawerRows>
      )}
    </Drawer>
  );
}

// Row-level click log — the raw traffic table behind every aggregate report, and the
// screen an admin opens when a specific click needs explaining.
export function ClickLogs() {
  const { draft, setDraft, applied, apply, clear, dirty } = useDeferredFilters(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sort, setSort] = useState<TableSort>({ key: 'createdAt', direction: 'DESC' });
  const [detail, setDetail] = useState<ClickLog | null>(null);

  const apiRange = toApiRange(applied.range);
  const filters = useMemo(
    () => ({
      ...apiRange,
      offerId: applied.offerId || undefined,
      affiliateId: applied.affiliateId || undefined,
      countryCode: applied.countryCode || undefined,
      qualityStatus: applied.qualityStatus || undefined,
      sortBy: sort.key,
      sortDir: sort.direction,
      page,
      pageSize,
    }),
    [apiRange.dateFrom, apiRange.dateTo, applied, sort, page, pageSize],
  );

  const logs = useAsync(() => getClickLogs(filters), [filters]);
  const offers = useAsync<Offer[]>(() => getOffers(), []);
  // ACTIVE only: a pending or rejected application has never been able to send
  // traffic, so listing them is noise in a filter that exists to narrow real clicks.
  const affiliates = useAsync<Affiliate[]>(() => getAffiliates({ status: 'ACTIVE' }), []);
  const countries = useAsync<string[]>(() => getClickCountries(), []);

  // Any applied-filter or sort change invalidates the page number — page 7 of the old
  // result set is meaningless against the new one.
  function runFilter() {
    setPage(1);
    apply();
  }

  function changeSort(next: TableSort) {
    setPage(1);
    setSort(next);
  }

  const rows = logs.data?.rows ?? [];
  const summary = logs.data?.summary;

  function exportCsv() {
    downloadCsv(
      'click-logs.csv',
      ['Date', 'Offer', 'Affiliate', 'Country', 'City', 'Device', 'IP', 'Unique', 'Quality', 'Sub1', 'Sub2', 'Sub3'],
      rows.map((row) => [
        dateTime(row.createdAt),
        row.offerName ?? '',
        row.affiliateName ?? '',
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

  const columns: DataTableColumn<ClickLog>[] = [
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
    { key: 'affiliate', header: 'Affiliate', render: (row) => row.affiliateName ?? '—' },
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
        title="Click logs"
        description="Every click the tracker recorded. Open a row for the full record — geo, device, network and the fraud signals it was scored on."
        actions={
          <Button variant="outline" disabled={rows.length === 0} onClick={exportCsv}>
            Export CSV
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Total clicks" value={number(summary?.clicks ?? 0)} />
        <StatCard label="Unique clicks" value={number(summary?.uniqueClicks ?? 0)} />
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
            {QUALITY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </FilterField>
      </FilterBar>

      {logs.error && <p className="text-sm text-destructive">{logs.error}</p>}

      {logs.loading ? (
        <TableSkeleton columns={12} />
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
            total={logs.data?.total ?? 0}
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
