import { useState } from 'react';
import { Button, ConfirmModal, Input, Modal, Skeleton, StatusBadge, Toggle, toast } from '@fatexia/ui';
import type { GlobalPostback, GlobalPostbackDirection } from '@fatexia/types';
import {
  createGlobalPostback,
  deleteGlobalPostback,
  getGlobalPostbacks,
  updateGlobalPostback,
} from '../../lib/platform-api';
import { runAction, useAsync } from '../../hooks/useAsync';
import { dateTime } from '../../lib/format';

/**
 * Every macro the outbound sender substitutes — see MACROS in
 * backend/src/modules/postback/outbound-postback.service.ts. Listed here so an operator
 * building a URL is not guessing; a token this list gets wrong is delivered literally.
 */
const MACROS = [
  ['{conversion_id}', 'Our id for this conversion'],
  ['{click_id}', 'The click it was attributed to'],
  ['{offer_id}', 'Offer id'],
  ['{offer_name}', 'Offer name'],
  ['{affiliate_id}', 'Affiliate id (blank on an orphan)'],
  ['{payout}', 'What the affiliate earns'],
  ['{revenue}', 'What the advertiser pays — network endpoints only'],
  ['{currency}', 'Currency code'],
  ['{status}', 'PENDING / APPROVED / REJECTED / DUPLICATE'],
  ['{is_duplicate}', '1 or 0'],
  ['{transaction_id}', "The advertiser's own reference"],
  ['{country}', 'Two-letter country of the click'],
  ['{timestamp}', 'ISO 8601, when we fired'],
  ['{sub1}…{sub8}', 'Sub ids carried from the click'],
] as const;

interface DraftState {
  id: string | null;
  name: string;
  direction: GlobalPostbackDirection;
  url: string;
  secret: string;
  allowedIps: string;
  enabled: boolean;
}

const EMPTY: DraftState = {
  id: null,
  name: '',
  direction: 'OUTBOUND',
  url: '',
  secret: '',
  allowedIps: '',
  enabled: true,
};

function randomSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return `pb_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Network-level postbacks, both directions, in one list.
 *
 * Inbound entries save an advertiser from being issued fresh credentials per offer;
 * outbound entries feed a BI or agency endpoint on every conversion. They share a list
 * because the operator's job is identical either way — name it, enable it, remove it.
 */
export function GlobalPostbacksSection() {
  const postbacks = useAsync<GlobalPostback[]>(() => getGlobalPostbacks(), []);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<GlobalPostback | null>(null);

  // Inbound only for now. The outbound half is built and live on the server — it still
  // fires for every approved conversion — but is kept off this page until it is needed,
  // so the list stays about the one thing an advertiser integration needs.
  const rows = (postbacks.data ?? []).filter((row) => row.direction === 'INBOUND');

  /**
   * The address to hand an advertiser, on the tracker host.
   *
   * The template comes from the server — the admin app has no idea what
   * PUBLIC_TRACKING_URL is, which is why the preview used to start with an ellipsis.
   * Falls back to a relative path only if no row has been loaded yet, and the real
   * secret is substituted while it is still in the draft, since the server never
   * returns it again afterwards.
   */
  function advertiserUrl(secret: string): string {
    const template =
      postbacks.data?.find((row) => row.postbackUrl)?.postbackUrl ?? '/postback?click_id={click_id}&secret=<secret>';
    return secret ? template.replace('<secret>', secret) : template;
  }

  function openCreate(direction: GlobalPostbackDirection) {
    setDraft({ ...EMPTY, direction, secret: direction === 'INBOUND' ? randomSecret() : '' });
  }

  function openEdit(row: GlobalPostback) {
    setDraft({
      id: row.id,
      name: row.name,
      direction: row.direction,
      url: row.url ?? '',
      // Left blank on purpose: the server never returns the stored secret, and an empty
      // field on save means "keep the existing one".
      secret: '',
      allowedIps: row.allowedIps ?? '',
      enabled: row.enabled,
    });
  }

  async function save() {
    if (!draft) return;
    if (!draft.name.trim()) return toast.error('Give it a name');
    if (draft.direction === 'OUTBOUND' && !draft.url.trim()) return toast.error('An outbound postback needs a URL');
    if (draft.direction === 'INBOUND' && !draft.id && !draft.secret.trim()) return toast.error('An inbound postback needs a secret');

    const payload = {
      name: draft.name.trim(),
      direction: draft.direction,
      url: draft.direction === 'OUTBOUND' ? draft.url.trim() : null,
      secret: draft.secret.trim() || undefined,
      allowedIps: draft.direction === 'INBOUND' ? draft.allowedIps.trim() || null : null,
      enabled: draft.enabled,
    };

    setSaving(true);
    const result = await runAction(
      () => (draft.id ? updateGlobalPostback(draft.id, payload) : createGlobalPostback(payload)),
      { success: draft.id ? 'Postback saved' : 'Postback added', onDone: postbacks.reload },
    );
    setSaving(false);
    if (result) setDraft(null);
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-card-foreground">Global postback</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Network-level credentials that authorise conversions for every offer at once, so one advertiser integration
            covers the whole catalogue instead of per-offer secrets. An offer's own postback credentials keep working
            alongside these.
          </p>
        </div>
        <Button size="sm" className="shrink-0" onClick={() => openCreate('INBOUND')}>
          + Add postback
        </Button>
      </div>

      <div className="mt-4 space-y-2">
        {postbacks.loading && <Skeleton className="h-20 w-full" />}
        {postbacks.error && <p className="text-sm text-destructive">{postbacks.error}</p>}
        {!postbacks.loading && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">None yet. Offers still use their own postback credentials.</p>
        )}

        {rows.map((row) => (
          <div key={row.id} className="rounded-md border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium text-card-foreground">
                  {row.name}
                  <StatusBadge variant={row.direction === 'INBOUND' ? 'neutral' : 'success'}>{row.direction}</StatusBadge>
                  {!row.enabled && <StatusBadge variant="warning">Disabled</StatusBadge>}
                </p>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {row.direction === 'OUTBOUND' ? row.url : `secret ${row.secretPreview ?? '—'} · IPs ${row.allowedIps || 'any'}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {row.lastUsedAt ? `Last used ${dateTime(row.lastUsedAt)}` : 'Never used yet'}
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                  Edit
                </Button>
                <Button size="sm" variant="destructive" onClick={() => setDeleting(row)}>
                  Delete
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={!!draft}
        onOpenChange={(open) => !open && setDraft(null)}
        title={draft?.id ? 'Edit postback' : `New ${draft?.direction.toLowerCase()} postback`}
        className="max-w-2xl"
      >
        {draft && (
          <div className="space-y-4">
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Name</span>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder={draft.direction === 'INBOUND' ? 'Advertiser platform' : 'BI warehouse'}
                className="mt-1"
              />
            </label>

            {draft.direction === 'OUTBOUND' ? (
              <>
                <label className="block">
                  <span className="text-xs font-medium text-muted-foreground">URL</span>
                  <Input
                    value={draft.url}
                    onChange={(e) => setDraft({ ...draft, url: e.target.value })}
                    placeholder="https://bi.example.com/cv?cid={click_id}&payout={payout}&status={status}"
                    className="mt-1 font-mono text-xs"
                  />
                </label>
                <div className="rounded-md border border-border p-3">
                  <p className="text-xs font-medium text-muted-foreground">Macros</p>
                  <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
                    {MACROS.map(([token, meaning]) => (
                      <div key={token} className="flex gap-2 text-xs">
                        <dt className="shrink-0 font-mono text-card-foreground">{token}</dt>
                        <dd className="truncate text-muted-foreground">{meaning}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </>
            ) : (
              <>
                <label className="block">
                  <span className="text-xs font-medium text-muted-foreground">
                    Secret {draft.id && '(leave blank to keep the current one)'}
                  </span>
                  <Input
                    value={draft.secret}
                    onChange={(e) => setDraft({ ...draft, secret: e.target.value })}
                    className="mt-1 font-mono text-xs"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-muted-foreground">Allowed source IPs</span>
                  <Input
                    value={draft.allowedIps}
                    onChange={(e) => setDraft({ ...draft, allowedIps: e.target.value })}
                    placeholder="Comma separated. Blank = any IP."
                    className="mt-1"
                  />
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Blank accepts any address — only do that when the platform's egress IPs are not fixed.
                  </span>
                </label>
                <div className="rounded-md border border-border bg-background p-2">
                  <p className="text-xs text-muted-foreground">Give this to the advertiser</p>
                  <p className="mt-1 break-all font-mono text-xs text-card-foreground">{advertiserUrl(draft.secret)}</p>
                  {/* The half people forget. Their macro only returns what we put into
                      their link in the first place — without it, click_id arrives empty
                      and every conversion is an orphan with no affiliate to pay. */}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Replace <code className="text-card-foreground">{'{click_id}'}</code> with their click-id macro (an
                    Affise-style tracker calls it <code className="text-card-foreground">{'{ref_id}'}</code>), and make
                    sure each offer's Destination URL passes <code className="text-card-foreground">{'{click_id}'}</code>
                    into their link so they have something to send back.
                  </p>
                </div>
              </>
            )}

            <Toggle checked={draft.enabled} onCheckedChange={(enabled) => setDraft({ ...draft, enabled })} label="Enabled" />

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDraft(null)}>
                Cancel
              </Button>
              <Button disabled={saving} onClick={save}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this postback?"
        description={
          deleting?.direction === 'INBOUND'
            ? `"${deleting.name}" stops authorising conversions immediately. Any advertiser still posting with this secret will be rejected.`
            : `"${deleting?.name}" stops receiving conversions immediately.`
        }
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          await runAction(() => deleteGlobalPostback(deleting.id), { success: 'Postback deleted', onDone: postbacks.reload });
          setDeleting(null);
        }}
      />
    </section>
  );
}
