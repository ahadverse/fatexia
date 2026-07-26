import { useState } from 'react';
import {
  Button,
  DataTable,
  FilterBar,
  FilterField,
  Modal,
  PageHeader,
  Select,
  TableSkeleton,
  Textarea,
  type DataTableColumn,
} from '@fatexia/ui';
import type { AccessRequest, AccessRequestStatus } from '@fatexia/types';
import { decideAccessRequest, getAccessRequests } from '../../lib/platform-api';
import { runAction, useAsync } from '../../hooks/useAsync';
import { dateTime } from '../../lib/format';
import { StatusPill } from '../../components/StatusPill';

interface Decision {
  request: AccessRequest;
  status: 'APPROVED' | 'REJECTED';
}

// Affiliates asking for access to a gated offer. Both the Approvals and Access
// Requests nav items land here — they are the same queue, filtered differently.
export function AccessRequests({ defaultStatus = '' as AccessRequestStatus | '' }: { defaultStatus?: AccessRequestStatus | '' }) {
  const [status, setStatus] = useState<AccessRequestStatus | ''>(defaultStatus);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const requests = useAsync(() => getAccessRequests({ status: status || undefined }), [status]);

  function openDecision(request: AccessRequest, next: 'APPROVED' | 'REJECTED') {
    setDecision({ request, status: next });
    setNote('');
  }

  async function submitDecision() {
    if (!decision) return;
    setSaving(true);
    await runAction(() => decideAccessRequest(decision.request.id, decision.status, note || undefined), {
      success: decision.status === 'APPROVED' ? 'Access approved' : 'Access declined',
      onDone: requests.reload,
    });
    setSaving(false);
    setDecision(null);
  }

  const columns: DataTableColumn<AccessRequest>[] = [
    { key: 'offer', header: 'Offer', render: (row) => row.offerName ?? row.offerId },
    {
      key: 'affiliate',
      header: 'Affiliate',
      render: (row) => (
        <div>
          <p className="text-card-foreground">{row.affiliateName ?? '—'}</p>
          <p className="text-xs text-muted-foreground">{row.affiliateEmail ?? ''}</p>
        </div>
      ),
    },
    {
      key: 'note',
      header: 'Their note',
      render: (row) => <span className="text-xs text-muted-foreground">{row.affiliateNote ?? '—'}</span>,
    },
    { key: 'status', header: 'Status', render: (row) => <StatusPill status={row.status} /> },
    { key: 'createdAt', header: 'Requested', render: (row) => dateTime(row.createdAt) },
    {
      key: 'decision',
      header: 'Decision',
      render: (row) =>
        row.status === 'PENDING' ? (
          <span className="text-xs text-muted-foreground">Awaiting review</span>
        ) : (
          <div className="text-xs text-muted-foreground">
            <p>{dateTime(row.decidedAt)}</p>
            {row.decisionNote && <p className="mt-0.5">{row.decisionNote}</p>}
          </div>
        ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) =>
        row.status === 'PENDING' ? (
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" onClick={() => openDecision(row, 'APPROVED')}>
              Approve
            </Button>
            <Button size="sm" variant="destructive" onClick={() => openDecision(row, 'REJECTED')}>
              Decline
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Offer access requests"
        description="Affiliates asking for access to a gated offer. Approving lets them pull a tracking link for it."
      />

      <FilterBar>
        <FilterField label="Status">
          <Select value={status} onChange={(event) => setStatus(event.target.value as AccessRequestStatus | '')} className="w-44">
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </Select>
        </FilterField>
      </FilterBar>

      {requests.error && <p className="text-sm text-destructive">{requests.error}</p>}

      {requests.loading ? (
        <TableSkeleton columns={7} />
      ) : (
        <DataTable
          columns={columns}
          rows={requests.data ?? []}
          getRowKey={(row) => row.id}
          emptyMessage="No access requests match this filter."
        />
      )}

      <Modal
        open={!!decision}
        onOpenChange={(open) => !open && setDecision(null)}
        title={decision?.status === 'APPROVED' ? 'Approve access' : 'Decline access'}
      >
        {decision && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {decision.request.affiliateName ?? decision.request.affiliateEmail} →{' '}
              <span className="text-card-foreground">{decision.request.offerName}</span>
            </p>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">
                Note {decision.status === 'REJECTED' ? '(the affiliate sees this)' : '(optional)'}
              </span>
              <Textarea
                rows={3}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={decision.status === 'APPROVED' ? 'Anything they should know before running it' : 'Why this was declined'}
                className="mt-1"
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDecision(null)}>
                Cancel
              </Button>
              <Button
                variant={decision.status === 'APPROVED' ? 'primary' : 'destructive'}
                disabled={saving}
                onClick={submitDecision}
              >
                {saving ? 'Saving…' : decision.status === 'APPROVED' ? 'Approve' : 'Decline'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// Offers → Approvals opens the same queue pre-filtered to what needs a decision.
export function OfferApprovals() {
  return <AccessRequests defaultStatus="PENDING" />;
}
