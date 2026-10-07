import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, ConfirmModal, Input, Modal, PageHeader, Select, Textarea, Toggle, toast } from '@fatexia/ui';
import type { EmailTemplate } from '@fatexia/types';
import {
  createEmailCampaign,
  getAudienceCounts,
  getEmailTemplates,
  previewManualEmail,
  sendManualEmail,
  MAX_MANUAL_RECIPIENTS,
  type AudienceCounts,
  type CampaignAudience,
  type SendEmailResult,
} from '../../lib/platform-api';
import { useAsync } from '../../hooks/useAsync';

// Resolved by the server from network settings, so they are never asked for here.
const AUTO_MACROS = ['network_name', 'support_email'];
// Filled in per person when sending to an audience; there is no single value to ask for.
const RECIPIENT_MACROS = ['first_name', 'full_name', 'email', 'public_id'];
const SAMPLE_RECIPIENT = { first_name: 'Alex', full_name: 'Alex Morgan', email: 'alex@example.com', public_id: 'AFF-1001' };

const AUDIENCES: { value: CampaignAudience; label: string; hint: string }[] = [
  { value: 'AFFILIATES', label: 'All affiliates', hint: 'Every affiliate account' },
  { value: 'ADVERTISERS', label: 'All advertisers', hint: "Each advertiser's contact email" },
  { value: 'MANAGERS', label: 'All managers', hint: 'Every manager login' },
  { value: 'ALL', label: 'Everyone', hint: 'Affiliates, advertisers and managers, each once' },
];

type Mode = 'audience' | 'manual';

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-card-foreground">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

// Accepts the shapes people actually paste — commas, semicolons, newlines or spaces.
function parseRecipients(raw: string): string[] {
  return [...new Set(raw.split(/[\s,;]+/).map((value) => value.trim()).filter(Boolean))];
}

export function SendEmail() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('audience');
  const [audience, setAudience] = useState<CampaignAudience>('AFFILIATES');
  const [activeOnly, setActiveOnly] = useState(true);
  const [typedCount, setTypedCount] = useState('');
  const counts = useAsync<AudienceCounts>(() => getAudienceCounts(activeOnly), [activeOnly]);
  const audienceSize = counts.data?.[audience] ?? 0;
  const audienceLabel = AUDIENCES.find((row) => row.value === audience)?.label.toLowerCase() ?? '';
  const broadcast = mode === 'audience';

  const templates = useAsync<EmailTemplate[]>(() => getEmailTemplates(), []);

  const [templateId, setTemplateId] = useState('');
  const [recipientsRaw, setRecipientsRaw] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [macroValues, setMacroValues] = useState<Record<string, string>>({});

  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendEmailResult | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const recipients = useMemo(() => parseRecipients(recipientsRaw), [recipientsRaw]);
  const invalid = recipients.filter((value) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value));

  // Every macro the composed text references, minus the ones the server fills in.
  // Read from the live subject/body rather than the template's declared list, so a
  // macro typed by hand still gets an input instead of sending blank.
  const macrosNeeded = useMemo(() => {
    const used = [...new Set([...`${subject}\n${body}`.matchAll(/\{([a-z0-9_]+)\}/gi)].map((match) => match[1]!))];
    const auto = broadcast ? [...AUTO_MACROS, ...RECIPIENT_MACROS] : AUTO_MACROS;
    return used.filter((name) => !auto.includes(name));
  }, [subject, body, broadcast]);

  function applyTemplate(id: string) {
    setTemplateId(id);
    setResult(null);
    const template = (templates.data ?? []).find((row) => row.id === id);
    if (!template) return;
    setSubject(template.subject);
    setBody(template.body);
    setMacroValues({});
  }

  function content() {
    return {
      subject,
      body,
      macros: Object.fromEntries(Object.entries(macroValues).filter(([, value]) => value.trim() !== '')),
    };
  }

  async function openPreview() {
    if (!subject.trim() || !body.trim()) return void toast.error('Add a subject and body first');
    setPreviewing(true);
    try {
      // A broadcast preview shows a sample person, so per-recipient macros read naturally.
      const base = content();
      const preview = await previewManualEmail(
        broadcast ? { ...base, macros: { ...SAMPLE_RECIPIENT, ...base.macros } } : base,
      );
      if (preview.unresolved.length > 0) {
        toast.error(`Still empty: ${preview.unresolved.map((name) => `{${name}}`).join(', ')}`);
      }
      setPreviewHtml(preview.html);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not render the preview');
    } finally {
      setPreviewing(false);
    }
  }

  async function send() {
    setSending(true);
    try {
      const outcome = await sendManualEmail({ ...content(), recipients });
      setResult(outcome);
      setConfirming(false);
      if (outcome.failed.length === 0) {
        toast.success(`Sent to ${outcome.sent.length} recipient${outcome.sent.length === 1 ? '' : 's'}`);
      } else {
        toast.error(`${outcome.failed.length} of ${recipients.length} could not be sent`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  }

  async function sendBroadcast() {
    setSending(true);
    try {
      await createEmailCampaign({ ...content(), audience, activeOnly, expectedRecipients: audienceSize });
      toast.success('Sending started — follow progress in Campaigns');
      navigate('/emails/campaigns');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start the send');
      counts.reload();
    } finally {
      setSending(false);
    }
  }

  function validateThenConfirm() {
    if (broadcast) {
      if (audienceSize === 0) return void toast.error('That audience has no one to send to');
      if (!subject.trim()) return void toast.error('Add a subject');
      if (!body.trim()) return void toast.error('Add a message body');
      setTypedCount('');
      return void setConfirming(true);
    }
    if (recipients.length === 0) return void toast.error('Add at least one recipient');
    if (invalid.length > 0) return void toast.error(`Not a valid address: ${invalid[0]}`);
    if (recipients.length > MAX_MANUAL_RECIPIENTS) {
      return void toast.error(`A manual send is limited to ${MAX_MANUAL_RECIPIENTS} recipients`);
    }
    if (!subject.trim()) return void toast.error('Add a subject');
    if (!body.trim()) return void toast.error('Add a message body');
    setConfirming(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Send email"
        description="Compose and send from the network's own address — also the quickest way to confirm delivery is working end to end."
      />

      <Section
        title="Template"
        hint="Optional. Loads an existing template's subject and body into the fields below, where you can still edit them. Sending from here never changes the saved template."
      >
        <Select value={templateId} onChange={(event) => applyTemplate(event.target.value)} className="w-full sm:w-96">
          <option value="">Start from a blank message</option>
          {(templates.data ?? []).map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </Select>
      </Section>

      <div className="inline-flex rounded-md border border-border bg-card p-1 text-sm">
        {(
          [
            ['audience', 'Send to an audience'],
            ['manual', 'Specific addresses'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            className={`rounded px-3 py-1.5 font-medium transition-colors ${
              mode === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {broadcast && (
        <Section
          title="Audience"
          hint="Everyone in the group gets their own copy and cannot see the others. The list is fixed the moment you send."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {AUDIENCES.map((row) => (
              <label
                key={row.value}
                className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${
                  audience === row.value ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <input
                  type="radio"
                  name="audience"
                  checked={audience === row.value}
                  onChange={() => setAudience(row.value)}
                  className="mt-1"
                />
                <span className="flex-1">
                  <span className="block text-sm font-medium text-card-foreground">{row.label}</span>
                  <span className="block text-xs text-muted-foreground">{row.hint}</span>
                </span>
                <span className="text-sm font-semibold text-card-foreground">
                  {counts.data ? counts.data[row.value].toLocaleString() : '—'}
                </span>
              </label>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Toggle checked={activeOnly} onCheckedChange={setActiveOnly} label="Active accounts only" />
            <p className="text-xs text-muted-foreground">
              {activeOnly
                ? 'Pending, inactive, blocked and rejected accounts are skipped.'
                : 'Pending and inactive accounts are included. Blocked and rejected accounts are never emailed.'}
            </p>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Personalise with <span className="font-mono">{'{first_name}'}</span>,{' '}
            <span className="font-mono">{'{full_name}'}</span>, <span className="font-mono">{'{email}'}</span> and{' '}
            <span className="font-mono">{'{public_id}'}</span> — filled in for each person.
          </p>
        </Section>
      )}

      {!broadcast && (
      <Section
        title="Recipients"
        hint={`One or more email addresses, separated by commas, spaces or new lines. Each person is sent their own copy and cannot see the others. Limit ${MAX_MANUAL_RECIPIENTS}.`}
      >
        <Textarea
          rows={3}
          value={recipientsRaw}
          onChange={(event) => setRecipientsRaw(event.target.value)}
          placeholder="you@example.com, someone@example.com"
          className="font-mono text-xs"
        />
        <div className="mt-2 flex flex-wrap items-center gap-x-3 text-xs">
          <span className={recipients.length > MAX_MANUAL_RECIPIENTS ? 'text-destructive' : 'text-muted-foreground'}>
            {recipients.length} recipient{recipients.length === 1 ? '' : 's'}
          </span>
          {invalid.length > 0 && <span className="text-destructive">Invalid: {invalid.join(', ')}</span>}
        </div>
      </Section>
      )}

      <Section title="Message">
        <div className="space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Subject</span>
            <Input value={subject} onChange={(event) => setSubject(event.target.value)} className="mt-1" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Body</span>
            <Textarea
              rows={12}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Blank lines become paragraphs. A line with just a URL becomes a button; [Label](https://…) names it. Lines starting with - become bullets, **text** is bold."
              className="mt-1 font-mono text-xs"
            />
          </label>
        </div>
      </Section>

      {macrosNeeded.length > 0 && (
        <Section
          title="Macro values"
          hint="Your text uses these placeholders. The value you enter is used for every recipient of this send, so keep it general when sending to more than one person."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {macrosNeeded.map((macro) => (
              <label key={macro} className="block">
                <span className="font-mono text-xs font-medium text-muted-foreground">{`{${macro}}`}</span>
                <Input
                  value={macroValues[macro] ?? ''}
                  onChange={(event) => setMacroValues({ ...macroValues, [macro]: event.target.value })}
                  className="mt-1"
                />
              </label>
            ))}
          </div>
        </Section>
      )}

      {!broadcast && result && (
        <Section title="Result">
          <div className="space-y-2 text-sm">
            {result.sent.length > 0 && (
              <p className="text-success">
                Sent to {result.sent.length}: <span className="text-card-foreground">{result.sent.join(', ')}</span>
              </p>
            )}
            {result.failed.map((failure) => (
              <p key={failure.email} className="text-destructive">
                {failure.email} — {failure.error}
              </p>
            ))}
          </div>
        </Section>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" disabled={previewing} onClick={openPreview}>
          {previewing ? 'Rendering…' : 'Preview'}
        </Button>
        <Button disabled={sending} onClick={validateThenConfirm}>
          {sending ? 'Sending…' : broadcast ? `Send to ${audienceSize.toLocaleString()}` : 'Send email'}
        </Button>
      </div>

      <Modal
        open={previewHtml !== null}
        onOpenChange={(open) => !open && setPreviewHtml(null)}
        title="Preview"
        className="max-w-3xl"
      >
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Rendered by the server through the same layout the real send uses — macros already substituted.
          </p>
          {/* srcDoc + sandbox: the email's own styles stay inside the frame instead of
              leaking into the admin app, and nothing in it can script this page. */}
          <iframe
            title="Email preview"
            srcDoc={previewHtml ?? ''}
            sandbox=""
            className="h-[60vh] w-full rounded-md border border-border bg-white"
          />
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setPreviewHtml(null)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={confirming && broadcast}
        onOpenChange={(open) => !open && setConfirming(false)}
        title={`Send to ${audienceSize.toLocaleString()} recipients?`}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            "{subject}" will go to <strong className="text-card-foreground">{audienceSize.toLocaleString()}</strong>{' '}
            {audienceLabel}
            {activeOnly ? ' (active accounts)' : ''} from your network's sending address. This is real email and cannot be
            recalled; you can cancel while it is still sending.
          </p>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">
              Type <span className="font-mono text-card-foreground">{audienceSize}</span> to confirm
            </span>
            <Input value={typedCount} onChange={(event) => setTypedCount(event.target.value)} className="mt-1" autoFocus />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button disabled={sending || typedCount.trim() !== String(audienceSize)} onClick={sendBroadcast}>
              {sending ? 'Starting…' : 'Send now'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={confirming && !broadcast}
        onOpenChange={(open) => !open && setConfirming(false)}
        title={`Send to ${recipients.length} recipient${recipients.length === 1 ? '' : 's'}?`}
        description={`"${subject}" goes out from your network's sending address now. Real email — this can't be recalled.`}
        confirmLabel="Send now"
        loading={sending}
        onConfirm={send}
      />
    </div>
  );
}
