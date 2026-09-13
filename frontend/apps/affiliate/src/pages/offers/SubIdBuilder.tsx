import { useState } from 'react';
import { Copy, Plus, X } from 'lucide-react';
import { Button, ExternalLinkButton, Input, toast } from '@fatexia/ui';

/**
 * The sub-ids the tracker actually stores.
 *
 * Eight, matching click.entity.ts's subId1–subId8 and the sub1–sub8 query params
 * click.dto.ts parses. Anything else on the link is ignored by the tracker and would
 * only mislead the affiliate into thinking it was being recorded, so the builder offers
 * exactly these.
 */
const SUB_IDS = ['sub1', 'sub2', 'sub3', 'sub4', 'sub5', 'sub6', 'sub7', 'sub8'] as const;

/**
 * What each one is conventionally used for. Sub-ids are free text and the network does
 * not enforce any meaning, but an empty row of eight identical boxes tells an affiliate
 * nothing about where to start.
 */
const HINTS: Record<string, string> = {
  sub1: 'Traffic source',
  sub2: 'Campaign',
  sub3: 'Ad set / placement',
  sub4: 'Creative',
  sub5: 'Keyword',
  sub6: 'Placement id',
  sub7: 'Free',
  sub8: 'Free',
};

/**
 * Builds a tracking link with sub-ids, in place on the offer.
 *
 * Chips rather than eight permanent inputs: almost nobody uses all eight, and a wall of
 * empty boxes buries the link itself. Adding a chip opens one labelled field, and the
 * link rewrites as it is typed, so what gets copied is always what is on screen.
 *
 * A param is written only once it has a value. An empty `sub1=` is stored by the tracker
 * as a real, blank value and then shows up as its own row in every sub-id report — so an
 * added-but-unfilled chip stays out of the URL rather than quietly polluting the
 * affiliate's own reporting.
 */
export function SubIdBuilder({ baseLink }: { baseLink: string }) {
  const [values, setValues] = useState<Record<string, string>>({});

  const active = SUB_IDS.filter((key) => key in values);
  const link = (() => {
    const url = new URL(baseLink);
    for (const key of active) {
      const value = values[key]!.trim();
      if (value) url.searchParams.set(key, value);
    }
    return url.toString();
  })();

  const pending = active.filter((key) => !values[key]!.trim());

  function add(key: string) {
    setValues((current) => ({ ...current, [key]: '' }));
  }

  function remove(key: string) {
    setValues((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function copy() {
    void navigator.clipboard.writeText(link);
    toast.success('Tracking link copied');
  }

  return (
    <div className="space-y-4">
      {/* The link and the button that copies it sit in one bordered block, tinted with
          the accent, so the thing most visits came for reads as a single control rather
          than a paragraph with a button under it. */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
        <p className="break-all font-mono text-xs leading-relaxed text-card-foreground">{link}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={copy}>
            <Copy className="mr-1.5 size-3.5" />
            Copy link
          </Button>
          <ExternalLinkButton href={link} label="Open tracking link in new tab" />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Add tracking parameters</p>
        <div className="flex flex-wrap gap-1.5">
          {SUB_IDS.map((key) => {
            const added = key in values;
            return (
              <button
                key={key}
                type="button"
                onClick={() => (added ? remove(key) : add(key))}
                className={
                  added
                    ? 'inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground'
                    : 'inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:bg-primary/10 hover:text-primary'
                }
              >
                {added ? <X className="size-3" /> : <Plus className="size-3" />}
                {key}
              </button>
            );
          })}
        </div>
      </div>

      {active.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {active.map((key) => (
            <label key={key} className="block">
              <span className="text-xs font-medium text-muted-foreground">
                {key} <span className="font-normal">· {HINTS[key]}</span>
              </span>
              <Input
                value={values[key]}
                onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
                placeholder={HINTS[key]}
                className="mt-1"
              />
            </label>
          ))}
        </div>
      )}

      {pending.length > 0 && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-500">
          {pending.join(', ')} {pending.length === 1 ? 'is' : 'are'} not on the link yet — an empty sub-id would be recorded as a
          blank value and become its own row in your reports. Fill it in or remove it.
        </p>
      )}
    </div>
  );
}
