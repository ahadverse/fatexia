import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  ConfirmModal,
  DataTable,
  ExternalLinkButton,
  PageHeader,
  TableSkeleton,
  toast,
  type DataTableColumn,
} from '@fatexia/ui';
import type { SmartLink, SmartLinkRotation } from '@fatexia/types';
import { deleteSmartLink, getSmartLinks } from '../../lib/platform-api';
import { runAction, useAsync } from '../../hooks/useAsync';
import { date } from '../../lib/format';
import { StatusPill } from '../../components/StatusPill';

const ROTATIONS: { value: SmartLinkRotation; label: string; hint: string }[] = [
  { value: 'TOP_PAYOUT', label: 'Highest payout', hint: 'Always sends to the best-paying eligible offer.' },
  { value: 'ROUND_ROBIN', label: 'Round robin', hint: 'Splits traffic evenly across members.' },
  { value: 'BEST_CR', label: 'Best converting', hint: 'Weights toward members with the strongest recent CR.' },
];

export function SmartLinks() {
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState<SmartLink | null>(null);

  const links = useAsync(() => getSmartLinks(), []);

  const columns: DataTableColumn<SmartLink>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <div>
          <p className="text-card-foreground">{row.name}</p>
          <p className="text-xs text-muted-foreground">/{row.slug}</p>
        </div>
      ),
    },
    { key: 'offers', header: 'Offers', render: (row) => `${row.offerCount}` },
    { key: 'rotation', header: 'Rotation', render: (row) => ROTATIONS.find((r) => r.value === row.rotation)?.label ?? row.rotation },
    { key: 'geo', header: 'Geo', render: (row) => (row.countries.length ? row.countries.join(', ') : 'All') },
    { key: 'devices', header: 'Devices', render: (row) => (row.devices.length ? row.devices.join(', ') : 'All') },
    { key: 'status', header: 'Status', render: (row) => <StatusPill status={row.status} /> },
    { key: 'createdAt', header: 'Created', render: (row) => date(row.createdAt) },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex gap-1.5">
          <ExternalLinkButton href={row.smartLinkUrl} label="Open smart-link in new tab" />
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(row.smartLinkUrl);
              toast.success('Smart-link URL copied');
            }}
          >
            Copy
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate(`/offers/smart-links/${row.id}`)}>
            Edit
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setDeleting(row)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Smart-links"
        description="One link that resolves to the best matching member offer at click time, based on the visitor's geo and device."
        actions={<Button onClick={() => navigate('/offers/smart-links/create')}>New smart-link</Button>}
      />

      {/* Staff copy the template, not a runnable link — affiliates get the same URL
          with their own id already filled in, so the macro here is the honest thing
          to show rather than a link that would attribute traffic to nobody. */}
      <p className="rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
        The URLs below contain the <code className="text-foreground">{'{affiliate_id}'}</code> macro. Affiliates see
        their own id already substituted in their portal — replace it yourself if you are testing a link by hand.
      </p>

      {links.error && <p className="text-sm text-destructive">{links.error}</p>}

      {links.loading ? (
        <TableSkeleton columns={8} />
      ) : (
        <DataTable
          columns={columns}
          rows={links.data ?? []}
          getRowKey={(row) => row.id}
          emptyMessage="No smart-links yet. Create one to rotate traffic across several offers."
        />
      )}

      <ConfirmModal
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this smart-link?"
        description={
          deleting
            ? `"${deleting.name}" will stop resolving immediately. Any affiliate still using /${deleting.slug} will get a dead link.`
            : ''
        }
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          await runAction(() => deleteSmartLink(deleting.id), { success: 'Smart-link deleted', onDone: links.reload });
          setDeleting(null);
        }}
      />
    </div>
  );
}
