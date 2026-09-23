import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, CountryFlag, Input, MultiSelectCombobox, PageHeader, Skeleton, cn, toast } from '@fatexia/ui';
import type { SmartLink, SmartLinkRotation } from '@fatexia/types';
import { COUNTRY_CODES } from '@fatexia/types';
import { createSmartLink, getSmartLinks, updateSmartLink, uploadSmartLinkThumbnail } from '../../lib/platform-api';
import { useAsync } from '../../hooks/useAsync';
import { RichTextEditor } from '../../components/RichTextEditor';

// The same two option lists the offer form's rule targeting uses. A smart-link's gate
// and a payout rule's gate are matched against the identical click fields, so a value
// that is valid on one screen has to be valid on the other.
const COUNTRY_OPTIONS = COUNTRY_CODES.map((c) => ({
  value: c.code,
  label: c.name,
  sublabel: c.code,
  icon: <CountryFlag code={c.code} title={c.name} />,
}));
// UAParser's device.type taxonomy plus the "desktop" fallback click.service.ts applies —
// exactly the values a click's deviceType is stored as.
const DEVICE_TYPE_OPTIONS = ['desktop', 'mobile', 'tablet', 'console', 'smarttv', 'wearable', 'embedded'];


interface FormState {
  name: string;
  slug: string;
  description: string;
  iconUrl: string;
  previewLink: string;
  offerIds: string[];
  countries: string[];
  devices: string[];
  rotation: SmartLinkRotation;
  fallbackUrl: string;
  destinationUrl: string;
  revSharePercent: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  slug: '',
  description: '',
  iconUrl: '',
  previewLink: '',
  offerIds: [],
  countries: [],
  devices: [],
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
 * The form outgrew a dialog: targeting, the destination and the revenue share each need
 * their own explained section. A modal put them inside a box that scrolled independently
 * of the page behind it.
 */
export function SmartLinkForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [draggingIcon, setDraggingIcon] = useState(false);

  // The list endpoint is the only way to read one link — there is no GET /:id — so the
  // edit view filters the collection it already knows how to fetch.
  const links = useAsync<SmartLink[]>(() => getSmartLinks(), []);

  const existing = isEdit ? links.data?.find((link) => link.id === id) : undefined;

  useEffect(() => {
    if (!existing) return;
    setForm({
      name: existing.name,
      slug: existing.slug,
      description: existing.description ?? '',
      iconUrl: existing.iconUrl ?? '',
      previewLink: existing.previewLink ?? '',
      offerIds: existing.offerIds,
      countries: existing.countries,
      devices: existing.devices,
      rotation: existing.rotation,
      fallbackUrl: existing.fallbackUrl ?? '',
      destinationUrl: existing.destinationUrl ?? '',
      revSharePercent: existing.revSharePercent != null ? String(existing.revSharePercent) : '',
    });
  }, [existing]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  // Same two handlers as OfferForm's thumbnail, against the smart-link bucket.
  async function handleIconUpload(file: File | undefined) {
    if (!file) return;
    // A drop accepts anything the OS allows — a PDF, a folder, a .txt. Checked here so
    // the wrong file fails with a sentence rather than a 400 from the upload route.
    if (!file.type.startsWith('image/')) {
      toast.error('That file is not an image');
      return;
    }
    setUploadingIcon(true);
    try {
      const { url } = await uploadSmartLinkThumbnail(file);
      set('iconUrl', url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload thumbnail');
    } finally {
      setUploadingIcon(false);
    }
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setDraggingIcon(false);
    void handleIconUpload(event.dataTransfer.files?.[0]);
  }

  async function save() {
    if (!form.name.trim()) {
      toast.error('Give the smart-link a name');
      return;
    }
    // A smart-link is a redirect with a rate on it, so it must have somewhere to send
    // traffic. Mirrors the backend's own check so the admin is told before the request
    // rather than by a 400.
    if (!form.destinationUrl.trim()) {
      toast.error('Set a destination URL — it is where this link sends every click');
      return;
    }

    const payload = {
      name: form.name,
      slug: form.slug,
      description: form.description || undefined,
      // Null rather than undefined when blank, so removing a thumbnail or a preview
      // link on an existing record actually clears the column instead of leaving it
      // untouched — same reason revSharePercent does it below.
      iconUrl: form.iconUrl || null,
      previewLink: form.previewLink.trim() || null,
      offerIds: form.offerIds,
      countries: form.countries,
      devices: form.devices,
      rotation: form.rotation,
      fallbackUrl: form.fallbackUrl || undefined,
      destinationUrl: form.destinationUrl || null,
      // Null rather than undefined when blank: clearing the rate on an existing link has
      // to reach the server as "set this to nothing", and undefined means "unchanged".
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
        description="One tracking link with its own payout rate. Clicks are logged and redirected to its destination; conversions are priced from the sale amount the advertiser posts back."
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
        <Field
          label="Preview link"
          hint="The landing page as an affiliate should see it, without tracking. Nothing redirects here — it is for looking at what the link sends traffic to. Leave blank to hide the button."
        >
          <Input
            value={form.previewLink}
            onChange={(event) => set('previewLink', event.target.value)}
            placeholder="https://advertiser.com/landing-page"
          />
        </Field>

        <Field label="Description">
          <RichTextEditor value={form.description} onChange={(html) => set('description', html)} />
        </Field>

        {/* Not wrapped in Field: that renders a <label>, and a file input inside one
            opens the picker on every click of the surrounding text. */}
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Thumbnail image</span>
          {/* dragOver must preventDefault or the browser treats the drop as a
              navigation and opens the image in place of the form — losing everything
              typed so far. */}
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDraggingIcon(true);
            }}
            onDragLeave={() => setDraggingIcon(false)}
            onDrop={handleDrop}
            className={cn(
              'flex items-center gap-3 rounded-md border border-dashed p-3 transition-colors',
              draggingIcon ? 'border-primary bg-primary/5' : 'border-border',
            )}
          >
            {form.iconUrl && <img src={form.iconUrl} alt="" className="size-14 shrink-0 rounded-md border border-border object-cover" />}
            <div className="space-y-1">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                disabled={uploadingIcon}
                onChange={(event) => void handleIconUpload(event.target.files?.[0])}
                className="text-xs text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:text-secondary-foreground hover:file:bg-accent"
              />
              <p className="text-xs text-muted-foreground">
                {uploadingIcon ? 'Uploading…' : 'or drop an image anywhere in this box'}
              </p>
              {form.iconUrl && !uploadingIcon && (
                <button type="button" onClick={() => set('iconUrl', '')} className="text-xs text-destructive hover:underline">
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="Revenue share"
        hint="What the affiliate earns on this link. The advertiser's postback reports the sale amount and this percentage of it is the payout. Without a rate the link still tracks clicks, but a conversion on it cannot be priced and is refused."
      >
        {/* No "method" select. It offered CPA or CPS, gated this input until one was
            chosen, and was read by nothing — the rate applied to whatever the link sent
            regardless. A share of a sale is CPS by definition. */}
        <Field
          label="Affiliate gets (%)"
          hint="Percent of the sale amount the advertiser reports on the postback. 80 means the affiliate keeps 80% and you keep 20%."
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
        {/* Warned, not blocked. A link can reasonably be saved before its rate is
            decided — it just cannot earn until it is, and the postback that arrives
            meanwhile is refused rather than booked at zero. */}
        {!form.revSharePercent && (
          <p className="text-xs text-warning">
            Without a rate this link tracks clicks but cannot pay: a conversion on it has no percentage to apply to the
            reported sale, so the postback is refused.
          </p>
        )}
        {form.revSharePercent && (
          <p className="text-xs text-muted-foreground">
            On a sale the advertiser reports as 100.00, the affiliate would get{' '}
            {((Number(form.revSharePercent) / 100) * 100).toFixed(2)} and you would keep{' '}
            {(100 - (Number(form.revSharePercent) / 100) * 100).toFixed(2)}.
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
          {/* Picked, not typed. These are closed sets the tracker matches on exactly —
              a country is an ISO code and a device is one of UAParser's types — so a
              free-text box could only ever produce a link that silently matches nothing:
              "USA", "Mobile" or a stray space all parse fine and match no click. Same
              components and same option lists as the offer form's rule targeting, so the
              two screens cannot drift apart on what a valid value is. */}
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-sm font-medium text-foreground">Geo targeting (optional)</label>
            <MultiSelectCombobox
              options={COUNTRY_OPTIONS}
              value={form.countries}
              onChange={(countries) => set('countries', countries)}
              placeholder="All countries"
              emptyLabel="Every country"
            />
            <p className="text-xs text-muted-foreground">
              Leave empty for all. A visitor outside this list goes to the Fallback URL.
            </p>
          </div>
          {/* Laid out exactly as the offer form's device targeting — same label style,
              same bordered wrap, same option list — because they are the same choice
              against the same click field, and two shapes for one decision is how an
              operator ends up believing they mean different things. */}
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-sm font-medium text-foreground">Device targeting (optional)</label>
            <div className="flex flex-wrap gap-3 rounded-md border border-border p-3">
              {DEVICE_TYPE_OPTIONS.map((d) => (
                <label key={d} className="flex items-center gap-1.5 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={form.devices.includes(d)}
                    onChange={(e) => set('devices', e.target.checked ? [...form.devices, d] : form.devices.filter((v) => v !== d))}
                  />
                  {d}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Leave all unticked for every device.</p>
          </div>
          <Field label="Fallback URL" hint="Where a click goes when the visitor falls outside the Countries or Devices above. Leave blank and such a visitor gets the “Offer not available” page instead.">
            <Input value={form.fallbackUrl} onChange={(event) => set('fallbackUrl', event.target.value)} placeholder="https://fatexia.com/thanks" />
          </Field>
        </div>
      </Section>
    </div>
  );
}
