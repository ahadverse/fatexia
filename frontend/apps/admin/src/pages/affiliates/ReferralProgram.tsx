import { DataTable, PageHeader, StatCard, TableSkeleton, toast, type DataTableColumn } from '@fatexia/ui';
import type { Affiliate } from '@fatexia/types';
import { getAffiliates } from '../../lib/affiliates-api';
import { useAsync } from '../../hooks/useAsync';
import { date, number } from '../../lib/format';
import { StatusPill } from '../../components/StatusPill';

interface ReferrerRow {
  referrer: Affiliate;
  referred: Affiliate[];
}

// Who recruited whom. Built from the affiliates list rather than its own endpoint —
// the referral link is a column on the affiliate row, so one fetch has everything.
export function ReferralProgram() {
  const affiliates = useAsync<Affiliate[]>(() => getAffiliates(), []);

  const rows: ReferrerRow[] = (() => {
    const all = affiliates.data ?? [];
    const byId = new Map(all.map((affiliate) => [affiliate.id, affiliate]));
    const grouped = new Map<string, Affiliate[]>();

    for (const affiliate of all) {
      if (!affiliate.referredByAffiliateId) continue;
      const list = grouped.get(affiliate.referredByAffiliateId) ?? [];
      list.push(affiliate);
      grouped.set(affiliate.referredByAffiliateId, list);
    }

    return [...grouped.entries()]
      .flatMap(([referrerId, referred]) => {
        const referrer = byId.get(referrerId);
        // A referrer that no longer exists would render an unlabelled row; the
        // referred affiliates still appear in the main list, so drop the group.
        return referrer ? [{ referrer, referred }] : [];
      })
      .sort((a, b) => b.referred.length - a.referred.length);
  })();

  const totalReferred = rows.reduce((sum, row) => sum + row.referred.length, 0);

  const columns: DataTableColumn<ReferrerRow>[] = [
    {
      key: 'referrer',
      header: 'Referrer',
      render: (row) => (
        <div>
          <p className="text-card-foreground">{row.referrer.fullName ?? row.referrer.email}</p>
          <p className="text-xs text-muted-foreground">{row.referrer.email}</p>
        </div>
      ),
    },
    {
      key: 'code',
      header: 'Referral code',
      render: (row) =>
        row.referrer.referralCode ? (
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(row.referrer.referralCode!);
              toast.success('Referral code copied');
            }}
            className="font-mono text-xs text-primary hover:underline"
          >
            {row.referrer.referralCode}
          </button>
        ) : (
          '—'
        ),
    },
    { key: 'count', header: 'Referred', render: (row) => number(row.referred.length) },
    {
      key: 'who',
      header: 'Who they brought in',
      render: (row) => (
        <div className="space-y-1">
          {row.referred.map((affiliate) => (
            <div key={affiliate.id} className="flex items-center gap-2 text-xs">
              <span className="text-card-foreground">{affiliate.fullName ?? affiliate.email}</span>
              <StatusPill status={affiliate.status} />
              <span className="text-muted-foreground">joined {date(affiliate.createdAt)}</span>
            </div>
          ))}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Referral program"
        description="Affiliates who recruited other affiliates. The referral commission split is configured per payout rule on each offer."
      />

      {affiliates.error && <p className="text-sm text-destructive">{affiliates.error}</p>}

      {affiliates.loading ? (
        <TableSkeleton columns={4} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <StatCard label="Active referrers" value={number(rows.length)} />
            <StatCard label="Affiliates referred" value={number(totalReferred)} />
            <StatCard
              label="Share of all affiliates"
              value={`${(affiliates.data ?? []).length === 0 ? 0 : Math.round((totalReferred / (affiliates.data ?? []).length) * 100)}%`}
            />
          </div>

          <DataTable
            columns={columns}
            rows={rows}
            getRowKey={(row) => row.referrer.id}
            emptyMessage="Nobody has referred another affiliate yet."
          />
        </>
      )}
    </div>
  );
}
