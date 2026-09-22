import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Input, PageHeader, Select, Skeleton, toast } from '@fatexia/ui';
import type { Offer, SmartLink, SmartLinkRotation } from '@fatexia/types';
import { createSmartLink, getSmartLinks, updateSmartLink } from '../../lib/platform-api';
import { getOffers } from '../../lib/offers-api';
import { useAsync } from '../../hooks/useAsync';
import { RichTextEditor } from '../../components/RichTextEditor';

const ROTATIONS: { value: SmartLinkRotation; label: string; hint: string }[] = [
  { value: 'TOP_PAYOUT', label: 'Highest payout', hint: 'Always sends to the best-paying eligible offer.' },
  { value: 'ROUND_ROBIN', label: 'Round robin', hint: 'Splits traffic evenly across members.' },
  { value: 'BEST_CR', label: 'Best converting', hint: 'Weights toward members with the strongest recent CR.' },
];


interface FormState {
  name: string;
  slug: string;
  description: string;
  offerIds: string[];
  countries: string;
  devices: string;
  rotation: SmartLinkRotation;
  fallbackUrl: string;
  destinationUrl: string;
  revSharePercent: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  slug: '',
  description: '',
  offerIds: [],
  countries: '',
  devices: '',
  rotation: 'TOP_PAYOUT',
  fallbackUrl: '',
  destinationUrl: '',
  revSharePercent: '',
};

// Slugs are URL-path material, so the form derives one rather than letting a name with
// spaces or punctuation through to a server-side rejection.
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

/**
 * Create/edit a smart-link on its own page rather than in a modal.
 *
 * The form outgrew a dialog: member-offer picking is a scrolling list, and the revenue
 * share needs its own explained section. A modal put both inside a box that scrolled
 * independently of the page behind it.
 */
export function SmartLinkForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // The list endpoint is the only way to read one link — there is no GET /:id — so the
  // edit view filters the collection it already knows how to fetch.
  const links = useAsync<SmartLink[]>(() => getSmartLinks(), []);
  const offers = useAsync<Offer[]>(() => getOffers(), []);

  // Only APPROVED offers can be members — the server rejects anything else, since a
  // paused or pending member would resolve to a dead redirect at click time.
  const approvedOffers = (offers.data ?? []).filter((offer) => offer.status === 'APPROVED');

  const existing = isEdit ? links.data?.find((link) => link.id === id) : undefined;

  useEffect(() => {
    if (!existing) return;
    setForm({
      name: existing.name,
      slug: existing.slug,
      description: existing.description ?? '',
      offerIds: existing.offerIds,
      countries: existing.countries.join(', '),
      devices: existing.devices.join(', '),
      rotation: existing.rotation,
      fallbackUrl: existing.fallbackUrl ?? '',
      destinationUrl: existing.destinationUrl ?? '',
      revSharePercent: existing.revSharePercent != null ? String(existing.revSharePercent) : '',
    });
  }, [existing]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    if (!form.name.trim()) {
      toast.error('Give the smart-link a name');
      return;
    }
    // Member offers are optional: a link with none is a plain redirect. What it cannot
    // be is a link with neither members nor a destination, because that has nowhere to
    // send a visitor and throws on every click. Mirrors the backend's own check so the
    // admin is told before the request rather than by a 400.
    if (form.offerIds.length === 0 && !form.destinationUrl.trim()) {
      toast.error('Pick a member offer, or set a destination URL for the link to send traffic to');
      return;
    }
    // Said out loud rather than silently dropped. Sending null here would save cleanly
    // and quietly discard a rate the operator had typed — the exact failure this whole
    // section exists to avoid. The rate is a percentage of the sale a member offer
    // earns, so without members there is nothing for it to apply to.
    if (form.revSharePercent && form.offerIds.length === 0) {
      toast.error('A revenue share needs at least one member offer — pick one, or clear the percentage');
      return;
    }

    const payload = {
      name: form.name,
      slug: form.slug,
      description: form.description || undefined,
      offerIds: form.offerIds,
      countries: splitList(form.countries),
      devices: splitList(form.devices),
      rotation: form.rotation,
      fallbackUrl: form.fallbackUrl || undefined,
      destinationUrl: form.destinationUrl || null,
      // Null rather than undefined: clearing the share on an existing link has to
      // reach the server as "set this to nothing", and undefined means "unchanged".
      // Null rather than undefined when blank: clearing the share on an existing link
      // has to reach the server as "set this to nothing", and undefined means
      // "unchanged". The no-members case is refused above, not silently nulled here.
      revSharePercent: form.revSharePercent ? Number(form.revSharePercent) : null,
    };

    setSaving(true);
    try {
      await (isEdit && id ? updateSmartLink(id, payload) : createSmartLink(payload));
      toast.success(isEdit ? 'Smart-link updated' : 'Smart-link created');
      navigate('/offers/smart-links');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save smart-link');
    } finally {
      setSaving(false);
    }
  }

  if (isEdit && links.loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Edit smart-link" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (isEdit && !existing) {
    return (
      <div className="space-y-6">
        <PageHeader title="Smart-link not found" description="It may have been deleted." />
        <Button variant="outline" onClick={() => navigate('/offers/smart-links')}>
          Back to smart-links
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEdit ? 'Edit smart-link' : 'New smart-link'}
        description="One link that resolves to the best matching member offer at click time, based on the visitor's geo and device."
        actions={
          <>
            <Button variant="outline" onClick={() => navigate('/offers/smart-links')}>
              Cancel
            </Button>
            <Button disabled={saving} onClick={save}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create smart-link'}
            </Button>
          </>
        }
      />

      <Section title="Basics">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <Input
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  name: event.target.value,
                  // Only auto-fill the slug while creating — changing an existing slug
                  // breaks links already in circulation.
                  slug: isEdit ? current.slug : slugify(event.target.value),
                }))
              }
              placeholder="Finance rotator"
            />
          </Field>
          <Field label="Slug" hint={isEdit ? 'Changing this breaks links already handed out.' : undefined}>
            <Input value={form.slug} onChange={(event) => set('slug', slugify(event.target.value))} placeholder="finance-rotator" />
          </Field>
        </div>
        <Field label="Description">
          <RichTextEditor value={form.description} onChange={(html) => set('description', html)} />
        </Field>
      </Section>

      <Section
        title="Member offers"
        hint="Optional. Approved offers only — a paused or pending member would resolve to a dead redirect. Leave empty to make this a plain redirect that sends every click to the Destination URL below, with no offer and no payout."
      >
        <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border border-border p-2">
          {approvedOffers.length === 0 && <p className="p-2 text-sm text-muted-foreground">No approved offers available yet.</p>}
          {approvedOffers.map((offer) => (
            <label key={offer.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent">
              <input
                type="checkbox"
                checked={form.offerIds.includes(offer.id)}
                onChange={(event) =>
                  set('offerIds', event.target.checked ? [...form.offerIds, offer.id] : form.offerIds.filter((x) => x !== offer.id))
                }
              />
              <span className="text-card-foreground">{offer.name}</span>
              <span className="text-xs text-muted-foreground">
                {offer.currency} {offer.defaultPayoutAmount.toFixed(2)}
              </span>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{form.offerIds.length} selected</p>
      </Section>

      <Section
        title="Revenue share"
        hint="Optional. When set, a conversion through this link pays the affiliate this percentage of the sale amount the advertiser reports, instead of the member offer's own payout. Needs at least one member offer — a link with no members carries no offer, so there is no sale to take a share of."
      >
        {/* Disabled when the link has no members, never hidden. A control that vanishes
            reads as a missing feature — the operator scrolls to the section they came
            for and finds a paragraph where the input should be. Greyed out with the
            reason underneath says the same thing without making them wonder.

            No "method" select any more either. It offered CPA or CPS, gated this input
            until one was chosen, and was read by nothing — the rate applied to whatever
            the link sent regardless. A share of a sale is CPS by definition. */}
        <Field
          label="Affiliate gets (%)"
          hint="Percent of the sale amount the advertiser reports. 80 means the affiliate keeps 80% and you keep 20%. Leave blank to use each member offer's own payout instead."
        >
          <Input
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={form.revSharePercent}
            onChange={(event) => set('revSharePercent', event.target.value)}
            placeholder="80"
          />
        </Field>
        {form.offerIds.length === 0 && form.revSharePercent && (
          <p className="text-xs text-warning">
            This rate needs a member offer. A link with no members is a plain redirect — it carries no offer, so there is
            no sale to take a share of, and the save will be refused until one is picked.
          </p>
        )}
        {form.offerIds.length > 0 && form.revSharePercent && (
          <p className="text-xs text-muted-foreground">
            On a sale the advertiser reports as 100.00, the affiliate would get{' '}
            {((Number(form.revSharePercent) / 100) * 100).toFixed(2)} and you would keep{' '}
            {(100 - (Number(form.revSharePercent) / 100) * 100).toFixed(2)}. The share replaces the member offer's own
            payout entirely, so a flat-rate offer pays this instead of its flat amount.
          </p>
        )}
      </Section>

      <Section
        title="Destination"
        hint="With member offers, this is an override and the link works without it. With no member offers, it is where the link sends everything — so one of the two has to be set."
      >
        <Field
          label="Destination URL"
          hint="With members: leave blank for normal behaviour, or set it to land every matched click here instead — the member offer is still chosen, logged and paid against, so reporting and payouts are unaffected. With no members: required, and every click goes straight here with no offer and no payout. {click_id} and {payout_amount} are substituted."
        >
          <Input
            value={form.destinationUrl}
            onChange={(event) => set('destinationUrl', event.target.value)}
            placeholder="https://fatexia.com/go?cid={click_id}"
          />
        </Field>
      </Section>

      <Section title="Targeting and fallback">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Countries" hint="Comma separated. Blank = all.">
            <Input value={form.countries} onChange={(event) => set('countries', event.target.value)} placeholder="US, CA" />
          </Field>
          <Field label="Devices" hint="Blank = all.">
            <Input value={form.devices} onChange={(event) => set('devices', event.target.value)} placeholder="mobile, desktop" />
          </Field>
          <Field label="Rotation" hint={ROTATIONS.find((r) => r.value === form.rotation)?.hint}>
            <Select value={form.rotation} onChange={(event) => set('rotation', event.target.value as SmartLinkRotation)}>
              {ROTATIONS.map((rotation) => (
                <option key={rotation.value} value={rotation.value}>
                  {rotation.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Fallback URL" hint="Where a click goes when no member offer matches the visitor's geo or device.">
            <Input value={form.fallbackUrl} onChange={(event) => set('fallbackUrl', event.target.value)} placeholder="https://fatexia.com/thanks" />
          </Field>
        </div>
      </Section>
    </div>
  );
}
