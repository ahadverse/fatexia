import { useEffect, useState } from 'react';
import { Button, ConfirmModal, Input, PageHeader, Skeleton, Tabs, Textarea, toast } from '@fatexia/ui';
import type { Affiliate } from '@fatexia/types';
import { getOwnProfile, updateOwnProfile } from '../../lib/portal-api';
import { useAsync } from '../../hooks/useAsync';

const MACROS: { token: string; paramKey: string; meaning: string }[] = [
  { token: '{click_id}', paramKey: 'click_id', meaning: 'The click that produced the conversion — match this to your own click id.' },
  { token: '{payout}', paramKey: 'payout', meaning: 'What you earned, as a decimal number.' },
  { token: '{currency}', paramKey: 'currency', meaning: 'Currency of the payout, e.g. USD.' },
  { token: '{status}', paramKey: 'status', meaning: 'Conversion status at the time we fired the postback.' },
  { token: '{offer_id}', paramKey: 'offer_id', meaning: 'The offer the conversion belongs to.' },
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
    token: `{sub${n}}`,
    paramKey: `sub${n}`,
    meaning: `The sub ID (sub${n}) you passed on the click — handy for tying a conversion back to your own source or campaign.`,
  })),
];

/**
 * Two ways to end up with a postback URL.
 *
 * `builder` is the checkbox flow: a base URL plus our own parameter names, so a saved
 * URL can never carry a mistyped token. It only ever produces `base?click_id=…`, which
 * is wrong for an endpoint that needs parameters of its own — a Telegram bot's
 * `sendMessage` wants `chat_id` and `text`, and neither is something this page can
 * offer as a checkbox. `custom` takes the whole URL verbatim for exactly that case.
 */
type Mode = 'builder' | 'custom';

const MODES: { key: Mode; label: string }[] = [
  { key: 'builder', label: 'Build it for me' },
  { key: 'custom', label: 'Paste a full URL' },
];

// `affiliates.postbackUrl` is varchar(500). Checking it here means a too-long URL is
// caught in the field rather than coming back as a validation error from the API.
const MAX_LENGTH = 500;

// A starting point for the common case. The two placeholders are the affiliate's own
// to fill in; the braces are our macros and get substituted when we fire.
const TELEGRAM_TEMPLATE =
  'https://api.telegram.org/bot<BOT_TOKEN>/sendMessage?chat_id=<CHAT_ID>&text=Conversion approved: {payout} {currency} (click {click_id})';

/**
 * Splits a saved URL into the fields of whichever mode can actually represent it.
 *
 * A URL belongs to the builder only when everything after the `?` is exactly our own
 * macro pairs. Anything else — a Telegram bot's `chat_id`/`text`, a tracker's own
 * parameters — reopens in `custom` mode whole, because the builder would otherwise
 * show only the part before the `?` and quietly drop the rest on the next save.
 */
function parseExisting(url: string): { mode: Mode; baseUrl: string; checked: Set<string>; customUrl: string } {
  const trimmed = url.trim();
  const [base = '', ...rest] = trimmed.split('?');
  const checked = new Set<string>();
  // More than one `?` is never something buildUrl produced.
  let builderCanRebuild = rest.length <= 1;

  for (const pair of (rest[0] ?? '').split('&').filter(Boolean)) {
    const [key, val] = pair.split('=');
    const macro = MACROS.find((m) => m.paramKey === key && val === m.token);
    if (macro) checked.add(macro.token);
    else builderCanRebuild = false;
  }

  if (builderCanRebuild) return { mode: 'builder', baseUrl: base, checked, customUrl: trimmed };
  // Base still carried across so switching to the builder starts from the same host
  // rather than an empty field.
  return { mode: 'custom', baseUrl: base, checked: new Set(), customUrl: trimmed };
}

function buildUrl(baseUrl: string, checked: Set<string>): string {
  const params = MACROS.filter((m) => checked.has(m.token))
    .map((m) => `${m.paramKey}=${m.token}`)
    .join('&');
  return params ? `${baseUrl}?${params}` : baseUrl;
}

/**
 * Why a pasted URL cannot be saved, or null when it can.
 *
 * `new URL` is used as a yes/no check only — never to normalise. Its `href` percent-
 * encodes the braces, and `%7Bpayout%7D` is not a token we substitute, so the
 * affiliate's tracker would receive the literal text instead of their payout.
 */
function customUrlError(value: string): string | null {
  if (!value) return null;
  if (value.length > MAX_LENGTH) return `Too long — ${value.length} characters, the limit is ${MAX_LENGTH}.`;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return "That isn't a URL we can call — it needs a full address, starting with https://";
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return 'Only http:// and https:// URLs can be called.';
  return null;
}

// Self-service postback URL. Changes go through PATCH /affiliates/me, which cannot
// touch manager assignment or account status. In builder mode macros are
// checkbox-driven (issue #11) rather than typed, so a saved URL can never carry a
// mistyped token; the paste-a-full-URL mode exists for endpoints that need parameters
// of their own, such as a Telegram bot.
export function PostbackSetup() {
  const profile = useAsync<Affiliate>(() => getOwnProfile(), []);
  const [mode, setMode] = useState<Mode>('builder');
  const [baseUrl, setBaseUrl] = useState('');
  const [checkedMacros, setCheckedMacros] = useState<Set<string>>(new Set());
  const [customUrl, setCustomUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);

  useEffect(() => {
    if (!profile.data) return;
    const existing = parseExisting(profile.data.postbackUrl ?? '');
    setMode(existing.mode);
    setBaseUrl(existing.baseUrl);
    setCheckedMacros(existing.checked);
    setCustomUrl(existing.customUrl);
  }, [profile.data]);

  const trimmedCustom = customUrl.trim();
  const customError = customUrlError(trimmedCustom);
  const postbackUrl = mode === 'custom' ? trimmedCustom : buildUrl(baseUrl.trim(), checkedMacros);
  const canSave = mode === 'custom' ? Boolean(trimmedCustom) && !customError : Boolean(baseUrl.trim());

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
        <Tabs items={MODES} active={mode} onChange={(key) => setMode(key as Mode)} className="-mt-1 mb-4" />

        {mode === 'builder' ? (
          <>
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
          </>
        ) : (
          <>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Full postback URL, query parameters and all</span>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Saved exactly as you write it. Use this when your endpoint needs parameters of its own — a Telegram bot, for
                instance, needs <span className="font-mono">chat_id</span> and <span className="font-mono">text</span>.
              </p>
              <Textarea
                value={customUrl}
                onChange={(event) => setCustomUrl(event.target.value)}
                rows={4}
                spellCheck={false}
                placeholder={TELEGRAM_TEMPLATE}
                className="mt-2 break-all font-mono text-xs"
              />
            </label>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className={`text-xs ${customError ? 'text-destructive' : 'text-muted-foreground'}`}>
                {customError ?? `${trimmedCustom.length} / ${MAX_LENGTH} characters`}
              </span>
              <Button
                variant="ghost"
                size="sm"
                // Only when there is nothing to lose: this would otherwise replace a URL
                // the affiliate had already typed out.
                disabled={Boolean(trimmedCustom)}
                onClick={() => setCustomUrl(TELEGRAM_TEMPLATE)}
              >
                Use the Telegram example
              </Button>
            </div>

            <div className="mt-4">
              <span className="text-xs font-medium text-muted-foreground">Macros you can drop anywhere in the URL</span>
              <p className="mt-0.5 text-xs text-muted-foreground">
                We replace each one before calling, so they work inside a message as readily as in a query parameter.
              </p>
              <div className="mt-2 space-y-2">
                {MACROS.map((macro) => (
                  <p key={macro.token} className="px-2 text-sm">
                    <span className="font-mono text-xs text-card-foreground">{macro.token}</span>
                    <span className="text-muted-foreground"> — {macro.meaning}</span>
                  </p>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="mt-4 rounded-md bg-secondary p-3">
          <span className="text-xs font-medium text-muted-foreground">Preview</span>
          <p className="mt-1 break-all font-mono text-xs text-card-foreground">{postbackUrl || '—'}</p>
        </div>

        <div className="mt-4 flex justify-end">
          <Button disabled={saving || !canSave} onClick={() => setConfirmSave(true)}>
            {saving ? 'Saving…' : 'Save postback URL'}
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-card-foreground">How delivery works</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>• We fire the postback when a conversion reaches approved status, not the moment it arrives.</li>
          <li>• It goes out as a plain GET request, which is what a Telegram bot's sendMessage endpoint expects too.</li>
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
