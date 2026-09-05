import { useEffect, useState } from 'react';
import { Button, ConfirmModal, Input, PageHeader, Skeleton, toast } from '@fatexia/ui';
import type { Affiliate } from '@fatexia/types';
import { getOwnProfile, updateOwnProfile } from '../../lib/portal-api';
import { useAsync } from '../../hooks/useAsync';

const MACROS: { token: string; paramKey: string; meaning: string }[] = [
  { token: '{click_id}', paramKey: 'click_id', meaning: 'The click that produced the conversion — match this to your own click id.' },
  { token: '{payout}', paramKey: 'payout', meaning: 'What you earned, as a decimal number.' },
  { token: '{currency}', paramKey: 'currency', meaning: 'Currency of the payout, e.g. USD.' },
  { token: '{status}', paramKey: 'status', meaning: 'Conversion status at the time we fired the postback.' },
  { token: '{offer_id}', paramKey: 'offer_id', meaning: 'The offer the conversion belongs to.' },
];

// Splits a saved URL into its base (everything before the query string) and which of
// our standard macros it was already using, so re-opening this page doesn't blank out
// a URL saved before this checklist existed.
function parseExisting(url: string): { baseUrl: string; checked: Set<string> } {
  const [base = '', query = ''] = url.split('?');
  const checked = new Set<string>();
  for (const pair of query.split('&')) {
    const [key, val] = pair.split('=');
    const macro = MACROS.find((m) => m.paramKey === key && val === m.token);
    if (macro) checked.add(macro.token);
  }
  return { baseUrl: base, checked };
}

function buildUrl(baseUrl: string, checked: Set<string>): string {
  const params = MACROS.filter((m) => checked.has(m.token))
    .map((m) => `${m.paramKey}=${m.token}`)
    .join('&');
  return params ? `${baseUrl}?${params}` : baseUrl;
}

// Self-service postback URL. Changes go through PATCH /affiliates/me, which cannot
// touch manager assignment or account status. Macros are checkbox-driven (issue #11)
// rather than typed, so a saved URL can never carry a mistyped token.
export function PostbackSetup() {
  const profile = useAsync<Affiliate>(() => getOwnProfile(), []);
  const [baseUrl, setBaseUrl] = useState('');
  const [checkedMacros, setCheckedMacros] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);

  useEffect(() => {
    if (!profile.data) return;
    const { baseUrl: base, checked } = parseExisting(profile.data.postbackUrl ?? '');
    setBaseUrl(base);
    setCheckedMacros(checked);
  }, [profile.data]);

  const postbackUrl = buildUrl(baseUrl.trim(), checkedMacros);

  function toggleMacro(token: string) {
    setCheckedMacros((current) => {
      const next = new Set(current);
      if (next.has(token)) next.delete(token);
      else next.add(token);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      await updateOwnProfile({ postbackUrl });
      toast.success('Postback URL saved');
      profile.reload();
      setConfirmSave(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save postback URL');
    } finally {
      setSaving(false);
    }
  }

  if (profile.loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Postback setup" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Postback setup"
        description="We ping this URL when one of your conversions is approved, so your own tracker stays in sync."
      />

      <section className="rounded-lg border border-border bg-card p-4">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Your postback URL (without query parameters)</span>
          <Input
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            placeholder="https://your-tracker.com/postback"
            className="mt-1 font-mono text-xs"
          />
        </label>

        <div className="mt-4">
          <span className="text-xs font-medium text-muted-foreground">Include these values</span>
          <p className="mt-0.5 text-xs text-muted-foreground">Check the ones your tracker needs — we build the URL for you, so there's no macro to type or mistype.</p>
          <div className="mt-2 space-y-2">
            {MACROS.map((macro) => (
              <label key={macro.token} className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
                <input
                  type="checkbox"
                  checked={checkedMacros.has(macro.token)}
                  onChange={() => toggleMacro(macro.token)}
                  className="mt-0.5 size-3.5 accent-[hsl(var(--primary))]"
                />
                <span>
                  <span className="font-mono text-xs text-card-foreground">{macro.paramKey}</span>
                  <span className="text-muted-foreground"> — {macro.meaning}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-md bg-secondary p-3">
          <span className="text-xs font-medium text-muted-foreground">Preview</span>
          <p className="mt-1 break-all font-mono text-xs text-card-foreground">{postbackUrl || '—'}</p>
        </div>

        <div className="mt-4 flex justify-end">
          <Button disabled={saving || !baseUrl.trim()} onClick={() => setConfirmSave(true)}>
            {saving ? 'Saving…' : 'Save postback URL'}
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-card-foreground">How delivery works</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>• We fire the postback when a conversion reaches approved status, not the moment it arrives.</li>
          <li>• A failed delivery is retried up to three times with a growing delay between attempts.</li>
          <li>• Every attempt is logged on our side, so your manager can tell you exactly what we sent and what came back.</li>
        </ul>
      </section>

      <ConfirmModal
        open={confirmSave}
        onOpenChange={(open) => !open && setConfirmSave(false)}
        title="Save this postback URL?"
        description="Future conversion pings go to this URL instead of your old one — make sure it's correct or your own tracker stops receiving conversions."
        confirmLabel="Save"
        loading={saving}
        onConfirm={save}
      />
    </div>
  );
}
