import { useState } from 'react';
import {
  Button,
  ConfirmModal,
  DataTable,
  FilterField,
  Input,
  Modal,
  PageHeader,
  TableSkeleton,
  type DataTableColumn,
} from '@fatexia/ui';
import type { AdvertiserNetwork } from '@fatexia/types';
import {
  createAdvertiserNetwork,
  deleteAdvertiserNetwork,
  getAdvertiserNetworks,
  updateAdvertiserNetwork,
} from '../../lib/advertiser-networks-api';
import { runAction, useAsync } from '../../hooks/useAsync';

interface Draft {
  id: string | null;
  name: string;
  clickIdToken: string;
  payoutToken: string;
}

const EMPTY_DRAFT: Draft = { id: null, name: '', clickIdToken: '', payoutToken: '' };

/**
 * Advertiser platforms and how each one's postback writes our values back.
 *
 * Tokens are saved exactly as typed, brackets and all — `#s1#`, `{aff_click_id}`,
 * `[ml_sub1]` — because the delimiter style is the platform's, and a "tidied" token would
 * simply never be substituted on their side.
 */
export function MacrosSettings() {
  const networks = useAsync<AdvertiserNetwork[]>(() => getAdvertiserNetworks(), []);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<AdvertiserNetwork | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  async function save() {
    if (!draft) return;
    setSaving(true);
    const input = {
      name: draft.name.trim(),
      clickIdToken: draft.clickIdToken.trim(),
      payoutToken: draft.payoutToken.trim() || null,
    };
    const result = await runAction(
      () => (draft.id ? updateAdvertiserNetwork(draft.id, input) : createAdvertiserNetwork(input)),
      { success: draft.id ? 'Network updated' : 'Network added', onDone: networks.reload },
    );
    setSaving(false);
    if (result !== null) setDraft(null);
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeletingBusy(true);
    const result = await runAction(() => deleteAdvertiserNetwork(deleting.id), {
      success: 'Network deleted',
      onDone: networks.reload,
    });
    setDeletingBusy(false);
    if (result !== null) setDeleting(null);
  }

  const columns: DataTableColumn<AdvertiserNetwork>[] = [
    { key: 'name', header: 'Network', render: (row) => <span className="font-medium">{row.name}</span> },
    { key: 'click', header: 'Click ID token', render: (row) => <code className="text-xs">{row.clickIdToken}</code> },
    {
      key: 'payout',
      header: 'Payout token',
      render: (row) =>
        row.payoutToken ? (
          <code className="text-xs">{row.payoutToken}</code>
        ) : (
          <span className="text-xs text-muted-foreground">generic {'{sum}'}</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex justify-end gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setDraft({ id: row.id, name: row.name, clickIdToken: row.clickIdToken, payoutToken: row.payoutToken ?? '' })
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

  const canSave = !!draft && draft.name.trim() !== '' && draft.clickIdToken.trim() !== '' && !/\s/.test(draft.clickIdToken.trim());

  return (
    <div className="space-y-6">
      <PageHeader
        title="Macros settings"
        description="How each advertiser platform writes our click id (and payout) back on its postback. Type the token exactly as the platform expects it, brackets or hashes included."
        actions={<Button onClick={() => setDraft(EMPTY_DRAFT)}>Add network</Button>}
      />

      {networks.error && <p className="text-sm text-destructive">{networks.error}</p>}

      {networks.loading ? (
        <TableSkeleton columns={4} />
      ) : (
        <DataTable
          columns={columns}
          rows={networks.data ?? []}
          getRowKey={(row) => row.id}
          emptyMessage="No networks yet. Add one, then pick it on an offer to get its postback URL written in that platform's syntax."
        />
      )}

      <Modal open={!!draft} onOpenChange={(open) => !open && setDraft(null)} title={draft?.id ? 'Edit network' : 'Add network'}>
        {draft && (
          <div className="space-y-4">
            <FilterField label="Network name" className="flex flex-col gap-1">
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Affmine" />
            </FilterField>
            <FilterField label="Click ID token" className="flex flex-col gap-1">
              <Input
                value={draft.clickIdToken}
                onChange={(e) => setDraft({ ...draft, clickIdToken: e.target.value })}
                placeholder="#s1#   {aff_click_id}   [ml_sub1]"
              />
              <span className="text-xs text-muted-foreground">
                What the platform's postback puts in place of our click id. Saved exactly as typed.
              </span>
            </FilterField>
            <FilterField label="Payout token (optional)" className="flex flex-col gap-1">
              <Input
                value={draft.payoutToken}
                onChange={(e) => setDraft({ ...draft, payoutToken: e.target.value })}
                placeholder="[payout_decimal]"
              />
              <span className="text-xs text-muted-foreground">
                What it puts in place of the conversion's payout, sent to us as <code>sum</code>. Leave empty for the generic{' '}
                <code>{'{sum}'}</code>. Must be a decimal amount, not cents.
              </span>
            </FilterField>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDraft(null)}>
                Cancel
              </Button>
              <Button onClick={() => void save()} disabled={!canSave || saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this network?"
        description={
          deleting
            ? `Offers using "${deleting.name}" keep working, but their postback URL goes back to the generic {click_id} / {sum} macros.`
            : ''
        }
        confirmLabel="Delete"
        destructive
        loading={deletingBusy}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
