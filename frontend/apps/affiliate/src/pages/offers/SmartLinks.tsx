import { Button, DataTable, EmptyState, PageHeader, TableSkeleton, toast, type DataTableColumn } from '@fatexia/ui';
import type { SmartLink } from '@fatexia/types';
import { getSmartLinks } from '../../lib/portal-api';
import { useAsync } from '../../hooks/useAsync';
import { StatusPill } from '../../components/StatusPill';

// Read-only: smart-links are authored by the network, an affiliate just picks one up
// and runs it.
export function SmartLinks() {
  const links = useAsync<SmartLink[]>(() => getSmartLinks(), []);

  const columns: DataTableColumn<SmartLink>[] = [
    {
      key: 'name',
      header: 'Smart-link',
      render: (row) => (
        <div>
          <p className="text-card-foreground">{row.name}</p>
          <p className="text-xs text-muted-foreground">{row.description ?? ''}</p>
        </div>
      ),
    },
    { key: 'offers', header: 'Offers in rotation', render: (row) => String(row.offerCount) },
    { key: 'geo', header: 'Geo', render: (row) => (row.countries.length ? row.countries.join(', ') : 'All') },
    { key: 'devices', header: 'Devices', render: (row) => (row.devices.length ? row.devices.join(', ') : 'All') },
    { key: 'status', header: 'Status', render: (row) => <StatusPill status={row.status} /> },
    {
      key: 'link',
      header: '',
      render: (row) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            void navigator.clipboard.writeText(row.smartLinkUrl);
            toast.success('Smart-link copied');
          }}
        >
          Copy link
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Smart-links"
        description="One link that sends each visitor to the best matching offer for their country and device — useful when your traffic is mixed."
      />

      {links.error && <p className="text-sm text-destructive">{links.error}</p>}

      {links.loading ? (
        <TableSkeleton columns={6} />
      ) : (links.data ?? []).length === 0 ? (
        <EmptyState
          title="No smart-links available"
          description="The network hasn't published any smart-links yet. Your manager can set one up if your traffic spans several geos."
        />
      ) : (
        <DataTable columns={columns} rows={links.data ?? []} getRowKey={(row) => row.id} />
      )}
    </div>
  );
}
