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
} from '@fatexia/ui';
import {
  ClipboardCheck,
  Coins,
  Fingerprint,
  MessageSquare,
  MousePointerClick,
  Percent,
  Sparkles,
  Tag,
  Target,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import type { ActivityEvent, AffiliateReportRow } from '@fatexia/types';
import { getOwnDashboard } from '../lib/portal-api';
import { useSession } from '../session/SessionContext';
import { useAsync } from '../hooks/useAsync';
import { compactMoney, money, number, percent } from '../lib/format';
import { DateRangeFilter, presetRange, toApiRange, type DateRange } from '../components/DateRangeFilter';
import { LatestNews } from '../components/LatestNews';

// The comparison window is always the period immediately before the selected one, of
// the same length — see previousWindow() in the backend's dashboard module.
const DELTA_LABEL = 'vs. previous period';

// The feed is "what is happening now", so it ages on its own rather than waiting for
// the next date-range change.
const ACTIVITY_POLL_MS = 30_000;

function toActivityItems(events: ActivityEvent[]): ActivityFeedItem[] {
  return events.map((event) => ({
    id: event.id,
    kind: event.kind,
    // A payout carries its amount; a click/conversion carries the offer it belongs to.
    title: event.kind === 'payout' ? money(event.amount ?? 0) : (event.offer ?? 'Unknown offer'),
    countryCode: event.countryCode,
    at: event.at,
  }));
}

// Payout-only by construction: the /dashboard/mine payload has no revenue, profit or
// margin field at all, so there is nothing here to accidentally render.
export function Dashboard() {
  const navigate = useNavigate();
  // The session holds only an email, so the local part stands in as a first name.
  const { user } = useSession();
  // 30 days, not the shared default of today — see the same note on the admin
  // dashboard: a one-day window has nothing for a sparkline or a delta to show.
  const [range, setRange] = useState<DateRange>(presetRange('last30'));
  const apiRange = toApiRange(range);

  const { data, error, reload } = useAsync(() => getOwnDashboard(apiRange), [apiRange.dateFrom, apiRange.dateTo]);

  useEffect(() => {
    const timer = setInterval(reload, ACTIVITY_POLL_MS);
    return () => clearInterval(timer);
  }, [reload]);

  const spark = (pick: (row: AffiliateReportRow) => number) => data?.trend.map(pick) ?? [];

  const topOffers = (data?.topOffers ?? []).map((row) => ({
    key: row.key,
    label: row.label,
    value: money(row.payout),
    share: row.payout / Math.max(1, ...(data?.topOffers ?? []).map((o) => o.payout)),
  }));

  return (
    <div className="space-y-6">
      {/* Date filter in the header's actions slot — see the note on the admin
          dashboard. */}
      <PageHeader
        title={`${greeting()}, ${nameFromEmail(user?.email)}`}
        description="Here's how your traffic and earnings are doing."
        actions={<DateRangeFilter value={range} onChange={setRange} />}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Skeletons only while there is nothing to show — `loading` alone would blank
          the page on every 30s poll. */}
      {!data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <StatCardSkeleton key={index} />
          ))}
        </div>
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-6">
            {/* One-up / two-up / four-up — see the note on the admin dashboard. */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Clicks" value={number(data.summary.clicks)} tone="traffic" icon={<MousePointerClick className="size-4" />} delta={data.deltas.clicks} deltaLabel={DELTA_LABEL} sparkline={spark((row) => row.clicks)} />
              <StatCard label="Unique Clicks" value={number(data.summary.uniqueClicks)} tone="teal" icon={<Fingerprint className="size-4" />} delta={data.deltas.uniqueClicks} deltaLabel={DELTA_LABEL} sparkline={spark((row) => row.uniqueClicks)} />
              <StatCard label="Conversions" value={number(data.summary.conversions)} tone="info" icon={<Target className="size-4" />} delta={data.deltas.conversions} deltaLabel={DELTA_LABEL} sparkline={spark((row) => row.conversions)} />
              <StatCard label="Conversion rate" value={percent(data.summary.conversionRate)} tone="orange" icon={<Percent className="size-4" />} delta={data.deltas.conversionRate} deltaLabel={DELTA_LABEL} sparkline={spark((row) => row.conversionRate)} />
              <StatCard label="EPC" value={money(data.summary.epc)} tone="pink" icon={<Coins className="size-4" />} delta={data.deltas.epc} deltaLabel={DELTA_LABEL} sparkline={spark((row) => row.epc)} />
              <StatCard label="Earnings" value={compactMoney(data.summary.payout)} tone="money" icon={<TrendingUp className="size-4" />} delta={data.deltas.payout} deltaLabel={DELTA_LABEL} sparkline={spark((row) => row.payout)} />
              {/* The next three are current-state balances/queues, not period figures,
                  so they carry neither a comparison nor a sparkline. */}
              <StatCard label="Ready to pay" value={compactMoney(data.summary.pendingPayout)} tone="profit" icon={<Wallet className="size-4" />} />
              <StatCard label="Pending review" value={number(data.summary.pendingConversions)} tone="warning" icon={<ClipboardCheck className="size-4" />} />
              <StatCard label="Points" value={number(data.summary.totalPoints)} tone="danger" icon={<Sparkles className="size-4" />} />
            </div>

            <TrendChart
              points={data.trend.map((row) => ({ label: row.label, values: [row.clicks, row.conversions] }))}
              seriesNames={['Clicks', 'Conversions']}
              formatValue={(value) => number(Math.round(value))}
            />

            <RankedList
              title="Your top offers by earnings"
              items={topOffers}
              emptyMessage="No traffic in this period yet."
            />
          </div>

          {/* Same rail as the admin dashboard, narrowed to this affiliate: the feed
              comes from /dashboard/mine, so it can only ever contain their own rows. */}
          <aside className="space-y-6">
            <ActivityFeed
              items={toActivityItems(data.activity)}
              action={{ label: 'View all', onClick: () => navigate('/reports/clicks') }}
              emptyMessage="No clicks, conversions or payouts yet."
            />
            <QuickStats
              items={[
                { key: 'offers', label: 'Offers available', value: number(data.summary.availableOffers), icon: <Tag className="size-4" />, onClick: () => navigate('/offers/browse') },
                { key: 'messages', label: 'Unread messages', value: number(data.summary.unreadMessages), icon: <MessageSquare className="size-4" />, onClick: () => navigate('/messages') },
                { key: 'ready', label: 'Ready to pay', value: money(data.summary.pendingPayout), icon: <Wallet className="size-4" /> },
              ]}
            />
          </aside>
        </div>
      )}

      {/* Outside the loading branch above: news doesn't depend on the date range, so
          it renders as soon as it arrives rather than waiting on the traffic query. */}
      <LatestNews limit={4} />
    </div>
  );
}
