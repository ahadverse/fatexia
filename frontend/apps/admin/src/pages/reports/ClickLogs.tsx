import { useMemo, useState } from 'react';
import {
  Button,
  ClickGeoRows,
  ConfirmModal,
  DataTable,
  DateRangeFilter,
  Drawer,
  DrawerRow,
  DrawerRows,
  FilterBar,
  FilterField,
  Input,
  PageHeader,
  Pagination,
  Select,
  Skeleton,
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
import type { Affiliate, ClickLog, Conversion, ConversionStatus, Offer } from '@fatexia/types';
import {
  createConversionForClick,
  getClickCountries,
  getClickLogs,
  getConversionForClick,
  updateConversionStatus,
} from '../../lib/reports-api';
import { getOffers } from '../../lib/offers-api';
import { getAffiliates } from '../../lib/affiliates-api';
import { runAction, useAsync } from '../../hooks/useAsync';
import { useAccess } from '../../session/AccessContext';
import { dateTime, money, number } from '../../lib/format';
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

// PAID is absent on purpose: money is marked as sent by a payout batch, never by hand
// on a single row (updateConversionStatusSchema on the backend refuses it).
const CONVERSION_STATUSES: ConversionStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'DUPLICATE', 'CHARGEBACK'];

const STATUS_CONFIRM: Record<string, { description: string; destructive: boolean }> = {
  PENDING: { description: 'The conversion goes back to awaiting review and is not payable until it is approved again.', destructive: false },
  APPROVED: {
    description: 'Its payout becomes eligible for the next payout batch once the hold period elapses, and the affiliate’s own tracker is notified.',
    destructive: false,
  },
  REJECTED: { description: 'It will not be paid out.', destructive: true },
  DUPLICATE: { description: 'It is recorded as a repeat of a conversion already counted, and will not be paid out.', destructive: true },
  CHARGEBACK: {
    description: 'This reverses a conversion already marked PAID — use it only when the advertiser has genuinely disputed it.',
    destructive: true,
  },
};

/**
 * The conversion side of a click: what it produced, and what an admin can do about it.
 *
 * Both halves exist because the advertiser's postback is not always the last word. It
 * can fail to arrive at all — a pixel that never fired, a postback URL configured a day
 * late — which is what "Add conversion" answers; and it can arrive saying something the
 * network disagrees with, which is what the status control answers. The amount is part
 * of neither: it comes from the offer's payout rule here exactly as it does on the
 * postback path (money integrity rule, PLAN-backend.md).
 *
 * Mounted per click (keyed by the caller), so opening a different row loads that row's
 * conversion instead of showing the previous one until the fetch lands.
 */
function ClickConversionPanel({ click }: { click: ClickLog }) {
  // Creating a conversion is admin-only on the backend (see conversion.routes.ts), so a
  // manager is shown the state without a button that could only ever fail. Changing an
  // existing conversion's status stays available to both, as it already is on the
  // Conversions page — reviewing what was reported is a manager's job; authoring it is
  // not.
  const { isAdmin } = useAccess();
  const existing = useAsync(() => getConversionForClick(click.id), [click.id]);
  const conversion: Conversion | null = existing.data?.rows[0] ?? null;

  const [transactionId, setTransactionId] = useState('');
  const [confirmAdd, setConfirmAdd] = useState(false);
  const [nextStatus, setNextStatus] = useState<ConversionStatus | null>(null);
  const [saving, setSaving] = useState(false);

  // Not runAction, unlike every other mutation on this page: the success toast for a
  // new conversion comes from the realtime alert (useConversionAlerts), which fires for
  // whoever recorded it as well as for everyone else watching. Toasting here too would
  // stack two messages about one conversion on the person who pressed the button. A
  // failure still has to be reported locally — no event is coming for one of those.
  async function addConversion() {
    setSaving(true);
    try {
      await createConversionForClick(click.id, transactionId.trim() || undefined);
      setConfirmAdd(false);
      setTransactionId('');
      existing.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add the conversion');
    } finally {
      setSaving(false);
    }
  }

  async function applyStatus() {
    if (!conversion || !nextStatus) return;
    setSaving(true);
    const updated = await runAction(() => updateConversionStatus(conversion.id, nextStatus), {
      success: `Conversion marked ${nextStatus.toLowerCase()}`,
      onDone: existing.reload,
    });
    setSaving(false);
    if (updated) setNextStatus(null);
  }

  if (existing.loading && !existing.data) {
    return <Skeleton className="h-20 w-full" />;
  }

  return (
    <div className="mb-4 space-y-3 rounded-md border border-border p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conversion</p>

      {existing.error && <p className="text-sm text-destructive">{existing.error}</p>}

      {conversion ? (
        <DrawerRows>
          <DrawerRow label="Conversion ID" mono>
            {conversion.refId}
          </DrawerRow>
          <DrawerRow label="Status">
            <StatusPill status={conversion.status} />
          </DrawerRow>
          <DrawerRow label="Payout">{money(conversion.payoutAmount, conversion.currency)}</DrawerRow>
          <DrawerRow label="Revenue">{money(conversion.revenueAmount, conversion.currency)}</DrawerRow>
          <DrawerRow label="Recorded">{dateTime(conversion.createdAt)}</DrawerRow>
          {conversion.transactionId && <DrawerRow label="Transaction ID">{conversion.transactionId}</DrawerRow>}
          <DrawerRow label="Change status">
            {/* Deliberately not bound to the current status: the pill above is what this
                conversion *is*, and this only proposes a change the confirm step commits. */}
            <Select
              value=""
              disabled={saving}
              onChange={(event) => event.target.value && setNextStatus(event.target.value as ConversionStatus)}
              className="w-40"
            >
              <option value="">Select…</option>
              {CONVERSION_STATUSES.filter((status) => status !== conversion.status).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
          </DrawerRow>
        </DrawerRows>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {isAdmin
              ? 'No conversion recorded for this click. Adding one prices it from the offer’s payout rule — the same amount the advertiser’s postback would have produced.'
              : 'No conversion recorded for this click.'}
          </p>
          {isAdmin && (
            <>
              <div>
                <label className="text-xs font-medium text-muted-foreground" htmlFor="manual-transaction-id">
                  Transaction ID <span className="font-normal">(optional)</span>
                </label>
                <Input
                  id="manual-transaction-id"
                  value={transactionId}
                  onChange={(event) => setTransactionId(event.target.value)}
                  placeholder="The advertiser’s own order reference"
                  className="mt-1"
                />
              </div>
              <Button size="sm" disabled={saving} onClick={() => setConfirmAdd(true)}>
                Add conversion
              </Button>
            </>
          )}
        </div>
      )}

      <ConfirmModal
        open={confirmAdd}
        onOpenChange={(open) => !open && setConfirmAdd(false)}
        title="Record a conversion for this click?"
        description={`Click ${click.refId} on ${click.offerName ?? 'this offer'} will be credited to ${
          click.affiliateName ?? 'no affiliate (this click is unattributed)'
        }. The payout comes from the offer's payout rule, and the offer's own settings decide whether it starts approved or pending.`}
        confirmLabel="Add conversion"
        loading={saving}
        onConfirm={addConversion}
      />

      <ConfirmModal
        open={!!nextStatus}
        onOpenChange={(open) => !open && setNextStatus(null)}
        title={`Mark this conversion ${nextStatus?.toLowerCase() ?? ''}?`}
        description={nextStatus ? (STATUS_CONFIRM[nextStatus]?.description ?? '') : ''}
        confirmLabel={nextStatus ? `Mark ${nextStatus.toLowerCase()}` : 'Confirm'}
        destructive={nextStatus ? (STATUS_CONFIRM[nextStatus]?.destructive ?? false) : false}
        loading={saving}
        onConfirm={applyStatus}
      />
    </div>
  );
}

function ClickDetailDrawer({ click, onClose }: { click: ClickLog | null; onClose: () => void }) {
  async function copyClickId() {
    if (!click) return;
    try {
      // The refId, not the uuid: this is the value the advertiser was handed as
      // `click_id` and the one they will quote back when a conversion is queried.
      await navigator.clipboard.writeText(String(click.refId));
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
      {/* Ahead of the record itself: what this click is worth is the reason most people
          open this drawer, and it is the only part of it they can act on. */}
      {click && <ClickConversionPanel key={click.id} click={click} />}

      {click && (
        <DrawerRows>
          <DrawerRow label="Click ID" mono>
            {click.refId}
          </DrawerRow>
          {/* The internal key, kept because it is what the database and the logs are
              keyed on — the row above is the one anyone outside this screen uses. */}
          <DrawerRow label="Internal ID" mono>
            {click.id}
          </DrawerRow>
          <DrawerRow label="Date">{dateTime(click.createdAt)}</DrawerRow>
          <DrawerRow label="Offer">{click.offerName ?? '—'}</DrawerRow>
          <DrawerRow label="Affiliate">{click.affiliateName ?? 'Unattributed'}</DrawerRow>
          <ClickGeoRows geo={click} />
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
          <DrawerRow label="ASN">{click.asnNumber !== null ? `AS${click.asnNumber}` : '—'}</DrawerRow>
          <DrawerRow label="ASN operator">{click.asnOrganization ?? '—'}</DrawerRow>
          {/* The country the block is registered in, shown only when it disagrees with
              where the click answered from — a match is the ordinary case and would
              just be the Country row repeated. A mismatch reads as a VPN. */}
          {click.registeredCountryCode && click.registeredCountryCode !== click.countryCode && (
            <DrawerRow label="Registered in">{click.registeredCountryCode}</DrawerRow>
          )}
          {/* MaxMind's own legacy traits. GeoLite2 leaves them unset almost always, so
              they appear only on the rare row that actually carries one. */}
          {click.isAnonymousProxy !== null && (
            <DrawerRow label="MaxMind anon. proxy">{flag(click.isAnonymousProxy)}</DrawerRow>
          )}
          {click.isSatelliteProvider !== null && (
            <DrawerRow label="Satellite provider">{flag(click.isSatelliteProvider)}</DrawerRow>
          )}
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
    // First column, because scanning for a click someone quoted is the single most
    // common reason to open this page.
    { key: 'refId', header: 'Click ID', render: (row) => <span className="font-mono text-xs">{row.refId}</span> },
    { key: 'createdAt', header: 'Date', sortable: true, render: (row) => dateTime(row.createdAt) },
    // The drawer opens from the offer name rather than the date: the offer is what
    // someone is looking at when they decide a row needs opening, and a date column
    // reads as a timestamp, not as a link.
    {
      key: 'offer',
      header: 'Offer',
      render: (row) => (
        <button type="button" onClick={() => setDetail(row)} className="text-left text-primary hover:underline">
          {row.offerName ?? '—'}
        </button>
      ),
    },
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
