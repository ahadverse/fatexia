import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FilterBar, PageHeader, RankedList, StatCard, StatCardSkeleton, TrendChart } from '@fatexia/ui';
import { getOwnDashboard } from '../lib/portal-api';
import { useAsync } from '../hooks/useAsync';
import { compactMoney, money, number, percent } from '../lib/format';
import { DateRangeFilter, defaultRange, toApiRange, type DateRange } from '../components/DateRangeFilter';

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
            <StatCard label="Clicks" value={number(data.summary.clicks)} />
            <StatCard label="Unique Clicks" value={number(data.summary.uniqueClicks)} />
            <StatCard label="Conversions" value={number(data.summary.conversions)} />
            <StatCard label="Conversion rate" value={percent(data.summary.conversionRate)} />
            <StatCard label="EPC" value={money(data.summary.epc)} />
            <StatCard label="Earnings" value={compactMoney(data.summary.payout)} />
            <StatCard label="Ready to pay" value={compactMoney(data.summary.pendingPayout)} />
            <StatCard label="Pending review" value={number(data.summary.pendingConversions)} />
            <StatCard label="Points" value={number(data.summary.totalPoints)} />
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
                  <StatCard label="Offers available" value={number(data.summary.availableOffers)} />
                </button>
                <button type="button" onClick={() => navigate('/messages')} className="text-left">
                  <StatCard label="Unread messages" value={number(data.summary.unreadMessages)} />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
