import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FilterBar,
  PageHeader,
  RankedList,
  StatCard,
  StatCardSkeleton,
  TrendChart,
  type RankedListItem,
} from '@fatexia/ui';
import type { ReportRow } from '@fatexia/types';
import { getDashboard } from '../lib/reports-api';
import { useAsync } from '../hooks/useAsync';
import { compactMoney, money, number, percent } from '../lib/format';
import { DateRangeFilter, defaultRange, toApiRange, type DateRange } from '../components/DateRangeFilter';

// Ranked lists compare magnitude within one list, so each item's bar is its share of
// the largest row rather than of the total — the top row always fills the track.
function toRankedItems(rows: ReportRow[], value: (row: ReportRow) => string, weight: (row: ReportRow) => number): RankedListItem[] {
  const max = Math.max(1, ...rows.map(weight));
  return rows.map((row) => ({ key: row.key, label: row.label, value: value(row), share: weight(row) / max }));
}

export function Dashboard() {
  const navigate = useNavigate();
  const [range, setRange] = useState<DateRange>(defaultRange());
  const apiRange = toApiRange(range);

  const { data, loading, error } = useAsync(() => getDashboard(apiRange), [apiRange.dateFrom, apiRange.dateTo]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Network performance for the selected period, plus everything currently waiting on a decision."
      />

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
            <StatCard label="Conversions" value={number(data.summary.conversions)} />
            <StatCard label="Conversion rate" value={percent(data.summary.conversionRate)} />
            <StatCard label="EPC" value={money(data.summary.epc)} />
            <StatCard label="Revenue" value={compactMoney(data.summary.revenue)} />
            <StatCard label="Payout" value={compactMoney(data.summary.payout)} />
            <StatCard label="Profit" value={compactMoney(data.summary.profit)} />
            <StatCard label="Margin" value={percent(data.summary.revenue === 0 ? 0 : (data.summary.profit / data.summary.revenue) * 100)} />
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
              <button type="button" onClick={() => navigate('/offers/access-requests')} className="text-left">
                <StatCard label="Access requests" value={number(data.summary.pendingAccessRequests)} />
              </button>
              <button type="button" onClick={() => navigate('/affiliates/pending')} className="text-left">
                <StatCard label="Affiliates pending" value={number(data.summary.pendingAffiliates)} />
              </button>
              <button type="button" onClick={() => navigate('/offers/all')} className="text-left">
                <StatCard label="Offers pending" value={number(data.summary.pendingOffers)} />
              </button>
              <button type="button" onClick={() => navigate('/reports/conversions')} className="text-left">
                <StatCard label="Conversions pending" value={number(data.summary.pendingConversions)} />
              </button>
              <button type="button" onClick={() => navigate('/billing')} className="text-left">
                <StatCard label="Invoices pending" value={number(data.summary.pendingInvoices)} />
              </button>
              <button type="button" onClick={() => navigate('/affiliates/messages')} className="text-left">
                <StatCard label="Unread messages" value={number(data.summary.unreadMessages)} />
              </button>
              <button type="button" onClick={() => navigate('/reports/clicks')} className="text-left">
                <StatCard label="Blocked clicks" value={number(data.summary.blockedClicks)} />
              </button>
              <button type="button" onClick={() => navigate('/reports/clicks')} className="text-left">
                <StatCard label="Suspect clicks" value={number(data.summary.suspectClicks)} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
