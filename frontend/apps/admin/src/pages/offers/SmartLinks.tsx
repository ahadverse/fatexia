import { useState } from 'react';
import {
  Button,
  ConfirmModal,
  DataTable,
  Input,
  Modal,
  PageHeader,
  Select,
  TableSkeleton,
  Textarea,
  toast,
  type DataTableColumn,
} from '@fatexia/ui';
import type { Offer, SmartLink, SmartLinkRotation } from '@fatexia/types';
import { createSmartLink, deleteSmartLink, getSmartLinks, updateSmartLink } from '../../lib/platform-api';
import { getOffers } from '../../lib/offers-api';
import { runAction, useAsync } from '../../hooks/useAsync';
import { date } from '../../lib/format';
import { StatusPill } from '../../components/StatusPill';

const ROTATIONS: { value: SmartLinkRotation; label: string; hint: string }[] = [
  { value: 'TOP_PAYOUT', label: 'Highest payout', hint: 'Always sends to the best-paying eligible offer.' },
  { value: 'ROUND_ROBIN', label: 'Round robin', hint: 'Splits traffic evenly across members.' },
  { value: 'BEST_CR', label: 'Best converting', hint: 'Weights toward members with the strongest recent CR.' },
];

interface FormState {
  id: string | null;
  name: string;
  slug: string;
  description: string;
  offerIds: string[];
  countries: string;
  devices: string;
  rotation: SmartLinkRotation;
  fallbackUrl: string;
}

const EMPTY_FORM: FormState = {
  id: null,
  name: '',
  slug: '',
  description: '',
  offerIds: [],
  countries: '',
  devices: '',
  rotation: 'TOP_PAYOUT',
  fallbackUrl: '',
};

// Slugs are URL-path material, so the form derives one rather than letting a name
// with spaces or punctuation through to a server-side rejection.
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function SmartLinks() {
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<SmartLink | null>(null);

  const links = useAsync(() => getSmartLinks(), []);
  const offers = useAsync<Offer[]>(() => getOffers(), []);

  // Only APPROVED offers can be members — the server rejects anything else, since a
  // paused or pending member would resolve to a dead redirect at click time.
  const approvedOffers = (offers.data ?? []).filter((offer) => offer.status === 'APPROVED');

  function openCreate() {
    setForm({ ...EMPTY_FORM });
  }

  function openEdit(link: SmartLink) {
    setForm({
      id: link.id,
      name: link.name,
      slug: link.slug,
      description: link.description ?? '',
      offerIds: link.offerIds,
      countries: link.countries.join(', '),
      devices: link.devices.join(', '),
      rotation: link.rotation,
      fallbackUrl: link.fallbackUrl ?? '',
    });
  }

  async function save() {
    if (!form) return;
    if (form.offerIds.length === 0) {
      toast.error('Pick at least one member offer');
      return;
    }

    const payload = {
      name: form.name,
      slug: form.slug,
      description: form.description || undefined,
      offerIds: form.offerIds,
      countries: splitList(form.countries),
      devices: splitList(form.devices),
      rotation: form.rotation,
      fallbackUrl: form.fallbackUrl || undefined,
    };

    setSaving(true);
    const result = await runAction(() => (form.id ? updateSmartLink(form.id, payload) : createSmartLink(payload)), {
      success: form.id ? 'Smart-link updated' : 'Smart-link created',
      onDone: links.reload,
    });
    setSaving(false);
    if (result) setForm(null);
  }

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
          <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
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
        actions={<Button onClick={openCreate}>New smart-link</Button>}
      />

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

      <Modal
        open={!!form}
        onOpenChange={(open) => !open && setForm(null)}
        title={form?.id ? 'Edit smart-link' : 'New smart-link'}
        className="max-w-2xl"
      >
        {form && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Name</span>
                <Input
                  value={form.name}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      name: event.target.value,
                      // Only auto-fill the slug while creating — changing an existing
                      // slug breaks links already in circulation.
                      slug: form.id ? form.slug : slugify(event.target.value),
                    })
                  }
                  placeholder="Finance rotator"
                  className="mt-1"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Slug</span>
                <Input
                  value={form.slug}
                  onChange={(event) => setForm({ ...form, slug: slugify(event.target.value) })}
                  placeholder="finance-rotator"
                  className="mt-1"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Description</span>
              <Textarea
                rows={2}
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                className="mt-1"
              />
            </label>

            <div>
              <span className="text-xs font-medium text-muted-foreground">Member offers (approved only)</span>
              <div className="mt-1 max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                {approvedOffers.length === 0 && (
                  <p className="p-2 text-sm text-muted-foreground">No approved offers available yet.</p>
                )}
                {approvedOffers.map((offer) => (
                  <label key={offer.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent">
                    <input
                      type="checkbox"
                      checked={form.offerIds.includes(offer.id)}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          offerIds: event.target.checked
                            ? [...form.offerIds, offer.id]
                            : form.offerIds.filter((id) => id !== offer.id),
                        })
                      }
                    />
                    <span className="text-card-foreground">{offer.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {offer.currency} {offer.defaultPayoutAmount.toFixed(2)}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Countries (comma separated, blank = all)</span>
                <Input
                  value={form.countries}
                  onChange={(event) => setForm({ ...form, countries: event.target.value })}
                  placeholder="US, CA"
                  className="mt-1"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Devices (blank = all)</span>
                <Input
                  value={form.devices}
                  onChange={(event) => setForm({ ...form, devices: event.target.value })}
                  placeholder="mobile, desktop"
                  className="mt-1"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Rotation</span>
              <Select
                value={form.rotation}
                onChange={(event) => setForm({ ...form, rotation: event.target.value as SmartLinkRotation })}
                className="mt-1"
              >
                {ROTATIONS.map((rotation) => (
                  <option key={rotation.value} value={rotation.value}>
                    {rotation.label}
                  </option>
                ))}
              </Select>
              <span className="mt-1 block text-xs text-muted-foreground">
                {ROTATIONS.find((r) => r.value === form.rotation)?.hint}
              </span>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Fallback URL</span>
              <Input
                value={form.fallbackUrl}
                onChange={(event) => setForm({ ...form, fallbackUrl: event.target.value })}
                placeholder="https://fatexia.com/thanks"
                className="mt-1"
              />
              <span className="mt-1 block text-xs text-muted-foreground">
                Where a click goes when no member offer matches the visitor's geo or device.
              </span>
            </label>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setForm(null)}>
                Cancel
              </Button>
              <Button disabled={saving} onClick={save}>
                {saving ? 'Saving…' : form.id ? 'Save changes' : 'Create smart-link'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

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
