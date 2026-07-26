import { useState } from 'react';
import {
  Button,
  ConfirmModal,
  DataTable,
  Input,
  Modal,
  PageHeader,
  TableSkeleton,
  Textarea,
  type DataTableColumn,
} from '@fatexia/ui';
import type { Affiliate, AffiliateGroup } from '@fatexia/types';
import {
  createAffiliateGroup,
  deleteAffiliateGroup,
  getAffiliateGroups,
  getAffiliates,
  updateAffiliateGroup,
} from '../../lib/affiliates-api';
import { runAction, useAsync } from '../../hooks/useAsync';
import { date } from '../../lib/format';

interface FormState {
  id: string | null;
  name: string;
  description: string;
  affiliateIds: string[];
}

const EMPTY_FORM: FormState = { id: null, name: '', description: '', affiliateIds: [] };

// Bulk offer-targeting groups: a payout rule can target a group instead of listing
// every affiliate id, so membership changes take effect without touching offers.
export function AffiliateGroups() {
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<AffiliateGroup | null>(null);

  const groups = useAsync(() => getAffiliateGroups(), []);
  const affiliates = useAsync<Affiliate[]>(() => getAffiliates(), []);

  const affiliateName = (id: string) => {
    const affiliate = (affiliates.data ?? []).find((row) => row.id === id);
    return affiliate?.fullName ?? affiliate?.email ?? id;
  };

  async function save() {
    if (!form) return;
    const payload = { name: form.name, description: form.description || undefined, affiliateIds: form.affiliateIds };
    setSaving(true);
    const result = await runAction(() => (form.id ? updateAffiliateGroup(form.id, payload) : createAffiliateGroup(payload)), {
      success: form.id ? 'Group updated' : 'Group created',
      onDone: groups.reload,
    });
    setSaving(false);
    if (result) setForm(null);
  }

  const columns: DataTableColumn<AffiliateGroup>[] = [
    { key: 'name', header: 'Group', render: (row) => row.name },
    {
      key: 'description',
      header: 'Description',
      render: (row) => <span className="text-xs text-muted-foreground">{row.description ?? '—'}</span>,
    },
    { key: 'members', header: 'Members', render: (row) => String(row.memberCount) },
    {
      key: 'preview',
      header: 'Who',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.affiliateIds.slice(0, 3).map(affiliateName).join(', ')}
          {row.affiliateIds.length > 3 ? ` +${row.affiliateIds.length - 3} more` : ''}
          {row.affiliateIds.length === 0 ? '—' : ''}
        </span>
      ),
    },
    { key: 'createdAt', header: 'Created', render: (row) => date(row.createdAt) },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setForm({ id: row.id, name: row.name, description: row.description ?? '', affiliateIds: row.affiliateIds })
            }
          >
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
        title="Affiliate groups"
        description="Named sets of affiliates that payout rules can target in bulk, instead of listing every affiliate individually."
        actions={<Button onClick={() => setForm({ ...EMPTY_FORM })}>New group</Button>}
      />

      {groups.error && <p className="text-sm text-destructive">{groups.error}</p>}

      {groups.loading ? (
        <TableSkeleton columns={6} />
      ) : (
        <DataTable
          columns={columns}
          rows={groups.data ?? []}
          getRowKey={(row) => row.id}
          emptyMessage="No groups yet. Create one to target a set of affiliates from a payout rule."
        />
      )}

      <Modal open={!!form} onOpenChange={(open) => !open && setForm(null)} title={form?.id ? 'Edit group' : 'New group'}>
        {form && (
          <div className="space-y-4">
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Name</span>
              <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1" />
            </label>
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
              <span className="text-xs font-medium text-muted-foreground">Members ({form.affiliateIds.length})</span>
              <div className="mt-1 max-h-64 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                {(affiliates.data ?? []).map((affiliate) => (
                  <label key={affiliate.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent">
                    <input
                      type="checkbox"
                      checked={form.affiliateIds.includes(affiliate.id)}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          affiliateIds: event.target.checked
                            ? [...form.affiliateIds, affiliate.id]
                            : form.affiliateIds.filter((id) => id !== affiliate.id),
                        })
                      }
                    />
                    <span className="text-card-foreground">{affiliate.fullName ?? affiliate.email}</span>
                    <span className="text-xs text-muted-foreground">{affiliate.country ?? ''}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setForm(null)}>
                Cancel
              </Button>
              <Button disabled={saving} onClick={save}>
                {saving ? 'Saving…' : form.id ? 'Save changes' : 'Create group'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this group?"
        description={
          deleting
            ? `"${deleting.name}" will be removed. Any payout rule targeting it stops matching those ${deleting.memberCount} affiliates.`
            : ''
        }
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          await runAction(() => deleteAffiliateGroup(deleting.id), { success: 'Group deleted', onDone: groups.reload });
          setDeleting(null);
        }}
      />
    </div>
  );
}
