import { useState } from 'react';
import { Button, ConfirmModal, Input, Modal, PageHeader, Skeleton, Toggle, toast } from '@fatexia/ui';
import type { Integration } from '@fatexia/types';
import { getIntegrations, testIntegration, updateIntegration } from '../../lib/platform-api';
import { useAsync } from '../../hooks/useAsync';
import { dateTime } from '../../lib/format';
import { StatusPill } from '../../components/StatusPill';

interface EditState {
  integration: Integration;
  apiKey: string;
  apiSecret: string;
  config: Record<string, string>;
}

// Providers whose non-secret `config` fields are actually editable here — every other
// provider's config is display-only context (quota, mode) set by the seed, not
// something an admin fills in per-key.
const CONFIG_FIELDS: Partial<Record<Integration['provider'], { key: string; label: string; placeholder?: string }[]>> = {
  S3: [
    { key: 'bucket', label: 'Bucket name', placeholder: 'my-offer-thumbnails' },
    { key: 'region', label: 'Region', placeholder: 'us-east-1' },
    { key: 'cdnBaseUrl', label: 'CDN base URL', placeholder: 'https://xxxxxxxxxxxxxx.cloudfront.net' },
  ],
};

interface ToggleDecision {
  integration: Integration;
  enabled: boolean;
}

/**
 * The one place third-party credentials are entered (PLAN-admin.md: "all credentials
 * handled by admin"). Managers cannot reach this page at all.
 *
 * Secrets are never returned by the API — each field shows a masked preview and an
 * empty input means "leave it unchanged", so saving an unrelated setting can't wipe a
 * working key.
 */
// Providers the backend can actually exercise — the Test button is only offered
// where pressing it does something (see TESTABLE in integration.service.ts).
const TESTABLE_PROVIDERS = ['IPHUB', 'IPAPI_IS', 'IPQS'];

// Providers with a row here but no consumer code anywhere yet. Saving a key against
// one of these stores it correctly and then nothing reads it — labelling that is more
// honest than a page implying a working payout integration.
const UNUSED_PROVIDERS = ['PAYPAL', 'WISE', 'MAXMIND'];

// Brevo's credential is the same `integrations` row as every other provider, but it
// is configured under Emails → Settings alongside the sender identity, so email setup
// is one page instead of two menus. Hidden here to keep a single place to edit it.
// S3 is configured through the backend's S3_* env vars, not this page — a card that
// accepted a bucket name nothing reads is worse than no card at all.
const HIDDEN_PROVIDERS = ['SMTP', 'S3'];

export function Integrations() {
  const integrations = useAsync<Integration[]>(() => getIntegrations(), []);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [toggleDecision, setToggleDecision] = useState<ToggleDecision | null>(null);
  const [toggleSaving, setToggleSaving] = useState(false);

  // A failed test resolves rather than throwing — the error lands on the row, which
  // is more useful than a toast the admin has to remember while they fix the key.
  async function runTest(integration: Integration) {
    setTestingId(integration.id);
    try {
      const result = await testIntegration(integration.id);
      if (result.status === 'ERROR') {
        toast.error(result.lastError ?? `${integration.name} test failed`);
      } else {
        toast.success(`${integration.name} responded — the key works`);
      }
      integrations.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Connection test failed');
    } finally {
      setTestingId(null);
    }
  }

  async function save() {
    if (!edit) return;
    setSaving(true);
    try {
      const configFields = CONFIG_FIELDS[edit.integration.provider];
      await updateIntegration(edit.integration.id, {
        apiKey: edit.apiKey || undefined,
        apiSecret: edit.apiSecret || undefined,
        ...(configFields && { config: edit.config }),
      });
      toast.success(`${edit.integration.name} updated`);
      setEdit(null);
      integrations.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save integration');
    } finally {
      setSaving(false);
    }
  }

  function toggleEnabled(integration: Integration, enabled: boolean) {
    if (enabled && !integration.hasApiKey) {
      toast.error('Add an API key before enabling this provider');
      return;
    }
    setToggleDecision({ integration, enabled });
  }

  async function confirmToggle() {
    if (!toggleDecision) return;
    const { integration, enabled } = toggleDecision;
    setToggleSaving(true);
    try {
      await updateIntegration(integration.id, { status: enabled ? 'ACTIVE' : 'DISABLED' });
      toast.success(enabled ? `${integration.name} enabled` : `${integration.name} disabled`);
      integrations.reload();
      setToggleDecision(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update integration');
    } finally {
      setToggleSaving(false);
    }
  }

  if (integrations.loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Integrations" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        description="Every third-party credential in the system is configured here and nowhere else. Managers cannot see this page."
      />

      {integrations.error && <p className="text-sm text-destructive">{integrations.error}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {(integrations.data ?? []).filter((integration) => !HIDDEN_PROVIDERS.includes(integration.provider)).map((integration) => (
          <div key={integration.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold text-card-foreground">{integration.name}</h2>
                  {UNUSED_PROVIDERS.includes(integration.provider) && (
                    <span
                      title="Credentials are stored, but no feature reads them yet."
                      className="rounded-full border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground"
                    >
                      Not yet used
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{integration.description}</p>
              </div>
              <StatusPill status={integration.status} />
            </div>

            <dl className="mt-4 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">API key</dt>
                <dd className="font-mono text-card-foreground">{integration.apiKeyPreview ?? 'Not set'}</dd>
              </div>
              {integration.hasApiSecret && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">API secret</dt>
                  <dd className="font-mono text-card-foreground">{integration.apiSecretPreview}</dd>
                </div>
              )}
              {Object.entries(integration.config).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{key}</dt>
                  <dd className="truncate text-card-foreground">{String(value) || '—'}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Last checked</dt>
                <dd className="text-card-foreground">{dateTime(integration.lastCheckedAt)}</dd>
              </div>
            </dl>

            {integration.lastError && <p className="mt-2 text-xs text-destructive">{integration.lastError}</p>}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <Toggle
                checked={integration.status === 'ACTIVE'}
                onCheckedChange={(value) => toggleEnabled(integration, value)}
                label={integration.status === 'ACTIVE' ? 'Enabled' : 'Disabled'}
              />
              <div className="flex gap-2">
                {TESTABLE_PROVIDERS.includes(integration.provider) && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!integration.hasApiKey || testingId === integration.id}
                    title={integration.hasApiKey ? 'Make a live call with the saved key' : 'Add an API key first'}
                    onClick={() => runTest(integration)}
                  >
                    {testingId === integration.id ? 'Testing…' : 'Test connection'}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setEdit({
                      integration,
                      apiKey: '',
                      apiSecret: '',
                      config: Object.fromEntries(
                        (CONFIG_FIELDS[integration.provider] ?? []).map((field) => [field.key, String(integration.config[field.key] ?? '')]),
                      ),
                    })
                  }
                >
                  {integration.hasApiKey ? 'Replace credentials' : 'Add credentials'}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal open={!!edit} onOpenChange={(open) => !open && setEdit(null)} title={edit ? `${edit.integration.name} credentials` : ''}>
        {edit && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Leave a field blank to keep the stored value. Saved secrets are never sent back to this page — only a
              masked preview is.
            </p>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">
                API key {edit.integration.hasApiKey && `(currently ${edit.integration.apiKeyPreview})`}
              </span>
              <Input
                type="password"
                autoComplete="off"
                value={edit.apiKey}
                onChange={(event) => setEdit({ ...edit, apiKey: event.target.value })}
                placeholder="Paste a new key to replace"
                className="mt-1"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">
                API secret {edit.integration.hasApiSecret && `(currently ${edit.integration.apiSecretPreview})`}
              </span>
              <Input
                type="password"
                autoComplete="off"
                value={edit.apiSecret}
                onChange={(event) => setEdit({ ...edit, apiSecret: event.target.value })}
                placeholder="Optional"
                className="mt-1"
              />
            </label>
            {(CONFIG_FIELDS[edit.integration.provider] ?? []).map((field) => (
              <label key={field.key} className="block">
                <span className="text-xs font-medium text-muted-foreground">{field.label}</span>
                <Input
                  value={edit.config[field.key] ?? ''}
                  onChange={(event) => setEdit({ ...edit, config: { ...edit.config, [field.key]: event.target.value } })}
                  placeholder={field.placeholder}
                  className="mt-1"
                />
              </label>
            ))}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEdit(null)}>
                Cancel
              </Button>
              <Button disabled={saving} onClick={save}>
                {saving ? 'Saving…' : 'Save credentials'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={!!toggleDecision}
        onOpenChange={(open) => !open && setToggleDecision(null)}
        title={toggleDecision?.enabled ? `Enable ${toggleDecision.integration.name}?` : `Disable ${toggleDecision?.integration.name}?`}
        description={
          toggleDecision?.enabled
            ? `The saved key starts being used on the next request.`
            : `The saved key stops being used immediately, even though it stays stored.`
        }
        confirmLabel={toggleDecision?.enabled ? 'Enable' : 'Disable'}
        destructive={!toggleDecision?.enabled}
        loading={toggleSaving}
        onConfirm={confirmToggle}
      />
    </div>
  );
}
