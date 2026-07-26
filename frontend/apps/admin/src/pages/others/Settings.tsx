import { useEffect, useState } from 'react';
import { Button, Input, PageHeader, Skeleton, Toggle, toast } from '@fatexia/ui';
import type { NetworkSettings } from '@fatexia/types';
import { getNetworkSettings, updateNetworkSettings } from '../../lib/platform-api';
import { useAsync } from '../../hooks/useAsync';

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

      <Section title="Email delivery" hint="The SMTP password lives on the Integrations page, never here.">
        <Field label="SMTP host">
          <Input value={form.smtpHost ?? ''} onChange={(event) => set('smtpHost', event.target.value)} />
        </Field>
        <Field label="SMTP port">
          <Input
            type="number"
            value={form.smtpPort ?? ''}
            onChange={(event) => set('smtpPort', event.target.value ? Number(event.target.value) : null)}
          />
        </Field>
        <Field label="SMTP username">
          <Input value={form.smtpUser ?? ''} onChange={(event) => set('smtpUser', event.target.value)} />
        </Field>
        <Field label="From address">
          <Input value={form.smtpFromEmail ?? ''} onChange={(event) => set('smtpFromEmail', event.target.value)} />
        </Field>
      </Section>
    </div>
  );
}
