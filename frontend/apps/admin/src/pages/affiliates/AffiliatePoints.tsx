import { useState } from 'react';
import {
  Button,
  DataTable,
  Input,
  Modal,
  PageHeader,
  Pagination,
  Select,
  TableSkeleton,
  Tabs,
  toast,
  type DataTableColumn,
} from '@fatexia/ui';
import type { Affiliate, AffiliatePoint, AffiliatePointBalance } from '@fatexia/types';
import { adjustAffiliatePoints, getAffiliatePointBalances, getAffiliatePoints, getAffiliates } from '../../lib/affiliates-api';
import { runAction, useAsync } from '../../hooks/useAsync';
import { dateTime, number } from '../../lib/format';

const PAGE_SIZE = 50;

/**
 * The affiliate-points ledger.
 *
 * Points are informational/leaderboard only — there is no redemption mechanism and
 * none is planned (PLAN-backend.md), which is why this screen has no "pay out points"
 * action and says so on the page.
 */
export function AffiliatePoints() {
  const [tab, setTab] = useState('balances');
  const [page, setPage] = useState(1);
  const [adjusting, setAdjusting] = useState(false);
  const [affiliateId, setAffiliateId] = useState('');
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const balances = useAsync<AffiliatePointBalance[]>(() => getAffiliatePointBalances(), []);
  const ledger = useAsync(() => getAffiliatePoints({ page, pageSize: PAGE_SIZE }), [page]);
  const affiliates = useAsync<Affiliate[]>(() => getAffiliates(), []);

  const affiliateName = (id: string) => {
    const affiliate = (affiliates.data ?? []).find((row) => row.id === id);
    return affiliate?.fullName ?? affiliate?.email ?? id;
  };

  async function submitAdjustment() {
    const value = Number(points);
    if (!affiliateId || !Number.isInteger(value) || value === 0 || reason.trim().length < 3) {
      toast.error('Pick an affiliate, a non-zero whole number of points, and give a reason');
      return;
    }
    setSaving(true);
    const result = await runAction(() => adjustAffiliatePoints({ affiliateId, points: value, reason: reason.trim() }), {
      success: 'Adjustment recorded',
      onDone: () => {
        balances.reload();
        ledger.reload();
      },
    });
    setSaving(false);
    if (result) {
      setAdjusting(false);
      setAffiliateId('');
      setPoints('');
      setReason('');
    }
  }

  const balanceColumns: DataTableColumn<AffiliatePointBalance>[] = [
    { key: 'name', header: 'Affiliate', render: (row) => row.affiliateName ?? row.email },
    { key: 'email', header: 'Email', render: (row) => <span className="text-xs text-muted-foreground">{row.email}</span> },
    { key: 'points', header: 'Total points', render: (row) => number(row.totalPoints) },
    { key: 'entries', header: 'Ledger entries', render: (row) => number(row.entryCount) },
  ];

  const ledgerColumns: DataTableColumn<AffiliatePoint>[] = [
    { key: 'createdAt', header: 'When', render: (row) => dateTime(row.createdAt) },
    { key: 'affiliate', header: 'Affiliate', render: (row) => affiliateName(row.affiliateId) },
    {
      key: 'points',
      header: 'Points',
      render: (row) => (
        <span className={row.points < 0 ? 'text-destructive' : 'text-success'}>
          {row.points > 0 ? '+' : ''}
          {number(row.points)}
        </span>
      ),
    },
    { key: 'reason', header: 'Reason', render: (row) => row.reason },
    {
      key: 'source',
      header: 'Source',
      render: (row) => (
        <span className="text-xs text-muted-foreground">{row.conversionId ? 'Conversion' : 'Manual adjustment'}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Affiliate points"
        description="A loyalty leaderboard, not a currency — points are informational only and have no redemption path."
        actions={<Button onClick={() => setAdjusting(true)}>Manual adjustment</Button>}
      />

      <Tabs
        items={[
          { key: 'balances', label: 'Balances' },
          { key: 'ledger', label: 'Ledger' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'balances' ? (
        balances.loading ? (
          <TableSkeleton columns={4} />
        ) : (
          <DataTable
            columns={balanceColumns}
            rows={balances.data ?? []}
            getRowKey={(row) => row.affiliateId}
            emptyMessage="No points earned yet."
          />
        )
      ) : ledger.loading ? (
        <TableSkeleton columns={5} />
      ) : (
        <>
          <DataTable
            columns={ledgerColumns}
            rows={ledger.data?.rows ?? []}
            getRowKey={(row) => row.id}
            emptyMessage="The ledger is empty."
          />
          <Pagination page={page} pageSize={PAGE_SIZE} total={ledger.data?.total ?? 0} onPageChange={setPage} />
        </>
      )}

      <Modal open={adjusting} onOpenChange={setAdjusting} title="Manual points adjustment">
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            The ledger is append-only — a correction is a new negative entry with a reason, never an edit, so the history
            stays auditable.
          </p>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Affiliate</span>
            <Select value={affiliateId} onChange={(event) => setAffiliateId(event.target.value)} className="mt-1">
              <option value="">Select an affiliate</option>
              {(affiliates.data ?? []).map((affiliate) => (
                <option key={affiliate.id} value={affiliate.id}>
                  {affiliate.fullName ?? affiliate.email}
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Points (negative to deduct)</span>
            <Input type="number" value={points} onChange={(event) => setPoints(event.target.value)} className="mt-1" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Reason (required)</span>
            <Input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Q2 top-performer bonus"
              className="mt-1"
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAdjusting(false)}>
              Cancel
            </Button>
            <Button disabled={saving} onClick={submitAdjustment}>
              {saving ? 'Saving…' : 'Record adjustment'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
