import { useEffect, useState } from 'react';
import { Button, Input, PageHeader, Skeleton, toast } from '@fatexia/ui';
import type { Affiliate } from '@fatexia/types';
import { getOwnProfile, updateOwnProfile } from '../../lib/portal-api';
import { useAsync } from '../../hooks/useAsync';

const MACROS: { token: string; meaning: string }[] = [
  { token: '{click_id}', meaning: 'The click that produced the conversion — match this to your own click id.' },
  { token: '{payout}', meaning: 'What you earned, as a decimal number.' },
  { token: '{currency}', meaning: 'Currency of the payout, e.g. USD.' },
  { token: '{status}', meaning: 'Conversion status at the time we fired the postback.' },
  { token: '{offer_id}', meaning: 'The offer the conversion belongs to.' },
];

// Self-service postback URL. Changes go through PATCH /affiliates/me, which cannot
// touch manager assignment or account status.
export function PostbackSetup() {
  const profile = useAsync<Affiliate>(() => getOwnProfile(), []);
  const [postbackUrl, setPostbackUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile.data) setPostbackUrl(profile.data.postbackUrl ?? '');
  }, [profile.data]);

  async function save() {
    setSaving(true);
    try {
      await updateOwnProfile({ postbackUrl: postbackUrl.trim() });
      toast.success('Postback URL saved');
      profile.reload();
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
          <span className="text-xs font-medium text-muted-foreground">Your postback URL</span>
          <Input
            value={postbackUrl}
            onChange={(event) => setPostbackUrl(event.target.value)}
            placeholder="https://your-tracker.com/postback?click_id={click_id}&payout={payout}&status={status}"
            className="mt-1 font-mono text-xs"
          />
        </label>
        <div className="mt-4 flex justify-end">
          <Button disabled={saving} onClick={save}>
            {saving ? 'Saving…' : 'Save postback URL'}
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-card-foreground">Available macros</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Put these in your URL and we substitute the real values when we fire it.
        </p>
        <dl className="mt-4 space-y-3">
          {MACROS.map((macro) => (
            <div key={macro.token} className="flex flex-wrap items-baseline gap-3">
              <dt>
                <button
                  type="button"
                  onClick={() => setPostbackUrl((current) => `${current}${macro.token}`)}
                  className="rounded-full border border-border px-2 py-0.5 font-mono text-xs text-muted-foreground hover:border-primary hover:text-foreground"
                >
                  {macro.token}
                </button>
              </dt>
              <dd className="text-xs text-muted-foreground">{macro.meaning}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-card-foreground">How delivery works</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>• We fire the postback when a conversion reaches approved status, not the moment it arrives.</li>
          <li>• A failed delivery is retried up to three times with a growing delay between attempts.</li>
          <li>• Every attempt is logged on our side, so your manager can tell you exactly what we sent and what came back.</li>
        </ul>
      </section>
    </div>
  );
}
