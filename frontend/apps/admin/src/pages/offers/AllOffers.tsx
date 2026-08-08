import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Advertiser, Offer, OfferStatus } from '@fatexia/types';
import { ConfirmModal, DataTable, StatusBadge, toast, type DataTableColumn } from '@fatexia/ui';
import { getAdvertisers } from '../../lib/advertisers-api';
import { getOffers, updateOfferStatus } from '../../lib/offers-api';

const STATUS_OPTIONS: { value: OfferStatus; label: string }[] = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'DELETED', label: 'Deleted' },
];

const STATUS_VARIANT: Record<OfferStatus, 'success' | 'destructive' | 'warning' | 'neutral'> = {
  APPROVED: 'success',
  REJECTED: 'destructive',
  PAUSED: 'warning',
  PENDING: 'neutral',
  DELETED: 'destructive',
};

const selectClass = 'h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground';

const STATUS_CHANGE_COPY: Record<OfferStatus, (name: string) => string> = {
  APPROVED: (name) => `"${name}" goes live — affiliates can start sending traffic to it immediately.`,
  REJECTED: (name) => `"${name}" will not go live. Affiliates with an existing tracking link can no longer convert on it.`,
  PAUSED: (name) => `"${name}" stops accepting new clicks until it's reactivated. Existing conversions are unaffected.`,
  PENDING: (name) => `"${name}" moves back to pending review.`,
  DELETED: (name) => `This marks "${name}" as DELETED. It stops appearing to affiliates immediately. Historical clicks/conversions are not removed.`,
};

export function AllOffers() {
  const navigate = useNavigate();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [statusFilter, setStatusFilter] = useState<OfferStatus | ''>('');
  const [advertiserFilter, setAdvertiserFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [pendingStatus, setPendingStatus] = useState<{ offer: Offer; next: OfferStatus } | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);

  async function load() {
    setLoading(true);
    const [offerRows, advertiserRows] = await Promise.all([getOffers(), getAdvertisers()]);
    setOffers(offerRows);
    setAdvertisers(advertiserRows);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const advertiserNames = useMemo(() => new Map(advertisers.map((a) => [a.id, a.name])), [advertisers]);

  const filteredOffers = offers.filter((o) => {
    if (statusFilter && o.status !== statusFilter) return false;
    if (advertiserFilter && o.advertiserId !== advertiserFilter) return false;
    return true;
  });

  function handleStatusChange(offer: Offer, next: OfferStatus) {
    if (next === offer.status) return;
    setPendingStatus({ offer, next });
  }

  async function confirmStatusChange() {
    if (!pendingStatus) return;
    setStatusSaving(true);
    try {
      await updateOfferStatus(pendingStatus.offer.id, pendingStatus.next);
      toast.success(pendingStatus.next === 'DELETED' ? 'Offer deleted' : `Offer status updated to ${pendingStatus.next}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update offer status');
    } finally {
      setStatusSaving(false);
      setPendingStatus(null);
    }
  }

  const columns: DataTableColumn<Offer>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (o) => (
        <button type="button" onClick={() => navigate(`/offers/${o.id}`)} className="text-left font-medium text-foreground hover:underline">
          {o.name}
        </button>
      ),
    },
    { key: 'advertiser', header: 'Advertiser', render: (o) => advertiserNames.get(o.advertiserId) ?? o.advertiserId },
    { key: 'category', header: 'Category', render: (o) => o.category ?? '—' },
    { key: 'payout', header: 'Payout', render: (o) => `${o.currency} ${o.defaultPayoutAmount.toFixed(2)}` },
    {
      key: 'status',
      header: 'Status',
      render: (o) => <StatusBadge variant={STATUS_VARIANT[o.status]}>{o.status}</StatusBadge>,
    },
    { key: 'createdAt', header: 'Created', render: (o) => new Date(o.createdAt).toLocaleDateString() },
    {
      key: 'actions',
      header: '',
      render: (o) => (
        <div className="flex gap-2">
          <button type="button" onClick={() => navigate(`/offers/${o.id}`)} className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent">
            View
          </button>
          <button type="button" onClick={() => navigate(`/offers/${o.id}/edit`)} className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent">
            Edit
          </button>
          {o.status !== 'DELETED' && (
            <select
              value={o.status}
              onChange={(e) => handleStatusChange(o, e.target.value as OfferStatus)}
              className="h-7 rounded-md border border-border bg-background px-1.5 text-xs text-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          )}
          {o.status !== 'DELETED' && (
            <button
              type="button"
              onClick={() => setPendingStatus({ offer: o, next: 'DELETED' })}
              className="rounded-md border border-destructive/50 px-2 py-1 text-xs text-destructive"
            >
              Delete
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">All Offers</h1>
        <button type="button" onClick={() => navigate('/offers/create')} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Create Offer
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as OfferStatus | '')} className={`${selectClass} w-44`}>
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select value={advertiserFilter} onChange={(e) => setAdvertiserFilter(e.target.value)} className={`${selectClass} w-56`}>
          <option value="">All advertisers</option>
          {advertisers.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : <DataTable columns={columns} rows={filteredOffers} getRowKey={(o) => o.id} emptyMessage="No offers match these filters." />}

      <ConfirmModal
        open={!!pendingStatus}
        onOpenChange={(open) => !open && setPendingStatus(null)}
        title={pendingStatus?.next === 'APPROVED' ? 'Approve this offer?' : `Change status to ${pendingStatus?.next}?`}
        description={pendingStatus ? STATUS_CHANGE_COPY[pendingStatus.next](pendingStatus.offer.name) : ''}
        confirmLabel={pendingStatus?.next === 'DELETED' ? 'Delete' : 'Confirm'}
        destructive={pendingStatus?.next === 'DELETED' || pendingStatus?.next === 'REJECTED' || pendingStatus?.next === 'PAUSED'}
        loading={statusSaving}
        onConfirm={confirmStatusChange}
      />
    </div>
  );
}
