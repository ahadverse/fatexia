import { useState } from 'react';
import {
  DataTable,
  FilterBar,
  FilterField,
  PageHeader,
  Select,
  TableSkeleton,
  type DataTableColumn,
} from '@fatexia/ui';
import type { CrAnomaly } from '@fatexia/types';
import { getAffiliateCrOptimizer, getOfferCrOptimizer } from '../lib/reports-api';
import { useAsync } from '../hooks/useAsync';
import { number, percent } from '../lib/format';
import { StatusPill } from '../components/StatusPill';

/**
 * CR Optimizer — read-only analytics over the same click/conversion data as the
 * reports (PLAN-admin.md), surfacing rows whose conversion rate has moved sharply
 * against their own trailing baseline.
 *
 * The comparison is always self-relative: a "good" CR is entirely vertical- and
 * geo-dependent, so a fixed cross-network threshold would flag every low-CR vertical
 * and miss a genuine collapse in a high-CR one.
 */

const WINDOW_OPTIONS = [
  { label: 'Last 7 days vs prior 28', recentDays: 7, baselineDays: 28 },
  { label: 'Last 14 days vs prior 28', recentDays: 14, baselineDays: 28 },
  { label: 'Last 30 days vs prior 60', recentDays: 30, baselineDays: 60 },
];

const MIN_CLICK_OPTIONS = [10, 50, 100, 500];

interface CrOptimizerViewProps {
  title: string;
  description: string;
  entityLabel: string;
  load: (params: { recentDays: number; baselineDays: number; minClicks: number }) => Promise<CrAnomaly[]>;
}

function CrOptimizerView({ title, description, entityLabel, load }: CrOptimizerViewProps) {
  const [windowIndex, setWindowIndex] = useState(0);
  const [minClicks, setMinClicks] = useState(50);
  const [verdict, setVerdict] = useState('');

  const selected = WINDOW_OPTIONS[windowIndex]!;
  const result = useAsync(
    () => load({ recentDays: selected.recentDays, baselineDays: selected.baselineDays, minClicks }),
    [windowIndex, minClicks],
  );

  const rows = (result.data ?? []).filter((row) => !verdict || row.verdict === verdict);

  const columns: DataTableColumn<CrAnomaly>[] = [
    { key: 'label', header: entityLabel, render: (row) => row.label },
    { key: 'recentClicks', header: 'Recent clicks', render: (row) => number(row.recentClicks) },
    { key: 'recentCr', header: 'Recent CR', render: (row) => percent(row.recentCr) },
    { key: 'baselineClicks', header: 'Baseline clicks', render: (row) => number(row.baselineClicks) },
    { key: 'baselineCr', header: 'Baseline CR', render: (row) => percent(row.baselineCr) },
    {
      key: 'delta',
      header: 'Change',
      render: (row) => (
        <span className={row.deltaPercent < 0 ? 'text-destructive' : row.deltaPercent > 0 ? 'text-success' : ''}>
          {row.deltaPercent > 0 ? '+' : ''}
          {row.deltaPercent.toFixed(1)}%
        </span>
      ),
    },
    { key: 'verdict', header: 'Verdict', render: (row) => <StatusPill status={row.verdict} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />

      <FilterBar>
        <FilterField label="Comparison window">
          <Select value={String(windowIndex)} onChange={(event) => setWindowIndex(Number(event.target.value))} className="w-56">
            {WINDOW_OPTIONS.map((option, index) => (
              <option key={option.label} value={index}>
                {option.label}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Minimum clicks">
          <Select value={String(minClicks)} onChange={(event) => setMinClicks(Number(event.target.value))} className="w-36">
            {MIN_CLICK_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Verdict">
          <Select value={verdict} onChange={(event) => setVerdict(event.target.value)} className="w-40">
            <option value="">All</option>
            <option value="DROPPED">Dropped</option>
            <option value="SPIKED">Spiked</option>
            <option value="STABLE">Stable</option>
          </Select>
        </FilterField>
      </FilterBar>

      <p className="text-xs text-muted-foreground">
        Rows below the minimum-clicks threshold in either window are excluded — a handful of clicks produces a 0% or 100%
        rate and nothing meaningful in between. A spike is as much a signal (possible fraud) as a drop is.
      </p>

      {result.error && <p className="text-sm text-destructive">{result.error}</p>}

      {result.loading ? (
        <TableSkeleton columns={7} />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(row) => row.key}
          emptyMessage="Not enough traffic in both windows to compare. Lower the minimum-clicks threshold or widen the window."
        />
      )}
    </div>
  );
}

export function OfferCrOptimizer() {
  return (
    <CrOptimizerView
      title="Offer CR optimizer"
      description="Offers whose conversion rate has moved sharply against their own trailing baseline — candidates to pause, investigate or scale."
      entityLabel="Offer"
      load={getOfferCrOptimizer}
    />
  );
}

export function AffiliateCrOptimizer() {
  return (
    <CrOptimizerView
      title="Affiliate CR optimizer"
      description="Affiliates whose conversion rate has shifted against their own baseline — a drop suggests a traffic-quality change, a spike may be fraud."
      entityLabel="Affiliate"
      load={getAffiliateCrOptimizer}
    />
  );
}
