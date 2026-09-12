import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ActivityFeed,
  PageHeader,
  QuickStats,
  RankedList,
  StatCard,
  StatCardSkeleton,
  TrendChart,
  greeting,
  nameFromEmail,
  type ActivityFeedItem,
  type RankedListItem,
} from '@fatexia/ui';
import {
  Building2,
  ClipboardCheck,
  Coins,
  FileText,
  Gauge,
  KeyRound,
  MessageSquare,
  MousePointerClick,
  Percent,
  PiggyBank,
  ShieldAlert,
  ShieldQuestion,
  Tag,
  Target,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import type { ActivityEvent, ReportRow } from '@fatexia/types';
import { getDashboard } from '../lib/reports-api';
import { useSession } from '../session/SessionContext';
import { useAccess } from '../session/AccessContext';
import { useAsync } from '../hooks/useAsync';
import { compactMoney, money, number, percent } from '../lib/format';
import { DateRangeFilter, presetRange, toApiRange, type DateRange } from '../components/DateRangeFilter';

// The comparison window is always the period immediately before the selected one, of
// the same length — see previousWindow() in the backend's dashboard module.
const DELTA_LABEL = 'vs. previous period';

// The feed is "what is happening now", so it has to age on its own rather than wait for
// the next date-range change. Long enough not to hammer the API from an idle open tab.
const ACTIVITY_POLL_MS = 30_000;

function toActivityItems(events: ActivityEvent[]): ActivityFeedItem[] {
  return events.map((event) => ({
    id: event.id,
    kind: event.kind,
    // A payout has no offer, so its amount carries the line instead.
    title: event.kind === 'payout' ? money(event.amount ?? 0) : (event.offer ?? 'Unknown offer'),
    subtitle: event.affiliate ?? undefined,
    countryCode: event.countryCode,
    at: event.at,
  }));
}

// Ranked lists compare magnitude within one list, so each item's bar is its share of
// the largest row rather than of the total — the top row always fills the track.
function toRankedItems(rows: ReportRow[], value: (row: ReportRow) => string, weight: (row: ReportRow) => number): RankedListItem[] {
  const max = Math.max(1, ...rows.map(weight));
  return rows.map((row) => ({ key: row.key, label: row.label, value: value(row), share: weight(row) / max }));
}

export function Dashboard() {
  const navigate = useNavigate();
  const { user } = useSession();
  const { manager } = useAccess();
  // A manager has a real name on their profile, which AccessContext already loaded.
  // An admin account carries only an email, so the local part stands in rather than
  // costing a request for a name this page shows once.
  const displayName = manager?.fullName?.split(' ')[0] || nameFromEmail(user?.email);
  // 30 days rather than the shared `defaultRange()` of today. A single-day window has
  // one trend point, and a sparkline needs two — so on "Today" every tile loses its
  // line, and a quiet morning also zeroes both sides of the comparison, which makes the
  // deltas null and hides "vs. previous period" with them. Other pages keep today.
  const [range, setRange] = useState<DateRange>(presetRange('last30'));
  const apiRange = toApiRange(range);

  const { data, error, reload } = useAsync(() => getDashboard(apiRange), [apiRange.dateFrom, apiRange.dateTo]);

  // Refetches the whole dashboard, not just the feed: one endpoint serves both, and a
  // second activity-only route would be a new surface to scope for managers for the
  // sake of a payload this size.
  useEffect(() => {
    const timer = setInterval(reload, ACTIVITY_POLL_MS);
    return () => clearInterval(timer);
  }, [reload]);

  const spark = (pick: (row: ReportRow) => number) => data?.trend.map(pick) ?? [];

  return (
    <div className="space-y-6">
      {/* The date filter sits in the header's actions slot rather than its own bar —
          it is the only control on this page, and a full-width bar for one dropdown
          pushed the first row of tiles below the fold. */}
      <PageHeader
        title={`${greeting()}, ${displayName}`}
        description="Here's what's happening with your network today."
        actions={<DateRangeFilter value={range} onChange={setRange} />}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Skeletons only while there is nothing to show. `loading` alone would blank the
          page on every 30s poll, which reads as a crash rather than a refresh. */}
      {!data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <StatCardSkeleton key={index} />
          ))}
        </div>
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-6">
          {/* One-up on phones, two-up on laptops, four-up once the main column can
              actually hold four readable money figures. The sparkline inside each card
              flexes to whatever is left, so no width here needs to match it. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Clicks" value={number(data.summary.clicks)} tone="traffic" icon={<MousePointerClick className="size-4" />} delta={data.deltas.clicks} deltaLabel={DELTA_LABEL} sparkline={spark((row) => row.clicks)} />
            <StatCard label="Conversions" value={number(data.summary.conversions)} tone="teal" icon={<Target className="size-4" />} delta={data.deltas.conversions} deltaLabel={DELTA_LABEL} sparkline={spark((row) => row.conversions)} />
            <StatCard label="Conversion rate" value={percent(data.summary.conversionRate)} tone="info" icon={<Percent className="size-4" />} delta={data.deltas.conversionRate} deltaLabel={DELTA_LABEL} sparkline={spark((row) => row.conversionRate)} />
            <StatCard label="EPC" value={money(data.summary.epc)} tone="orange" icon={<Coins className="size-4" />} delta={data.deltas.epc} deltaLabel={DELTA_LABEL} sparkline={spark((row) => row.epc)} />
            <StatCard label="Revenue" value={compactMoney(data.summary.revenue)} tone="money" icon={<TrendingUp className="size-4" />} delta={data.deltas.revenue} deltaLabel={DELTA_LABEL} sparkline={spark((row) => row.revenue)} />
            {/* Payout is a cost to the network, so a rise is not an improvement. */}
            <StatCard label="Payout" value={compactMoney(data.summary.payout)} tone="warning" icon={<Wallet className="size-4" />} delta={data.deltas.payout} higherIsBetter={false} deltaLabel={DELTA_LABEL} sparkline={spark((row) => row.payout)} />
            <StatCard label="Profit" value={compactMoney(data.summary.profit)} tone="profit" icon={<PiggyBank className="size-4" />} delta={data.deltas.profit} deltaLabel={DELTA_LABEL} sparkline={spark((row) => row.profit)} />
            {/* Margin has no delta: it is derived from revenue and profit, both of
                which already carry their own comparison. */}
            <StatCard label="Margin" value={percent(data.summary.revenue === 0 ? 0 : (data.summary.profit / data.summary.revenue) * 100)} tone="pink" icon={<Gauge className="size-4" />} sparkline={spark((row) => (row.revenue === 0 ? 0 : (row.profit / row.revenue) * 100))} />
          </div>

          <TrendChart
            points={data.trend.map((row) => ({ label: row.label, values: [row.revenue, row.payout] }))}
            seriesNames={['Revenue', 'Payout']}
            formatValue={(value) => compactMoney(value)}
          />

          <div className="grid gap-4 lg:grid-cols-3">
            <RankedList
              title="Top offers by clicks"
              items={toRankedItems(data.topOffers, (row) => number(row.clicks), (row) => row.clicks)}
            />
            <RankedList
              title="Top affiliates by payout"
              items={toRankedItems(data.topAffiliates, (row) => money(row.payout), (row) => row.payout)}
            />
            <RankedList
              title="Top countries by clicks"
              items={toRankedItems(data.topCountries, (row) => number(row.clicks), (row) => row.clicks)}
            />
          </div>

          <div>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">Needs attention</h2>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {/* No deltas on this row: these are current-state queues, not a
                  measurement over the selected window, so a period-over-period change
                  would be meaningless.

                  One hue per tile so eight cards can be told apart at a glance. The two
                  fraud counters keep the red end of the range deliberately — those are
                  the only tiles here where the colour still means "this is bad", and
                  giving them an arbitrary hue would throw that signal away. */}
              <button type="button" onClick={() => navigate('/offers/access-requests')} className="text-left">
                <StatCard label="Access requests" value={number(data.summary.pendingAccessRequests)} tone="warning" icon={<KeyRound className="size-4" />} />
              </button>
              <button type="button" onClick={() => navigate('/affiliates/pending')} className="text-left">
                <StatCard label="Affiliates pending" value={number(data.summary.pendingAffiliates)} tone="traffic" icon={<UserPlus className="size-4" />} />
              </button>
              <button type="button" onClick={() => navigate('/offers/all')} className="text-left">
                <StatCard label="Offers pending" value={number(data.summary.pendingOffers)} tone="profit" icon={<Tag className="size-4" />} />
              </button>
              <button type="button" onClick={() => navigate('/reports/conversions')} className="text-left">
                <StatCard label="Conversions pending" value={number(data.summary.pendingConversions)} tone="teal" icon={<ClipboardCheck className="size-4" />} />
              </button>
              <button type="button" onClick={() => navigate('/billing')} className="text-left">
                <StatCard label="Invoices pending" value={number(data.summary.pendingInvoices)} tone="info" icon={<FileText className="size-4" />} />
              </button>
              <button type="button" onClick={() => navigate('/affiliates/messages')} className="text-left">
                <StatCard label="Unread messages" value={number(data.summary.unreadMessages)} tone="pink" icon={<MessageSquare className="size-4" />} />
              </button>
              <button type="button" onClick={() => navigate('/reports/clicks')} className="text-left">
                <StatCard label="Blocked clicks" value={number(data.summary.blockedClicks)} tone="danger" icon={<ShieldAlert className="size-4" />} />
              </button>
              <button type="button" onClick={() => navigate('/reports/clicks')} className="text-left">
                <StatCard label="Suspect clicks" value={number(data.summary.suspectClicks)} tone="orange" icon={<ShieldQuestion className="size-4" />} />
              </button>
            </div>
          </div>
          </div>

          {/* Current-state rail. Neither panel is filtered by the date range above —
              both answer "right now", which is why they sit outside the filtered
              column rather than inside it. */}
          <aside className="space-y-6">
            <ActivityFeed
              items={toActivityItems(data.activity)}
              action={{ label: 'View all', onClick: () => navigate('/reports/clicks') }}
              emptyMessage="No clicks, conversions or payouts yet."
            />
            <QuickStats
              items={[
                { key: 'offers', label: 'Active Offers', value: number(data.summary.activeOffers), icon: <Tag className="size-4" />, onClick: () => navigate('/offers/all') },
                { key: 'affiliates', label: 'Active Affiliates', value: number(data.summary.activeAffiliates), icon: <Users className="size-4" />, onClick: () => navigate('/affiliates/all') },
                { key: 'advertisers', label: 'Active Advertisers', value: number(data.summary.activeAdvertisers), icon: <Building2 className="size-4" />, onClick: () => navigate('/advertisers/all') },
                { key: 'payouts', label: 'Total Payouts (This Month)', value: money(data.summary.payoutsThisMonth), icon: <Wallet className="size-4" />, onClick: () => navigate('/billing') },
              ]}
            />
          </aside>
        </div>
      )}
    </div>
  );
}
