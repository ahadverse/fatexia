import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  DataTable,
  FilterBar,
  FilterField,
  Input,
  Modal,
  PageHeader,
  Select,
  TableSkeleton,
  Textarea,
  type DataTableColumn,
} from '@fatexia/ui';
import type { Advertiser, AdvertiserStatus } from '@fatexia/types';
import { getAdvertisers, updateAdvertiser, updateAdvertiserStatus } from '../../lib/advertisers-api';
import { runAction, useAsync } from '../../hooks/useAsync';
import { date } from '../../lib/format';
import { StatusPill } from '../../components/StatusPill';

interface EditState {
  id: string;
  name: string;
  contactName: string;
  contactEmail: string;
  phone: string;
  country: string;
  websiteUrl: string;
  notes: string;
}

export interface AllAdvertisersProps {
  defaultStatus?: AdvertiserStatus | '';
  title?: string;
  description?: string;
}

export function AllAdvertisers({
  defaultStatus = '',
  title = 'All advertisers',
  description = 'Companies whose offers run on the network.',
}: AllAdvertisersProps) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<AdvertiserStatus | ''>(defaultStatus);
  const [search, setSearch] = useState('');
  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);

  const advertisers = useAsync(
    () => getAdvertisers({ status: status || undefined, search: search || undefined }),
    [status, search],
  );

  async function setAdvertiserStatus(advertiser: Advertiser, next: AdvertiserStatus) {
    await runAction(() => updateAdvertiserStatus(advertiser.id, next), {
      success: `${advertiser.name} is now ${next.toLowerCase()}`,
      onDone: advertisers.reload,
    });
  }

  async function saveEdit() {
    if (!edit) return;
    setSaving(true);
    const result = await runAction(
      () =>
        updateAdvertiser(edit.id, {
          name: edit.name,
          contactName: edit.contactName || undefined,
          contactEmail: edit.contactEmail || undefined,
          phone: edit.phone || undefined,
          country: edit.country || undefined,
          websiteUrl: edit.websiteUrl || undefined,
          notes: edit.notes || undefined,
        }),
      { success: 'Advertiser updated', onDone: advertisers.reload },
    );
    setSaving(false);
    if (result) setEdit(null);
  }

  const columns: DataTableColumn<Advertiser>[] = [
    {
      key: 'name',
      header: 'Advertiser',
      render: (row) => (
        <div>
          <p className="text-card-foreground">{row.name}</p>
          <p className="text-xs text-muted-foreground">{row.websiteUrl ?? ''}</p>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (row) => (
        <div>
          <p className="text-card-foreground">{row.contactName ?? '—'}</p>
          <p className="text-xs text-muted-foreground">{row.contactEmail ?? ''}</p>
        </div>
      ),
    },
    { key: 'country', header: 'Country', render: (row) => row.country ?? '—' },
    { key: 'offers', header: 'Offers', render: (row) => String(row.offerCount) },
    { key: 'status', header: 'Status', render: (row) => <StatusPill status={row.status} /> },
    { key: 'createdAt', header: 'Added', render: (row) => date(row.createdAt) },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setEdit({
                id: row.id,
                name: row.name,
                contactName: row.contactName ?? '',
                contactEmail: row.contactEmail ?? '',
                phone: row.phone ?? '',
                country: row.country ?? '',
                websiteUrl: row.websiteUrl ?? '',
                notes: row.notes ?? '',
              })
            }
          >
            Edit
          </Button>
          {row.status !== 'ACTIVE' && (
            <Button size="sm" variant="outline" onClick={() => setAdvertiserStatus(row, 'ACTIVE')}>
              Activate
            </Button>
          )}
          {row.status === 'ACTIVE' && (
            <Button size="sm" variant="destructive" onClick={() => setAdvertiserStatus(row, 'SUSPENDED')}>
              Suspend
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
        actions={<Button onClick={() => navigate('/advertisers/create')}>Create advertiser</Button>}
      />

      <FilterBar>
        <FilterField label="Search">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name or contact email"
            className="w-56"
          />
        </FilterField>
        <FilterField label="Status">
          <Select value={status} onChange={(event) => setStatus(event.target.value as AdvertiserStatus | '')} className="w-40">
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PENDING">Pending</option>
            <option value="SUSPENDED">Suspended</option>
          </Select>
        </FilterField>
      </FilterBar>

      {advertisers.error && <p className="text-sm text-destructive">{advertisers.error}</p>}

      {advertisers.loading ? (
        <TableSkeleton columns={7} />
      ) : (
        <DataTable
          columns={columns}
          rows={advertisers.data ?? []}
          getRowKey={(row) => row.id}
          emptyMessage="No advertisers match these filters."
        />
      )}

      <Modal open={!!edit} onOpenChange={(open) => !open && setEdit(null)} title="Edit advertiser" className="max-w-2xl">
        {edit && (
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ['Name', 'name'],
                ['Contact name', 'contactName'],
                ['Contact email', 'contactEmail'],
                ['Phone', 'phone'],
                ['Country', 'country'],
                ['Website', 'websiteUrl'],
              ] as const
            ).map(([label, key]) => (
              <label key={key} className="block">
                <span className="text-xs font-medium text-muted-foreground">{label}</span>
                <Input value={edit[key]} onChange={(event) => setEdit({ ...edit, [key]: event.target.value })} className="mt-1" />
              </label>
            ))}
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-muted-foreground">Notes</span>
              <Textarea rows={3} value={edit.notes} onChange={(event) => setEdit({ ...edit, notes: event.target.value })} className="mt-1" />
            </label>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button variant="outline" onClick={() => setEdit(null)}>
                Cancel
              </Button>
              <Button disabled={saving} onClick={saveEdit}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export function PendingAdvertisers() {
  return (
    <AllAdvertisers
      defaultStatus="PENDING"
      title="Pending advertisers"
      description="Advertisers added but not yet activated. Their offers cannot go live until they are."
    />
  );
}
