import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import { Button, CountryFlag, Input, MultiSelectCombobox, PageHeader, Skeleton, Toggle, cn, toast } from '@fatexia/ui';
import type { Advertiser, OfferCategory, SmartLink, SmartLinkCapInput, SmartLinkRotation } from '@fatexia/types';
import { COUNTRY_CODES } from '@fatexia/types';
import { createSmartLink, getSmartLinks, updateSmartLink, uploadSmartLinkThumbnail } from '../../lib/platform-api';
import { getAdvertisers, createAdvertiser } from '../../lib/advertisers-api';
import { getOfferCategories, createOfferCategory } from '../../lib/offer-categories-api';
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
// The same three lists the offer form uses, for the same reason as the two above: a
// smart-link and an offer say these things about themselves in one vocabulary or the
// affiliate portal renders two.
const CAP_PERIODS: SmartLinkCapInput['period'][] = ['DAILY', 'WEEKLY', 'MONTHLY', 'OVERALL'];
const CAP_METRICS: SmartLinkCapInput['metric'][] = ['CLICKS', 'CONVERSIONS', 'PAYOUT'];
const TRAFFIC_TYPE_OPTIONS = ['Search', 'Social', 'Native', 'Email', 'Push', 'Display', 'Incent', 'Non-Incent'];

const selectClass = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground';

// 6-digit numeric secret, short enough for an advertiser to type by hand into their
// postback config. Same as OfferForm's.
function generatePostbackSecret(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0]! % 900000;
  return String(100000 + n);
}


interface FormState {
  name: string;
  slug: string;
  description: string;
  iconUrl: string;
  previewLink: string;
  advertiserId: string;
  kpi: string;
  category: string;
  networkOfferId: string;
  isPublic: boolean;
  featured: boolean;
  allowDeepLinking: boolean;
  // Tri-state, stored as a string so a <select> can express all three: '' means
  // "follow the network setting", which is not the same as "never auto-approve".
  autoApproveConversions: '' | 'yes' | 'no';
  trafficTypes: string[];
  disallowedTrafficTypes: string[];
  postbackSecret: string;
  allowedPostbackIps: string;
  blockedRedirectUrl: string;
  remarksForAdmin: string;
  remarksForAffiliateManager: string;
  caps: SmartLinkCapInput[];
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
  advertiserId: '',
  kpi: '',
  category: '',
  networkOfferId: '',
  isPublic: true,
  featured: false,
  allowDeepLinking: false,
  autoApproveConversions: '',
  trafficTypes: [],
  disallowedTrafficTypes: [],
  postbackSecret: '',
  allowedPostbackIps: '',
  blockedRedirectUrl: '',
  remarksForAdmin: '',
  remarksForAffiliateManager: '',
  caps: [],
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
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [categories, setCategories] = useState<OfferCategory[]>([]);
  const [newAdvertiserName, setNewAdvertiserName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newTrafficSource, setNewTrafficSource] = useState('');
  // Custom sources typed on this link, seeded from what it already carries so
  // re-opening one that used a custom source still lists it.
  const [customTrafficSources, setCustomTrafficSources] = useState<string[]>([]);

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
      advertiserId: existing.advertiserId ?? '',
      kpi: existing.kpi ?? '',
      category: existing.category ?? '',
      networkOfferId: existing.networkOfferId ?? '',
      isPublic: existing.isPublic,
      featured: existing.featured,
      allowDeepLinking: existing.allowDeepLinking,
      autoApproveConversions: existing.autoApproveConversions == null ? '' : existing.autoApproveConversions ? 'yes' : 'no',
      trafficTypes: existing.trafficTypes,
      disallowedTrafficTypes: existing.disallowedTrafficTypes,
      postbackSecret: existing.postbackSecret ?? '',
      allowedPostbackIps: existing.allowedPostbackIps ?? '',
      blockedRedirectUrl: existing.blockedRedirectUrl ?? '',
      remarksForAdmin: existing.remarksForAdmin ?? '',
      remarksForAffiliateManager: existing.remarksForAffiliateManager ?? '',
      caps: existing.caps.map((cap) => ({ period: cap.period, metric: cap.metric, limit: cap.limit })),
      offerIds: existing.offerIds,
      countries: existing.countries,
      devices: existing.devices,
      rotation: existing.rotation,
      fallbackUrl: existing.fallbackUrl ?? '',
      destinationUrl: existing.destinationUrl ?? '',
      revSharePercent: existing.revSharePercent != null ? String(existing.revSharePercent) : '',
    });
    setCustomTrafficSources(
      [...existing.trafficTypes, ...existing.disallowedTrafficTypes].filter((s) => !TRAFFIC_TYPE_OPTIONS.includes(s)),
    );
  }, [existing]);

  useEffect(() => {
    // Swallowed rather than surfaced, exactly as OfferForm does it: a manager may hold
    // smart-link rights without advertisers.view, and a 403 here should cost them a
    // dropdown, not block the whole form with an error toast.
    getAdvertisers()
      .then(setAdvertisers)
      .catch(() => setAdvertisers([]));
    getOfferCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

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

  const trafficSourceOptions = [...TRAFFIC_TYPE_OPTIONS, ...customTrafficSources];

  function addTrafficSource() {
    const name = newTrafficSource.trim();
    if (!name) return;
    // Case-insensitive so "email" doesn't sit beside the built-in "Email" as a second,
    // separately-toggleable row that means the same thing.
    if (trafficSourceOptions.some((source) => source.toLowerCase() === name.toLowerCase())) {
      toast.error(`"${name}" is already listed`);
      setNewTrafficSource('');
      return;
    }
    setCustomTrafficSources((sources) => [...sources, name]);
    setNewTrafficSource('');
  }

  // Cleared from all three places at once — leaving the name in `trafficTypes` while
  // dropping its row would keep saving a permission with no way to see or undo it.
  function removeTrafficSource(name: string) {
    setCustomTrafficSources((sources) => sources.filter((source) => source !== name));
    setForm((current) => ({
      ...current,
      trafficTypes: current.trafficTypes.filter((t) => t !== name),
      disallowedTrafficTypes: current.disallowedTrafficTypes.filter((t) => t !== name),
    }));
  }

  // One click sets one state and clears the other, so a source can never end up in both
  // lists — a contradiction the affiliate portal has no way to render.
  function chooseTrafficState(source: string, next: 'allowed' | 'disallowed' | 'unset') {
    setForm((current) => ({
      ...current,
      trafficTypes: next === 'allowed' ? [...current.trafficTypes.filter((t) => t !== source), source] : current.trafficTypes.filter((t) => t !== source),
      disallowedTrafficTypes:
        next === 'disallowed'
          ? [...current.disallowedTrafficTypes.filter((t) => t !== source), source]
          : current.disallowedTrafficTypes.filter((t) => t !== source),
    }));
  }

  function addCap() {
    set('caps', [...form.caps, { period: 'DAILY', metric: 'CONVERSIONS', limit: 0 }]);
  }

  function updateCap(index: number, patch: Partial<SmartLinkCapInput>) {
    set('caps', form.caps.map((cap, i) => (i === index ? { ...cap, ...patch } : cap)));
  }

  function removeCap(index: number) {
    set('caps', form.caps.filter((_, i) => i !== index));
  }

  async function handleAddAdvertiser() {
    if (!newAdvertiserName.trim()) return;
    const created = await createAdvertiser({ name: newAdvertiserName.trim() });
    setAdvertisers((prev) => [...prev, created]);
    set('advertiserId', created.id);
    setNewAdvertiserName('');
  }

  async function handleAddCategory() {
    if (!newCategoryName.trim()) return;
    const created = await createOfferCategory(newCategoryName.trim());
    setCategories((prev) => [...prev, created]);
    set('category', created.name);
    setNewCategoryName('');
    setShowNewCategory(false);
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
    // Both or neither. The tracker authorises a link's own postback only when the
    // secret AND the allowlist match, so one without the other is a field that looks
    // configured and authorises nothing — the advertiser's postbacks would keep being
    // rejected with no visible reason.
    if (Boolean(form.postbackSecret.trim()) !== Boolean(form.allowedPostbackIps.trim())) {
      toast.error('A postback secret needs an IP allowlist beside it — set both, or clear both');
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
      advertiserId: form.advertiserId || null,
      kpi: form.kpi.trim() || null,
      category: form.category || null,
      networkOfferId: form.networkOfferId.trim() || null,
      isPublic: form.isPublic,
      featured: form.featured,
      allowDeepLinking: form.allowDeepLinking,
      autoApproveConversions: form.autoApproveConversions === '' ? null : form.autoApproveConversions === 'yes',
      // Only sources the operator actually placed. A custom source left on "unset" is
      // in neither list and is therefore not saved — the row warns about that.
      trafficTypes: form.trafficTypes,
      disallowedTrafficTypes: form.disallowedTrafficTypes,
      postbackSecret: form.postbackSecret.trim() || null,
      allowedPostbackIps: form.allowedPostbackIps.trim() || null,
      blockedRedirectUrl: form.blockedRedirectUrl.trim() || null,
      remarksForAdmin: form.remarksForAdmin.trim() || null,
      remarksForAffiliateManager: form.remarksForAffiliateManager.trim() || null,
      caps: form.caps,
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
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Advertiser (optional)</label>
            <div className="flex gap-2">
              <select value={form.advertiserId} onChange={(event) => set('advertiserId', event.target.value)} className={selectClass}>
                <option value="">None</option>
                {advertisers.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Input placeholder="New advertiser name" value={newAdvertiserName} onChange={(event) => setNewAdvertiserName(event.target.value)} className="h-8 text-sm" />
              <button type="button" onClick={handleAddAdvertiser} className="shrink-0 rounded-md border border-border px-3 text-sm hover:bg-accent">
                + Add
              </button>
            </div>
            {/* Optional where an offer requires one: a link can be built before it is
                settled which advertiser the sale lands with. */}
            <p className="text-xs text-muted-foreground">Who the sale settles against. Leave as None if it is not decided yet.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Category</label>
            <div className="flex gap-2">
              <select value={form.category} onChange={(event) => set('category', event.target.value)} className={selectClass}>
                <option value="">None</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => setShowNewCategory((s) => !s)} className="shrink-0 rounded-md border border-border px-3 text-sm hover:bg-accent">
                + Add
              </button>
            </div>
            {showNewCategory && (
              <div className="flex gap-2 pt-1">
                <Input placeholder="New category name" value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} className="h-8 text-sm" />
                <button type="button" onClick={handleAddCategory} className="shrink-0 rounded-md bg-primary px-3 text-sm text-primary-foreground">
                  Add
                </button>
              </div>
            )}
          </div>
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

        <Field label="KPI" hint="What counts as a good conversion on this link. Shown to affiliates.">
          <textarea
            value={form.kpi}
            onChange={(event) => set('kpi', event.target.value)}
            className="h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
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

      <Section title="Traffic Sources" hint="What affiliates may and may not send. Shown on the link in their portal.">
        {/* Three states per source, not a checkbox: allowed, disallowed, and unstated.
            A list that could only say yes gives a link forbidding incent or email
            nowhere to say so, and the affiliate finds out when conversions are voided. */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Traffic sources</label>
          <p className="text-xs text-muted-foreground">
            Affiliates see these on the link — allowed in green, not allowed in red. Leave a source unset if there is no
            rule about it.
          </p>
          <div className="space-y-1 rounded-md border border-border p-3">
            {trafficSourceOptions.map((t) => {
              const state = form.trafficTypes.includes(t) ? 'allowed' : form.disallowedTrafficTypes.includes(t) ? 'disallowed' : 'unset';
              // A custom source lives only in the two lists. Left unset it is stored
              // nowhere and is gone on reopen — said here rather than discovered after
              // saving. A built-in left unset is fine: it returns from the constant.
              const unsavedCustom = state === 'unset' && customTrafficSources.includes(t);
              return (
                <div key={t} className="flex items-center justify-between gap-3 py-1 text-sm">
                  <span className={cn(unsavedCustom ? 'text-muted-foreground' : 'text-foreground')}>
                    {t}
                    {unsavedCustom && <span className="ml-2 text-xs text-amber-500">pick one, or this is not saved</span>}
                  </span>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => chooseTrafficState(t, state === 'allowed' ? 'unset' : 'allowed')}
                      className={cn(
                        'flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors',
                        state === 'allowed'
                          ? 'border-emerald-500 bg-emerald-500/15 text-emerald-500'
                          : 'border-border text-muted-foreground hover:bg-accent',
                      )}
                    >
                      <Check className="size-3.5" /> Allowed
                    </button>
                    <button
                      type="button"
                      onClick={() => chooseTrafficState(t, state === 'disallowed' ? 'unset' : 'disallowed')}
                      className={cn(
                        'flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors',
                        state === 'disallowed'
                          ? 'border-rose-500 bg-rose-500/15 text-rose-500'
                          : 'border-border text-muted-foreground hover:bg-accent',
                      )}
                    >
                      <X className="size-3.5" /> Not allowed
                    </button>
                    {/* Only custom sources can be removed — the eight built-ins are a
                        fixed vocabulary, and deleting one from a single link would make
                        the list mean something different on each link. */}
                    {customTrafficSources.includes(t) && (
                      <button
                        type="button"
                        onClick={() => removeTrafficSource(t)}
                        aria-label={`Remove ${t}`}
                        title={`Remove ${t}`}
                        className="rounded-md border border-border px-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="flex gap-2 border-t border-border pt-3">
              <Input
                value={newTrafficSource}
                onChange={(event) => setNewTrafficSource(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addTrafficSource();
                  }
                }}
                placeholder="Add another source, e.g. Brand bidding"
                className="h-8 text-sm"
              />
              <button type="button" onClick={addTrafficSource} className="shrink-0 rounded-md border border-border px-3 text-sm hover:bg-accent">
                + Add
              </button>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Visibility" hint="Who can see this link, and where it appears.">
        <div className="space-y-4">
          <div>
            <Toggle checked={form.featured} onCheckedChange={(v) => set('featured', v)} label="Set as Featured" />
            <p className="mt-1 text-xs text-muted-foreground">Featured links appear in the Featured section of the affiliate dashboard.</p>
          </div>

          <div>
            <Toggle checked={form.isPublic} onCheckedChange={(v) => set('isPublic', v)} label="Public link" />
            <p className="mt-1 text-xs text-muted-foreground">
              {form.isPublic
                ? 'Any affiliate can see and run this link.'
                : 'Gated — only affiliates with an approved access request can see or run this link.'}
            </p>
          </div>

          <div>
            <Toggle checked={form.allowDeepLinking} onCheckedChange={(v) => set('allowDeepLinking', v)} label="Allow deep linking" />
          </div>

          <Field label="Advertiser Network Offer ID (optional)">
            <Input value={form.networkOfferId} onChange={(event) => set('networkOfferId', event.target.value)} />
          </Field>

          {/* Three options, not a toggle. An offer's copy of this is a plain boolean
              because an offer always decides for itself; a link's conversions have been
              following the network setting since this path was written, so "not set"
              has to stay expressible or saving the form would silently change how
              existing links approve. */}
          <Field
            label="Auto-approve conversions"
            hint="Not set means this link follows the network-wide setting, which is what it did before this field existed."
          >
            <select
              value={form.autoApproveConversions}
              onChange={(event) => set('autoApproveConversions', event.target.value as FormState['autoApproveConversions'])}
              className={selectClass}
            >
              <option value="">Not set — follow the network setting</option>
              <option value="yes">Yes — approve on arrival</option>
              <option value="no">No — hold for review</option>
            </select>
          </Field>
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

        {/* Optional here, unlike on an offer where all three gate activation. A link
            with no credentials of its own still converts — the network-wide postback
            entry authorises it, which until now was the only way in. These give the
            link its own, checked exactly as an offer's are. */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Postback secret (optional)">
            <div className="flex gap-2">
              <Input
                value={form.postbackSecret}
                onChange={(event) => set('postbackSecret', event.target.value)}
                placeholder="Shared secret the advertiser sends on /postback"
              />
              <button
                type="button"
                onClick={() => set('postbackSecret', generatePostbackSecret())}
                className="shrink-0 rounded-md border border-border px-3 text-sm hover:bg-accent"
              >
                Generate
              </button>
            </div>
          </Field>
          <Field label="Allowed postback IPs" hint="Comma separated. Required alongside a secret — a secret with no allowlist authorises nothing.">
            <Input
              value={form.allowedPostbackIps}
              onChange={(event) => set('allowedPostbackIps', event.target.value)}
              placeholder="203.0.113.10, 198.51.100.4"
            />
          </Field>
        </div>

        <Field
          label="Blocked traffic redirect (optional)"
          hint="Where a click scored as blocked is sent instead of the destination. Blank uses the network-wide setting."
        >
          <Input
            value={form.blockedRedirectUrl}
            onChange={(event) => set('blockedRedirectUrl', event.target.value)}
            placeholder="Network default"
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

      <Section
        title="Cap Limit Options"
        hint="How many conversions, clicks or payout this link may accrue, daily, weekly, monthly or overall. Stored and shown, not yet enforced — the same as an offer's caps."
      >
        <div className="space-y-2">
          {form.caps.map((cap, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2">
              <select
                value={cap.period}
                onChange={(event) => updateCap(i, { period: event.target.value as SmartLinkCapInput['period'] })}
                className={`${selectClass} w-32`}
              >
                {CAP_PERIODS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <select
                value={cap.metric}
                onChange={(event) => updateCap(i, { metric: event.target.value as SmartLinkCapInput['metric'] })}
                className={`${selectClass} w-36`}
              >
                {CAP_METRICS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                min="0"
                value={cap.limit}
                onChange={(event) => updateCap(i, { limit: Number(event.target.value) })}
                className="w-28"
              />
              <button
                type="button"
                onClick={() => removeCap(i)}
                className="rounded-md border border-destructive/50 px-2 py-1.5 text-xs text-destructive"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addCap} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent">
          + Add New Cap
        </button>
      </Section>

      <Section title="Remarks (Optional)" hint="Just for the reminders — put the link's remarks if any.">
        <Field label="Remarks for Admin">
          <textarea
            value={form.remarksForAdmin}
            onChange={(event) => set('remarksForAdmin', event.target.value)}
            className="h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </Field>
        <Field label="Remarks for Affiliate Manager">
          <textarea
            value={form.remarksForAffiliateManager}
            onChange={(event) => set('remarksForAffiliateManager', event.target.value)}
            className="h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </Field>
      </Section>
    </div>
  );
}
