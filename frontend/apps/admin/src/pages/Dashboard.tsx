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
import {
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
  Wallet,
} from 'lucide-react';
import type { ReportRow } from '@fatexia/types';
import { getDashboard } from '../lib/reports-api';
import { useAsync } from '../hooks/useAsync';
import { compactMoney, money, number, percent } from '../lib/format';
import { DateRangeFilter, defaultRange, toApiRange, type DateRange } from '../components/DateRangeFilter';

// The comparison window is always the period immediately before the selected one, of
// the same length — see previousWindow() in the backend's dashboard module.
const DELTA_LABEL = 'vs the previous period of equal length';

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
            <StatCard label="Clicks" value={number(data.summary.clicks)} tone="traffic" icon={<MousePointerClick className="size-4" />} delta={data.deltas.clicks} deltaLabel={DELTA_LABEL} />
            <StatCard label="Conversions" value={number(data.summary.conversions)} tone="traffic" icon={<Target className="size-4" />} delta={data.deltas.conversions} deltaLabel={DELTA_LABEL} />
            <StatCard label="Conversion rate" value={percent(data.summary.conversionRate)} tone="info" icon={<Percent className="size-4" />} delta={data.deltas.conversionRate} deltaLabel={DELTA_LABEL} />
            <StatCard label="EPC" value={money(data.summary.epc)} tone="info" icon={<Coins className="size-4" />} delta={data.deltas.epc} deltaLabel={DELTA_LABEL} />
            <StatCard label="Revenue" value={compactMoney(data.summary.revenue)} tone="money" icon={<TrendingUp className="size-4" />} delta={data.deltas.revenue} deltaLabel={DELTA_LABEL} />
            {/* Payout is a cost to the network, so a rise is not an improvement. */}
            <StatCard label="Payout" value={compactMoney(data.summary.payout)} tone="warning" icon={<Wallet className="size-4" />} delta={data.deltas.payout} higherIsBetter={false} deltaLabel={DELTA_LABEL} />
            <StatCard label="Profit" value={compactMoney(data.summary.profit)} tone="profit" icon={<PiggyBank className="size-4" />} delta={data.deltas.profit} deltaLabel={DELTA_LABEL} />
            {/* Margin has no delta: it is derived from revenue and profit, both of
                which already carry their own comparison. */}
            <StatCard label="Margin" value={percent(data.summary.revenue === 0 ? 0 : (data.summary.profit / data.summary.revenue) * 100)} tone="profit" icon={<Gauge className="size-4" />} />
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
                  would be meaningless. Tone carries the urgency instead — amber for a
                  queue awaiting a decision, rose for rejected traffic. */}
              <button type="button" onClick={() => navigate('/offers/access-requests')} className="text-left">
                <StatCard label="Access requests" value={number(data.summary.pendingAccessRequests)} tone="warning" icon={<KeyRound className="size-4" />} />
              </button>
              <button type="button" onClick={() => navigate('/affiliates/pending')} className="text-left">
                <StatCard label="Affiliates pending" value={number(data.summary.pendingAffiliates)} tone="warning" icon={<UserPlus className="size-4" />} />
              </button>
              <button type="button" onClick={() => navigate('/offers/all')} className="text-left">
                <StatCard label="Offers pending" value={number(data.summary.pendingOffers)} tone="warning" icon={<Tag className="size-4" />} />
              </button>
              <button type="button" onClick={() => navigate('/reports/conversions')} className="text-left">
                <StatCard label="Conversions pending" value={number(data.summary.pendingConversions)} tone="warning" icon={<ClipboardCheck className="size-4" />} />
              </button>
              <button type="button" onClick={() => navigate('/billing')} className="text-left">
                <StatCard label="Invoices pending" value={number(data.summary.pendingInvoices)} tone="info" icon={<FileText className="size-4" />} />
              </button>
              <button type="button" onClick={() => navigate('/affiliates/messages')} className="text-left">
                <StatCard label="Unread messages" value={number(data.summary.unreadMessages)} tone="info" icon={<MessageSquare className="size-4" />} />
              </button>
              <button type="button" onClick={() => navigate('/reports/clicks')} className="text-left">
                <StatCard label="Blocked clicks" value={number(data.summary.blockedClicks)} tone="danger" icon={<ShieldAlert className="size-4" />} />
              </button>
              <button type="button" onClick={() => navigate('/reports/clicks')} className="text-left">
                <StatCard label="Suspect clicks" value={number(data.summary.suspectClicks)} tone="danger" icon={<ShieldQuestion className="size-4" />} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
