import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button, Input, PageHeader, Skeleton, StatusBadge, Toggle, toast } from '@fatexia/ui';
import type { NetworkSettings } from '@fatexia/types';
import {
  fetchGeoipNow,
  getGeoipStatus,
  getNetworkSettings,
  updateNetworkSettings,
  type GeoipEditionKey,
  type GeoipEditionStatus,
} from '../../lib/platform-api';
import { useAsync, runAction } from '../../hooks/useAsync';
import { dateTime } from '../../lib/format';
import { GlobalPostbacksSection } from './GlobalPostbacksSection';

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-card-foreground">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
  wide,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  /** Spans both columns — for a URL that would otherwise wrap mid-field. */
  wide?: boolean;
}) {
  return (
    <label className={wide ? 'block sm:col-span-2' : 'block'}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

const GEOIP_EDITION_LABELS: Record<GeoipEditionKey, string> = {
  'GeoLite2-City': 'City / country database',
  'GeoLite2-ASN': 'ASN database',
};

// Never downloaded automatically — build and Tracker-startup auto-fetch were both
// removed because the Tracker's filesystem is ephemeral, so every deploy/restart either
// re-downloaded (build) or wasted a startup attempt (boot), and either way risked
// MaxMind's rate limit. This is the only place a fetch is ever triggered from.
//
// A restart no longer costs a download: each fetch is also stored in Postgres and the
// Tracker restores the files from there at boot (see backend infra/geoip/geoip-store.ts).
// So "Present" can be true long after the last download, which is why both dates show.
// How often the page asks whether the download has finished. The run takes a minute or
// two; this is frequent enough to feel live and rare enough to be nothing.
const POLL_MS = 3000;

function GeoipSection() {
  const status = useAsync(() => getGeoipStatus(), []);
  const [starting, setStarting] = useState(false);

  // The Tracker is the authority on whether a run is in progress, not this component:
  // the download survives a page reload, and another admin may have started it. Reading
  // it from the status means the progress bar is right either way.
  const running = status.data?.fetch.running ?? false;
  const lastRun = status.data?.fetch ?? null;

  // Poll only while something is actually happening, so an idle Settings page is not
  // quietly hitting the Tracker every three seconds forever.
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(status.reload, POLL_MS);
    return () => clearInterval(timer);
  }, [running, status.reload]);

  async function refresh() {
    setStarting(true);
    await runAction(() => fetchGeoipNow(), {
      success: 'Download started — this takes a minute or two',
      onDone: status.reload,
    });
    setStarting(false);
  }

  // Reported once the run is over. `skipped-cooldown` is the only outcome that needs
  // explaining — the others are visible in the per-edition rows below.
  const skipped = Object.entries(lastRun?.editions ?? {})
    .filter(([, outcome]) => outcome === 'skipped-cooldown')
    .map(([edition]) => GEOIP_EDITION_LABELS[edition as GeoipEditionKey]);

  return (
    <Section
      title="GeoIP Database"
      hint="Used by the Tracker for country/ASN lookups. Kept in the database and restored automatically when the Tracker restarts, so a fetch is only needed when the data is stale or has never been downloaded. Limited to 10 attempts per database per 24h (MaxMind's rate limit)."
    >
      <div className="sm:col-span-2 space-y-2">
        {status.loading && <Skeleton className="h-16 w-full" />}
        {status.error && <p className="text-sm text-destructive">{status.error}</p>}

        {/* While the download runs. The bar is indeterminate on purpose: MaxMind sends
            no content-length worth trusting and the work is download → extract → store,
            so any percentage would be invented. It says "something is happening and you
            do not need to press the button again", which is the whole job. */}
        {running && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-center gap-2">
              <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
              <p className="text-sm font-medium text-card-foreground">Downloading from MaxMind…</p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              About 74MB across both databases — a minute or two. You can leave this page; it keeps going.
            </p>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-primary/15">
              <div className="h-full w-1/3 animate-[fatexia-indeterminate_1.4s_ease-in-out_infinite] rounded-full bg-primary" />
            </div>
          </div>
        )}

        {!running && lastRun?.error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            Last download failed: {lastRun.error}
          </p>
        )}

        {!running && skipped.length > 0 && (
          <p className="rounded-md border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
            {skipped.join(' and ')} skipped — the daily fetch limit is spent. It resets 24h after the first attempt.
          </p>
        )}

        {status.data &&
          (Object.entries(status.data.editions) as [GeoipEditionKey, GeoipEditionStatus][]).map(([edition, info]) => (
            <div key={edition} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
              <div>
                <p className="text-sm text-card-foreground">{GEOIP_EDITION_LABELS[edition]}</p>
                {/* The download date, not the file's timestamp — after a restart the
                    file was written when it was restored, which says nothing about how
                    fresh the data is. That is the number that decides whether to spend
                    one of the day's fetches. */}
                <p className="text-xs text-muted-foreground">
                  {info.storedAt
                    ? `Downloaded ${dateTime(info.storedAt)}`
                    : info.present
                      ? `On disk since ${dateTime(info.updatedAt)}`
                      : 'Never downloaded'}
                </p>
                {!info.present && info.storedAt && (
                  <p className="text-xs text-warning">Stored, but not yet on the Tracker — it restores on the next restart.</p>
                )}
              </div>
              <StatusBadge variant={info.present ? 'success' : 'warning'}>{info.present ? 'Active' : 'Missing'}</StatusBadge>
            </div>
          ))}
        {/* Disabled while a run is in flight — a second press cannot start a second
            download (the Tracker refuses), but a button that looks pressable and does
            nothing invites exactly the repeat-clicking that spends MaxMind's allowance. */}
        <Button variant="secondary" disabled={starting || running} onClick={refresh}>
          {running ? 'Downloading…' : starting ? 'Starting…' : 'Refresh now'}
        </Button>
      </div>
    </Section>
  );
}

export function Settings() {
  const settings = useAsync<NetworkSettings>(() => getNetworkSettings(), []);
  const [form, setForm] = useState<NetworkSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings.data) setForm(settings.data);
  }, [settings.data]);

  function set<K extends keyof NetworkSettings>(key: K, value: NetworkSettings[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      // updatedAt is server-owned; sending it back would be rejected by the schema.
      const { updatedAt: _updatedAt, ...payload } = form;
      const saved = await updateNetworkSettings(payload);
      setForm(saved);
      toast.success('Settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  if (settings.loading || !form) {
    return (
      <div className="space-y-6">
        <PageHeader title="Network settings" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Network settings"
        description="Network-wide defaults. Managers cannot see or change this page."
        actions={
          <Button disabled={saving} onClick={save}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        }
      />

      {settings.error && <p className="text-sm text-destructive">{settings.error}</p>}

      <Section title="Identity">
        <Field label="Network name">
          <Input value={form.networkName} onChange={(event) => set('networkName', event.target.value)} />
        </Field>
        <Field label="Support email">
          <Input value={form.supportEmail ?? ''} onChange={(event) => set('supportEmail', event.target.value)} />
        </Field>
        <Field
          label="Support Telegram"
          hint="Handle only, e.g. fatexia. Shown on the contact card for affiliates with no assigned manager."
        >
          <Input value={form.supportTelegram ?? ''} onChange={(event) => set('supportTelegram', event.target.value)} />
        </Field>
        <Field
          label="Support Microsoft Teams"
          hint="A Teams link, or the address to open a chat against. Shown on the contact card for affiliates with no assigned manager."
        >
          <Input value={form.supportTeams ?? ''} onChange={(event) => set('supportTeams', event.target.value)} />
        </Field>
        <Field label="Default currency" hint="Three-letter ISO code, e.g. USD.">
          <Input value={form.defaultCurrency} maxLength={3} onChange={(event) => set('defaultCurrency', event.target.value.toUpperCase())} />
        </Field>
        <Field label="Timezone">
          <Input value={form.timezone} onChange={(event) => set('timezone', event.target.value)} />
        </Field>
      </Section>

      <Section title="Payouts" hint="These govern when an approved conversion becomes payable and how big a balance has to be.">
        <Field label="Hold days" hint="Days after approval before a conversion is eligible for a payout batch.">
          <Input
            type="number"
            min={0}
            max={365}
            value={form.defaultHoldDays}
            onChange={(event) => set('defaultHoldDays', Number(event.target.value))}
          />
        </Field>
        <Field label="Minimum payout threshold" hint="Affiliates below this are skipped when a batch is generated.">
          <Input
            type="number"
            min={0}
            step="0.01"
            value={form.minimumPayoutThreshold}
            onChange={(event) => set('minimumPayoutThreshold', Number(event.target.value))}
          />
        </Field>
        <Field label="Payout cycle (days)">
          <Input
            type="number"
            min={1}
            max={365}
            value={form.payoutCycleDays}
            onChange={(event) => set('payoutCycleDays', Number(event.target.value))}
          />
        </Field>
        <Field label="Points per approved conversion" hint="The loyalty ledger only — points are not redeemable.">
          <Input
            type="number"
            min={0}
            value={form.pointsPerConversion}
            onChange={(event) => set('pointsPerConversion', Number(event.target.value))}
          />
        </Field>
      </Section>

      <Section title="Automation">
        <div className="flex items-center justify-between rounded-md border border-border p-3">
          <div>
            <p className="text-sm text-card-foreground">Auto-approve affiliate applications</p>
            <p className="text-xs text-muted-foreground">New registrations become active without review.</p>
          </div>
          <Toggle checked={form.autoApproveAffiliates} onCheckedChange={(value) => set('autoApproveAffiliates', value)} />
        </div>
        <div className="flex items-center justify-between rounded-md border border-border p-3">
          <div>
            <p className="text-sm text-card-foreground">Auto-approve conversions</p>
            <p className="text-xs text-muted-foreground">Skips manual review on incoming conversions.</p>
          </div>
          <Toggle checked={form.autoApproveConversions} onCheckedChange={(value) => set('autoApproveConversions', value)} />
        </div>
      </Section>

      <Section
        title="Fraud thresholds"
        hint="Score bands for the click-scoring pipeline. Suspect must sit below block, or the middle hold-for-review tier disappears entirely."
      >
        <Field label="Suspect threshold" hint="Scores at or above this are held for review.">
          <Input
            type="number"
            min={0}
            max={100}
            value={form.fraudSuspectThreshold}
            onChange={(event) => set('fraudSuspectThreshold', Number(event.target.value))}
          />
        </Field>
        <Field label="Block threshold" hint="Scores at or above this are redirected away.">
          <Input
            type="number"
            min={0}
            max={100}
            value={form.fraudBlockThreshold}
            onChange={(event) => set('fraudBlockThreshold', Number(event.target.value))}
          />
        </Field>
        <Field
          label="Blocked traffic redirect"
          hint="Where blocked clicks go instead of the advertiser. Leave blank for the built-in default. An offer can override this."
          wide
        >
          <Input
            type="url"
            placeholder="https://www.google.com"
            value={form.blockedRedirectUrl ?? ''}
            onChange={(event) => set('blockedRedirectUrl', event.target.value)}
          />
        </Field>
      </Section>

      <Section title="Rate limits" hint="Per-minute caps on the two endpoints most exposed to abuse.">
        <Field label="Login attempts / minute">
          <Input
            type="number"
            min={1}
            value={form.loginRateLimitPerMinute}
            onChange={(event) => set('loginRateLimitPerMinute', Number(event.target.value))}
          />
        </Field>
        <Field label="Clicks / minute per IP" hint="Keep this generous — legitimate ad traffic spikes.">
          <Input
            type="number"
            min={1}
            value={form.clickRateLimitPerMinute}
            onChange={(event) => set('clickRateLimitPerMinute', Number(event.target.value))}
          />
        </Field>
      </Section>

      <GlobalPostbacksSection />

      <GeoipSection />
    </div>
  );
}
