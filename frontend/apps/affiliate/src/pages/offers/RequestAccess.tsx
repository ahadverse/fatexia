import { useState } from 'react';
import {
  Button,
  DataTable,
  EmptyState,
  Modal,
  PageHeader,
  Select,
  TableSkeleton,
  Tabs,
  Textarea,
  toast,
  type DataTableColumn,
} from '@fatexia/ui';
import type { AccessRequest, AffiliateOffer } from '@fatexia/types';
import { getOwnAccessRequests, requestOfferAccess } from '../../lib/portal-api';
import { getAvailableOffers } from '../../lib/offers-api';
import { runAction, useAsync } from '../../hooks/useAsync';
import { dateTime } from '../../lib/format';
import { StatusPill } from '../../components/StatusPill';

export function RequestAccess() {
  const [tab, setTab] = useState('requests');
  const [asking, setAsking] = useState(false);
  const [offerId, setOfferId] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const requests = useAsync<AccessRequest[]>(() => getOwnAccessRequests(), []);
  const offers = useAsync<AffiliateOffer[]>(() => getAvailableOffers(), []);

  // An offer already requested shouldn't be offered again — the server rejects a
  // duplicate pending request, so filtering here avoids an error the user can't act on.
  const requestedOfferIds = new Set((requests.data ?? []).map((request) => request.offerId));
  const requestable = (offers.data ?? []).filter((offer) => !requestedOfferIds.has(offer.id));

  async function submit() {
    if (!offerId) {
      toast.error('Pick an offer to request');
      return;
    }
    setSaving(true);
    const result = await runAction(() => requestOfferAccess(offerId, note.trim() || undefined), {
      success: 'Request sent — your manager will review it',
      onDone: requests.reload,
    });
    setSaving(false);
    if (result) {
      setAsking(false);
      setOfferId('');
      setNote('');
    }
  }

  const columns: DataTableColumn<AccessRequest>[] = [
    { key: 'offer', header: 'Offer', render: (row) => row.offerName ?? row.offerId },
    { key: 'status', header: 'Status', render: (row) => <StatusPill status={row.status} /> },
    {
      key: 'note',
      header: 'Your note',
      render: (row) => <span className="text-xs text-muted-foreground">{row.affiliateNote ?? '—'}</span>,
    },
    {
      key: 'decision',
      header: 'Response',
      render: (row) =>
        row.status === 'PENDING' ? (
          <span className="text-xs text-muted-foreground">Awaiting review</span>
        ) : (
          <div className="text-xs">
            <p className="text-card-foreground">{row.decisionNote ?? 'No note given'}</p>
            <p className="text-muted-foreground">{dateTime(row.decidedAt)}</p>
          </div>
        ),
    },
    { key: 'createdAt', header: 'Requested', render: (row) => dateTime(row.createdAt) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Request access"
        description="Some offers need your manager's approval before you can run them. Ask here and track the decision."
        actions={<Button onClick={() => setAsking(true)}>New request</Button>}
      />

      <Tabs
        items={[
          { key: 'requests', label: 'My requests' },
          { key: 'available', label: 'Offers you can request' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {requests.error && <p className="text-sm text-destructive">{requests.error}</p>}

      {tab === 'requests' ? (
        requests.loading ? (
          <TableSkeleton columns={5} />
        ) : (requests.data ?? []).length === 0 ? (
          <EmptyState
            title="No requests yet"
            description="Everything you can already run is on the Browse page. Use New request to ask about a gated offer."
            action={<Button onClick={() => setAsking(true)}>New request</Button>}
          />
        ) : (
          <DataTable columns={columns} rows={requests.data ?? []} getRowKey={(row) => row.id} />
        )
      ) : offers.loading ? (
        <TableSkeleton columns={3} />
      ) : (
        <DataTable
          columns={[
            { key: 'name', header: 'Offer', render: (offer: AffiliateOffer) => offer.name },
            { key: 'advertiser', header: 'Advertiser', render: (offer: AffiliateOffer) => offer.advertiserName ?? '—' },
            {
              key: 'action',
              header: '',
              render: (offer: AffiliateOffer) => (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setOfferId(offer.id);
                    setAsking(true);
                  }}
                >
                  Request
                </Button>
              ),
            },
          ]}
          rows={requestable}
          getRowKey={(offer) => offer.id}
          emptyMessage="You have already requested every available offer."
        />
      )}

      <Modal open={asking} onOpenChange={setAsking} title="Request offer access">
        <div className="space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Offer</span>
            <Select value={offerId} onChange={(event) => setOfferId(event.target.value)} className="mt-1">
              <option value="">Select an offer</option>
              {requestable.map((offer) => (
                <option key={offer.id} value={offer.id}>
                  {offer.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Tell your manager about your traffic</span>
            <Textarea
              rows={4}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Source, geos, expected daily volume — the more specific, the faster the decision."
              className="mt-1"
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAsking(false)}>
              Cancel
            </Button>
            <Button disabled={saving} onClick={submit}>
              {saving ? 'Sending…' : 'Send request'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
