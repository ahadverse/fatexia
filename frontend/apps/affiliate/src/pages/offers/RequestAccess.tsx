import { useNavigate } from 'react-router-dom';
import { Button, DataTable, EmptyState, PageHeader, TableSkeleton, type DataTableColumn } from '@fatexia/ui';
import type { AccessRequest } from '@fatexia/types';
import { getOwnAccessRequests } from '../../lib/portal-api';
import { useAsync } from '../../hooks/useAsync';
import { dateTime } from '../../lib/format';
import { StatusPill } from '../../components/StatusPill';

/**
 * Where requests are tracked, not where they are made.
 *
 * Asking happens on Browse, on the row of the offer being asked about — that is the
 * only place the affiliate can see what they would be requesting. This screen used to
 * own the asking too, through an offer picker fed by the *available* list, which could
 * only ever offer up offers they already had. With that gone the page has one job, and
 * the tabs and New request button that framed the old flow went with it.
 */
export function RequestAccess() {
  const navigate = useNavigate();
  const requests = useAsync<AccessRequest[]>(() => getOwnAccessRequests(), []);

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
        title="Access requests"
        description="Offers that need your manager's approval before you can run them. Ask on the Browse page; track the decision here."
      />

      {requests.error && <p className="text-sm text-destructive">{requests.error}</p>}

      {requests.loading ? (
        <TableSkeleton columns={5} />
      ) : (requests.data ?? []).length === 0 ? (
        <EmptyState
          title="No requests yet"
          description="Offers whose status reads Request access need your manager's approval. Open Browse and ask on the one you want."
          action={<Button onClick={() => navigate('/offers/browse')}>Go to Browse offers</Button>}
        />
      ) : (
        <DataTable columns={columns} rows={requests.data ?? []} getRowKey={(row) => row.id} />
      )}
    </div>
  );
}
