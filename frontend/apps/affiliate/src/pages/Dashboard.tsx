import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FilterBar, PageHeader, RankedList, StatCard, StatCardSkeleton, TrendChart } from '@fatexia/ui';
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
import { getOwnDashboard } from '../lib/portal-api';
import { useAsync } from '../hooks/useAsync';
import { compactMoney, money, number, percent } from '../lib/format';
import { DateRangeFilter, defaultRange, toApiRange, type DateRange } from '../components/DateRangeFilter';
import { LatestNews } from '../components/LatestNews';

// The comparison window is always the period immediately before the selected one, of
// the same length — see previousWindow() in the backend's dashboard module.
const DELTA_LABEL = 'vs the previous period of equal length';

// Payout-only by construction: the /dashboard/mine payload has no revenue, profit or
// margin field at all, so there is nothing here to accidentally render.
export function Dashboard() {
  const navigate = useNavigate();
  const [range, setRange] = useState<DateRange>(defaultRange());
  const apiRange = toApiRange(range);

  const { data, loading, error } = useAsync(() => getOwnDashboard(apiRange), [apiRange.dateFrom, apiRange.dateTo]);

  const topOffers = (data?.topOffers ?? []).map((row) => ({
    key: row.key,
    label: row.label,
    value: money(row.payout),
    share: row.payout / Math.max(1, ...(data?.topOffers ?? []).map((o) => o.payout)),
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Your traffic and earnings for the selected period." />

      <FilterBar>
        <DateRangeFilter value={range} onChange={setRange} />
      </FilterBar>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading || !data ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <StatCardSkeleton key={index} />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Clicks" value={number(data.summary.clicks)} tone="traffic" icon={<MousePointerClick className="size-4" />} delta={data.deltas.clicks} deltaLabel={DELTA_LABEL} />
            <StatCard label="Unique Clicks" value={number(data.summary.uniqueClicks)} tone="traffic" icon={<Fingerprint className="size-4" />} delta={data.deltas.uniqueClicks} deltaLabel={DELTA_LABEL} />
            <StatCard label="Conversions" value={number(data.summary.conversions)} tone="traffic" icon={<Target className="size-4" />} delta={data.deltas.conversions} deltaLabel={DELTA_LABEL} />
            <StatCard label="Conversion rate" value={percent(data.summary.conversionRate)} tone="info" icon={<Percent className="size-4" />} delta={data.deltas.conversionRate} deltaLabel={DELTA_LABEL} />
            <StatCard label="EPC" value={money(data.summary.epc)} tone="info" icon={<Coins className="size-4" />} delta={data.deltas.epc} deltaLabel={DELTA_LABEL} />
            <StatCard label="Earnings" value={compactMoney(data.summary.payout)} tone="money" icon={<TrendingUp className="size-4" />} delta={data.deltas.payout} deltaLabel={DELTA_LABEL} />
            {/* The next three are current-state balances/queues, not period figures,
                so they carry no comparison. */}
            <StatCard label="Ready to pay" value={compactMoney(data.summary.pendingPayout)} tone="money" icon={<Wallet className="size-4" />} />
            <StatCard label="Pending review" value={number(data.summary.pendingConversions)} tone="warning" icon={<ClipboardCheck className="size-4" />} />
            <StatCard label="Points" value={number(data.summary.totalPoints)} tone="profit" icon={<Sparkles className="size-4" />} />
          </div>

          <TrendChart
            points={data.trend.map((row) => ({ label: row.label, values: [row.clicks, row.conversions] }))}
            seriesNames={['Clicks', 'Conversions']}
            formatValue={(value) => number(Math.round(value))}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <RankedList
              title="Your top offers by earnings"
              items={topOffers}
              emptyMessage="No traffic in this period yet."
            />

            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="text-sm font-medium text-muted-foreground">Quick links</h3>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <button type="button" onClick={() => navigate('/offers/browse')} className="text-left">
                  <StatCard label="Offers available" value={number(data.summary.availableOffers)} tone="info" icon={<Tag className="size-4" />} />
                </button>
                <button type="button" onClick={() => navigate('/messages')} className="text-left">
                  <StatCard label="Unread messages" value={number(data.summary.unreadMessages)} tone="info" icon={<MessageSquare className="size-4" />} />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Outside the loading branch above: news doesn't depend on the date range, so
          it renders as soon as it arrives rather than waiting on the traffic query. */}
      <LatestNews limit={4} />
    </div>
  );
}
