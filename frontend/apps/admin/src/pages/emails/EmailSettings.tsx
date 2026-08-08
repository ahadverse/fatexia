import { useEffect, useState } from 'react';
import { Button, ConfirmModal, Input, Modal, PageHeader, Skeleton, Toggle, toast } from '@fatexia/ui';
import type { Integration, NetworkSettings } from '@fatexia/types';
import { getIntegrations, getNetworkSettings, testIntegration, updateIntegration, updateNetworkSettings } from '../../lib/platform-api';
import { useAsync } from '../../hooks/useAsync';
import { dateTime } from '../../lib/format';
import { StatusPill } from '../../components/StatusPill';

// The Brevo credential is stored on the shared `integrations` table under this
// provider key — the same row the Integrations page used to render. It lives here
// instead so email setup is one page rather than split across two menus.
const EMAIL_PROVIDER = 'SMTP';

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-card-foreground">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function EmailSettings() {
  const settings = useAsync<NetworkSettings>(() => getNetworkSettings(), []);
  const integrations = useAsync<Integration[]>(() => getIntegrations(), []);

  const [senderEmail, setSenderEmail] = useState('');
  const [senderName, setSenderName] = useState('');
  const [savingSender, setSavingSender] = useState(false);

  const [keyDraft, setKeyDraft] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [toggleTo, setToggleTo] = useState<boolean | null>(null);
  const [togglingSaving, setTogglingSaving] = useState(false);

  const provider = (integrations.data ?? []).find((row) => row.provider === EMAIL_PROVIDER) ?? null;

  useEffect(() => {
    if (!settings.data) return;
    setSenderEmail(settings.data.senderEmail ?? '');
    setSenderName(settings.data.senderName ?? '');
  }, [settings.data]);

  async function saveSender() {
    setSavingSender(true);
    try {
      await updateNetworkSettings({ senderEmail: senderEmail.trim() || null, senderName: senderName.trim() || null });
      toast.success('Sender identity saved');
      settings.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save sender identity');
    } finally {
      setSavingSender(false);
    }
  }

  async function saveKey() {
    if (!provider || !keyDraft) return;
    setSavingKey(true);
    try {
      await updateIntegration(provider.id, { apiKey: keyDraft });
      toast.success('API key saved');
      setKeyDraft(null);
      integrations.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save API key');
    } finally {
      setSavingKey(false);
    }
  }

  // Runs the same request the send path uses, so a green result means mail will
  // genuinely go out — not just that the form saved something.
  async function runTest() {
    if (!provider) return;
    setTesting(true);
    try {
      const result = await testIntegration(provider.id);
      if (result.status === 'ERROR') {
        toast.error(result.lastError ?? 'Connection test failed');
      } else {
        toast.success('Brevo accepted the key — email delivery is working');
      }
      integrations.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Connection test failed');
    } finally {
      setTesting(false);
    }
  }

  async function confirmToggle() {
    if (!provider || toggleTo === null) return;
    setTogglingSaving(true);
    try {
      await updateIntegration(provider.id, { status: toggleTo ? 'ACTIVE' : 'DISABLED' });
      toast.success(toggleTo ? 'Email sending enabled' : 'Email sending disabled');
      integrations.reload();
      setToggleTo(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setTogglingSaving(false);
    }
  }

  if (settings.loading || integrations.loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Email settings" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email settings"
        description="Everything needed to send transactional email. Templates live under Emails → Templates."
      />

      <Section
        title="Sender identity"
        hint="What recipients see in the From line. The address must be a verified sender or domain in your Brevo account, or Brevo rejects the send."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">From address</span>
            <Input
              value={senderEmail}
              onChange={(event) => setSenderEmail(event.target.value)}
              placeholder="no-reply@fatexia.com"
              className="mt-1"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Sender name</span>
            <Input
              value={senderName}
              onChange={(event) => setSenderName(event.target.value)}
              placeholder="Fatexia"
              className="mt-1"
            />
          </label>
        </div>
        <div className="mt-4 flex justify-end">
          <Button disabled={savingSender} onClick={saveSender}>
            {savingSender ? 'Saving…' : 'Save sender identity'}
          </Button>
        </div>
      </Section>

      <Section
        title="Brevo"
        hint="Delivery runs through Brevo's transactional email API. The API key is the only credential — there is no SMTP host, port or username to configure."
      >
        {!provider ? (
          <p className="text-sm text-muted-foreground">
            No Brevo record found. Run the seed or prod bootstrap to create it.
          </p>
        ) : (
          <>
            <dl className="space-y-2 text-xs">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <StatusPill status={provider.status} />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">API key</dt>
                <dd className="font-mono text-card-foreground">{provider.apiKeyPreview ?? 'Not set'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Last checked</dt>
                <dd className="text-card-foreground">{dateTime(provider.lastCheckedAt)}</dd>
              </div>
            </dl>

            {provider.lastError && <p className="mt-2 text-xs text-destructive">{provider.lastError}</p>}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <Toggle
                checked={provider.status === 'ACTIVE'}
                onCheckedChange={(value) => {
                  if (value && !provider.hasApiKey) {
                    toast.error('Add an API key before enabling email sending');
                    return;
                  }
                  setToggleTo(value);
                }}
                label={provider.status === 'ACTIVE' ? 'Sending enabled' : 'Sending disabled'}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!provider.hasApiKey || testing}
                  title={provider.hasApiKey ? 'Make a live call with the saved key' : 'Add an API key first'}
                  onClick={runTest}
                >
                  {testing ? 'Testing…' : 'Test connection'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setKeyDraft('')}>
                  {provider.hasApiKey ? 'Replace API key' : 'Add API key'}
                </Button>
              </div>
            </div>
          </>
        )}
      </Section>

      <Modal open={keyDraft !== null} onOpenChange={(open) => !open && setKeyDraft(null)} title="Brevo API key">
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Find this in Brevo under SMTP &amp; API → API keys. Saved keys are never sent back to this page — only a
            masked preview is.
          </p>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">API key</span>
            <Input
              type="password"
              autoComplete="off"
              value={keyDraft ?? ''}
              onChange={(event) => setKeyDraft(event.target.value)}
              placeholder="xkeysib-…"
              className="mt-1"
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setKeyDraft(null)}>
              Cancel
            </Button>
            <Button disabled={savingKey || !keyDraft} onClick={saveKey}>
              {savingKey ? 'Saving…' : 'Save API key'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={toggleTo !== null}
        onOpenChange={(open) => !open && setToggleTo(null)}
        title={toggleTo ? 'Enable email sending?' : 'Disable email sending?'}
        description={
          toggleTo
            ? 'Transactional emails start going out again on their triggers.'
            : "Every transactional email stops sending. The events that trigger them still happen — affiliates just won't be emailed, including verification codes at registration."
        }
        confirmLabel={toggleTo ? 'Enable' : 'Disable'}
        destructive={!toggleTo}
        loading={togglingSaving}
        onConfirm={confirmToggle}
      />
    </div>
  );
}
