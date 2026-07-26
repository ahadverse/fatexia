import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DataTable,
  EmptyState,
  PageHeader,
  Pagination,
  StatCard,
  StatCardSkeleton,
  TableSkeleton,
  Tabs,
  type DataTableColumn,
} from '@fatexia/ui';
import { describePayout, readCryptoDetails } from '@fatexia/types';
import type { Affiliate, AffiliatePoint, Invoice } from '@fatexia/types';
import { getOwnBalance, getOwnInvoices, getOwnPoints, getOwnProfile } from '../../lib/portal-api';
import { useAsync } from '../../hooks/useAsync';
import { date, dateTime, money, number } from '../../lib/format';
import { StatusPill } from '../../components/StatusPill';

const PAGE_SIZE = 25;

const METHOD_LABEL: Record<Invoice['paymentMethod'], string> = {
  BANK_TRANSFER: 'Bank transfer',
  PAYPAL: 'PayPal',
  CRYPTO: 'Crypto',
};

/**
 * Payout history plus the read-only points ledger.
 *
 * Points live here rather than in the nav (PLAN-affiliate-portal.md: they are
 * informational, not an action surface) and the page says plainly that they are not
 * redeemable, so nobody is left expecting a cash-out button that will never exist.
 */
export function Payments() {
  const [tab, setTab] = useState('invoices');
  const [invoicePage, setInvoicePage] = useState(1);
  const [pointsPage, setPointsPage] = useState(1);

  const balance = useAsync(() => getOwnBalance(), []);
  const profile = useAsync<Affiliate>(() => getOwnProfile(), []);
  const invoices = useAsync(() => getOwnInvoices({ page: invoicePage, pageSize: PAGE_SIZE }), [invoicePage]);
  const points = useAsync(() => getOwnPoints({ page: pointsPage, pageSize: PAGE_SIZE }), [pointsPage]);

  const paidTotal = (invoices.data?.rows ?? [])
    .filter((invoice) => invoice.status === 'PAID')
    .reduce((sum, invoice) => sum + invoice.amount, 0);

  const invoiceColumns: DataTableColumn<Invoice>[] = [
    { key: 'number', header: 'Invoice', render: (row) => row.invoiceNumber },
    { key: 'period', header: 'Period', render: (row) => `${date(row.periodFrom)} – ${date(row.periodTo)}` },
    { key: 'conversions', header: 'Conversions', render: (row) => number(row.conversionCount) },
    { key: 'amount', header: 'Amount', render: (row) => money(row.amount, row.currency) },
    { key: 'method', header: 'Method', render: (row) => METHOD_LABEL[row.paymentMethod] },
    { key: 'status', header: 'Status', render: (row) => <StatusPill status={row.status} /> },
    { key: 'paidAt', header: 'Paid', render: (row) => dateTime(row.paidAt) },
    {
      key: 'reference',
      header: 'Reference',
      render: (row) => <span className="text-xs text-muted-foreground">{row.paymentReference ?? '—'}</span>,
    },
  ];

  const pointColumns: DataTableColumn<AffiliatePoint>[] = [
    { key: 'createdAt', header: 'When', render: (row) => dateTime(row.createdAt) },
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
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="What you have been paid, and what is currently building toward your next payout."
      />

      {balance.loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <StatCardSkeleton key={index} />
          ))}
        </div>
      ) : (
        balance.data && (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard label="Ready to pay" value={money(balance.data.eligibleAmount)} />
              <StatCard label="Eligible conversions" value={number(balance.data.eligibleConversions)} />
              <StatCard label="Paid to date" value={money(paidTotal)} />
              <StatCard label="Points" value={number(points.data?.totalPoints ?? 0)} />
            </div>
            {!balance.data.meetsThreshold && balance.data.eligibleAmount > 0 && (
              <p className="text-xs text-muted-foreground">
                Your balance is below the network's minimum payout threshold, so it will roll over to the next cycle rather
                than being paid out now.
              </p>
            )}
          </>
        )
      )}

      {/* Where the money actually goes. Surfaced here rather than only on Profile
          because this is the page an affiliate opens when chasing a payment, and an
          unset or stale destination is the most common reason one hasn't arrived. */}
      {profile.data && (
        <section className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-card-foreground">Payout destination</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {describePayout(profile.data.payoutMethod, profile.data.payoutDetails)}
              </p>
              {profile.data.payoutMethod === 'CRYPTO' && (
                <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                  {readCryptoDetails(profile.data.payoutDetails).walletAddress || 'No wallet address on file'}
                </p>
              )}
            </div>
            <Link to="/profile" className="text-xs text-primary hover:underline">
              {profile.data.payoutMethod ? 'Change' : 'Set a payout method'}
            </Link>
          </div>
          {!profile.data.payoutMethod && (
            <p className="mt-2 text-xs text-warning">
              No payout method is set, so your balance cannot be paid out yet.
            </p>
          )}
        </section>
      )}

      <Tabs
        items={[
          { key: 'invoices', label: 'Payout history' },
          { key: 'points', label: 'Points' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'invoices' ? (
        invoices.loading ? (
          <TableSkeleton columns={8} />
        ) : (invoices.data?.rows ?? []).length === 0 ? (
          <EmptyState
            title="No payouts yet"
            description="Once your approved conversions clear the hold window and pass the minimum threshold, your first payout appears here."
          />
        ) : (
          <>
            <DataTable columns={invoiceColumns} rows={invoices.data?.rows ?? []} getRowKey={(row) => row.id} />
            <Pagination page={invoicePage} pageSize={PAGE_SIZE} total={invoices.data?.total ?? 0} onPageChange={setInvoicePage} />
          </>
        )
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Points are a loyalty score, not a currency — they are informational only and cannot be redeemed for cash.
          </p>
          {points.loading ? (
            <TableSkeleton columns={3} />
          ) : (
            <>
              <DataTable
                columns={pointColumns}
                rows={points.data?.rows ?? []}
                getRowKey={(row) => row.id}
                emptyMessage="No points earned yet."
              />
              <Pagination page={pointsPage} pageSize={PAGE_SIZE} total={points.data?.total ?? 0} onPageChange={setPointsPage} />
            </>
          )}
        </>
      )}
    </div>
  );
}
