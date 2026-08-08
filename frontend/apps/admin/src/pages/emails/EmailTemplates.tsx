import { useState } from 'react';
import { Button, ConfirmModal, Input, PageHeader, Skeleton, Textarea, Toggle, toast } from '@fatexia/ui';
import type { EmailTemplate } from '@fatexia/types';
import { getEmailTemplates, updateEmailTemplate } from '../../lib/platform-api';
import { useAsync } from '../../hooks/useAsync';
import { dateTime } from '../../lib/format';

interface Draft {
  subject: string;
  body: string;
}

export function EmailTemplates() {
  const templates = useAsync<EmailTemplate[]>(() => getEmailTemplates(), []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [toggleTarget, setToggleTarget] = useState<{ template: EmailTemplate; enabled: boolean } | null>(null);
  const [toggleSaving, setToggleSaving] = useState(false);

  const rows = templates.data ?? [];
  const selected = rows.find((template) => template.id === selectedId) ?? rows[0] ?? null;
  const current = draft ?? (selected ? { subject: selected.subject, body: selected.body } : null);

  function select(template: EmailTemplate) {
    setSelectedId(template.id);
    setDraft(null);
  }

  async function save() {
    if (!selected || !current) return;
    setSaving(true);
    try {
      await updateEmailTemplate(selected.id, { subject: current.subject, body: current.body });
      toast.success(`${selected.name} saved`);
      setDraft(null);
      templates.reload();
    } catch (err) {
      // The server rejects a body that uses a macro the template doesn't declare —
      // surfacing that message verbatim is more useful than a generic failure.
      toast.error(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setSaving(false);
    }
  }

  function toggleEnabled(template: EmailTemplate, enabled: boolean) {
    setToggleTarget({ template, enabled });
  }

  async function confirmToggle() {
    if (!toggleTarget) return;
    const { template, enabled } = toggleTarget;
    setToggleSaving(true);
    try {
      await updateEmailTemplate(template.id, { enabled });
      toast.success(enabled ? `${template.name} enabled` : `${template.name} disabled`);
      templates.reload();
      setToggleTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update template');
    } finally {
      setToggleSaving(false);
    }
  }

  if (templates.loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Email templates" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email templates"
        description="Copy for every transactional email the network sends. Each template's trigger is fixed — only the wording is editable."
      />

      {templates.error && <p className="text-sm text-destructive">{templates.error}</p>}

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="space-y-1 rounded-lg border border-border bg-card p-2">
          {rows.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => select(template)}
              className={`w-full rounded-md px-3 py-2 text-left transition-colors ${
                selected?.id === template.id ? 'bg-accent' : 'hover:bg-accent/50'
              }`}
            >
              <p className="text-sm text-card-foreground">{template.name}</p>
              <p className="text-xs text-muted-foreground">
                {template.enabled ? 'Enabled' : 'Disabled'} · updated {dateTime(template.updatedAt)}
              </p>
            </button>
          ))}
        </div>

        {selected && current && (
          <div className="space-y-4 rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-card-foreground">{selected.name}</h2>
                <p className="text-xs text-muted-foreground">Trigger key: {selected.templateKey}</p>
              </div>
              <Toggle
                checked={selected.enabled}
                onCheckedChange={(value) => toggleEnabled(selected, value)}
                label={selected.enabled ? 'Enabled' : 'Disabled'}
              />
            </div>

            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Subject</span>
              <Input value={current.subject} onChange={(event) => setDraft({ ...current, subject: event.target.value })} className="mt-1" />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Body</span>
              <Textarea rows={14} value={current.body} onChange={(event) => setDraft({ ...current, body: event.target.value })} className="mt-1 font-mono text-xs" />
            </label>

            <div>
              <p className="text-xs font-medium text-muted-foreground">Available macros</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {selected.availableMacros.map((macro) => (
                  <button
                    key={macro}
                    type="button"
                    onClick={() => setDraft({ ...current, body: `${current.body}${macro}` })}
                    className="rounded-full border border-border px-2 py-0.5 font-mono text-xs text-muted-foreground hover:border-primary hover:text-foreground"
                  >
                    {macro}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Only these macros are accepted — anything else is rejected on save, so an unknown token can never reach a
                real customer's inbox.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" disabled={!draft} onClick={() => setDraft(null)}>
                Discard changes
              </Button>
              <Button disabled={saving || !draft} onClick={save}>
                {saving ? 'Saving…' : 'Save template'}
              </Button>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!toggleTarget}
        onOpenChange={(open) => !open && setToggleTarget(null)}
        title={toggleTarget?.enabled ? `Enable ${toggleTarget.template.name}?` : `Disable ${toggleTarget?.template.name}?`}
        description={
          toggleTarget?.enabled
            ? 'This transactional email starts sending again on its trigger.'
            : "This transactional email stops sending on its trigger — the event that would have sent it still happens, the email just won't."
        }
        confirmLabel={toggleTarget?.enabled ? 'Enable' : 'Disable'}
        destructive={!toggleTarget?.enabled}
        loading={toggleSaving}
        onConfirm={confirmToggle}
      />
    </div>
  );
}
