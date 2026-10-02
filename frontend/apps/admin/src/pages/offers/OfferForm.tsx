import { Children, isValidElement, useEffect, useState } from 'react';
import { Check, ChevronDown, Plus, X } from 'lucide-react';
import type { Advertiser, AdvertiserNetwork, Affiliate, CreateOfferInput, Offer, OfferCapInput, OfferCategory, OfferStatus, PayoutMode, PayoutRuleInput, PayoutType, RevenueModel } from '@fatexia/types';
import { COUNTRY_CODES } from '@fatexia/types';
import { Button, CountryFlag, InfoTip, Input, MultiSelectCombobox, Toggle, cn, toast } from '@fatexia/ui';
import { getAdvertisers, createAdvertiser } from '../../lib/advertisers-api';
import { getOfferCategories, createOfferCategory } from '../../lib/offer-categories-api';
import { getAdvertiserNetworks } from '../../lib/advertiser-networks-api';
import { getAffiliates } from '../../lib/affiliates-api';
import { uploadOfferThumbnail } from '../../lib/offers-api';
import { RichTextEditor } from '../../components/RichTextEditor';

// `#s1#` -> `s1`, `{aff_click_id}` -> `aff_click_id`, `[ml_sub1]` -> `ml_sub1`. A suggestion
// only: the parameter name the advertiser's *link* reads is usually the token's name, but
// not provably so, which is why the admin has to click Insert and can edit the result.
function paramNameFromToken(token: string): string {
  return token.replace(/^[^A-Za-z0-9_]+|[^A-Za-z0-9_]+$/g, '');
}

// Drops every query parameter whose value is the click-id macro, whatever its name. An
// offer carries exactly one: a second one under another network's name means the
// advertiser's platform would read one and ignore the other.
function stripClickIdParams(url: string): string {
  const trimmed = url.trim();
  const queryAt = trimmed.indexOf('?');
  if (queryAt === -1) return trimmed;
  const base = trimmed.slice(0, queryAt);
  const kept = trimmed
    .slice(queryAt + 1)
    .split('&')
    .filter((pair) => pair !== '' && !/^[^=]+=\{click_id\}$/.test(pair));
  return kept.length ? `${base}?${kept.join('&')}` : base;
}

function appendClickIdParam(url: string, param: string): string {
  const base = stripClickIdParams(url);
  if (!base) return `?${param}={click_id}`;
  return `${base}${base.includes('?') ? '&' : '?'}${param}={click_id}`;
}

const PAYOUT_MODES: PayoutMode[] = ['CPA', 'CPC', 'CPL', 'CPI', 'CPS'];
const PAYOUT_TYPES: PayoutType[] = ['FLAT', 'PERCENTAGE'];
// Modes whose advertiser postback carries a money figure a percentage can be taken of.
const PERCENT_MODES: PayoutMode[] = ['CPS', 'CPI'];
const REVENUE_MODELS: RevenueModel[] = ['NONE', 'RPA', 'RPC', 'RPS'];
// Matches UAParser's device.type taxonomy plus the "desktop" fallback click.service.ts
// applies — the exact same values a click's deviceType is stored as.
const DEVICE_TYPE_OPTIONS = ['desktop', 'mobile', 'tablet', 'console', 'smarttv', 'wearable', 'embedded'];
// UAParser's os.name is free text, not a closed enum — this is the common subset
// worth targeting on. A rule matches by exact string, so this must stay in sync with
// what UAParser actually reports for these platforms.
const OS_OPTIONS = ['Windows', 'Mac OS', 'iOS', 'Android', 'Linux', 'Chrome OS'];
const COUNTRY_OPTIONS = COUNTRY_CODES.map((c) => ({
  value: c.code,
  label: c.name,
  sublabel: c.code,
  icon: <CountryFlag code={c.code} title={c.name} />,
}));
// DELETED isn't offered here — that's a destructive row action on All Offers, not a
// state to create/save an offer into directly.
const STATUS_OPTIONS: { value: OfferStatus; label: string }[] = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'PAUSED', label: 'Paused' },
];
const CAP_PERIODS: OfferCapInput['period'][] = ['DAILY', 'WEEKLY', 'MONTHLY', 'OVERALL'];
const CAP_METRICS: OfferCapInput['metric'][] = ['CLICKS', 'CONVERSIONS', 'PAYOUT'];
const TRAFFIC_TYPE_OPTIONS = ['Search', 'Social', 'Native', 'Email', 'Push', 'Display', 'Incent', 'Non-Incent'];

const EMPTY_RULE: PayoutRuleInput = {
  payoutMode: 'CPA',
  payoutType: 'FLAT',
  amount: 0,
  revenueModel: 'NONE',
  revenueAmount: 0,
  targeting: { countries: [], devices: [], os: [], affiliateIds: [], affiliateGroupIds: [] },
  managerCommissionPercent: 0,
  referAffiliateCommissionPercent: 0,
  holdSchedule: { enabled: false, days: 0 },
  commissionPercent: 0,
};

// 6-digit numeric secret, short enough for an advertiser to type by hand into their
// postback config. Same as SmartLinkForm's.
function generatePostbackSecret(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0]! % 900000;
  return String(100000 + n);
}

function isoDateOnly(value?: string): string {
  return value ? value.slice(0, 10) : '';
}

// Shared by CreateOffer and EditOffer — an existing Offer already has every field
// CreateOfferInput needs (plus extras like id/createdAt that this form ignores), so
// it doubles as the edit form's initial values.
export function offerToFormInput(offer: Offer): CreateOfferInput {
  return {
    advertiserId: offer.advertiserId,
    name: offer.name,
    previewLink: offer.previewLink,
    description: offer.description,
    kpi: offer.kpi,
    category: offer.category,
    iconUrl: offer.iconUrl,
    startDate: isoDateOnly(offer.startDate),
    endDate: isoDateOnly(offer.endDate),
    currency: offer.currency,
    trackingPlatform: offer.trackingPlatform,
    trafficTypes: offer.trafficTypes,
    disallowedTrafficTypes: offer.disallowedTrafficTypes,
    featured: offer.featured,
    networkOfferId: offer.networkOfferId,
    advertiserNetworkId: offer.advertiserNetworkId,
    isPublic: offer.isPublic,
    autoApproveConversions: offer.autoApproveConversions,
    allowDeepLinking: offer.allowDeepLinking,
    remarksForAdmin: offer.remarksForAdmin,
    remarksForAffiliateManager: offer.remarksForAffiliateManager,
    payoutRules: offer.payoutRules,
    caps: offer.caps,
    defaultPayoutAmount: offer.defaultPayoutAmount,
    destinationUrl: offer.destinationUrl ?? undefined,
    fallbackUrl: offer.fallbackUrl ?? undefined,
    postbackSecret: offer.postbackSecret ?? undefined,
    allowedPostbackIps: offer.allowedPostbackIps ?? undefined,
    blockedRedirectUrl: offer.blockedRedirectUrl ?? undefined,
  };
}

function SectionCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-1.5">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {hint && <InfoTip>{hint}</InfoTip>}
      </div>
      {children}
    </section>
  );
}

/**
 * Explanatory text for a field, shown behind a "?" next to its label rather than printed
 * under it. Put a <Help> anywhere inside a <Field> and the Field lifts it up beside the
 * label; warnings that need to be seen stay as ordinary visible paragraphs.
 */
function Help({ children }: { children: React.ReactNode }) {
  return <InfoTip>{children}</InfoTip>;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  const nodes = Children.toArray(children);
  const helps = nodes.filter((node) => isValidElement(node) && node.type === Help);
  const rest = nodes.filter((node) => !helps.includes(node));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <label className="text-sm font-medium text-foreground">
          {label}
          {required && <span className="text-destructive"> *</span>}
        </label>
        {helps}
      </div>
      {rest}
    </div>
  );
}

const selectClass = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground';

interface OfferFormProps {
  heading: string;
  submitLabel: string;
  submittingLabel: string;
  initial?: CreateOfferInput;
  // Separate from `initial` because CreateOfferInput has no status field — status is
  // changed through its own endpoint (see offer.service.ts's updateOfferStatus), not
  // folded into create/update. Defaults to PENDING for a brand-new offer.
  initialStatus?: OfferStatus;
  onSubmit: (input: CreateOfferInput, status: OfferStatus) => Promise<void>;
}

export function OfferForm({ heading, submitLabel, submittingLabel, initial, initialStatus, onSubmit }: OfferFormProps) {
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [categories, setCategories] = useState<OfferCategory[]>([]);
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [newAdvertiserName, setNewAdvertiserName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showMacros, setShowMacros] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [advertiserId, setAdvertiserId] = useState(initial?.advertiserId ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [previewLink, setPreviewLink] = useState(initial?.previewLink ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [kpi, setKpi] = useState(initial?.kpi ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [startDate, setStartDate] = useState(initial?.startDate ?? '');
  const [endDate, setEndDate] = useState(initial?.endDate ?? '');
  const [currency, setCurrency] = useState(initial?.currency ?? 'USD');
  const [defaultPayoutAmount, setDefaultPayoutAmount] = useState(initial ? String(initial.defaultPayoutAmount || '') : '');
  const [status, setStatus] = useState<OfferStatus>(initialStatus ?? 'PENDING');
  const [trafficTypes, setTrafficTypes] = useState<string[]>(initial?.trafficTypes ?? []);
  const [disallowedTrafficTypes, setDisallowedTrafficTypes] = useState<string[]>(initial?.disallowedTrafficTypes ?? []);
  // Custom sources the admin typed on this offer. Seeded from whatever the offer
  // already carries, so re-opening one that used a custom source still lists it —
  // otherwise the row would vanish from the editor while staying in the data.
  const [customTrafficSources, setCustomTrafficSources] = useState<string[]>(() =>
    [...(initial?.trafficTypes ?? []), ...(initial?.disallowedTrafficTypes ?? [])].filter(
      (source) => !TRAFFIC_TYPE_OPTIONS.includes(source),
    ),
  );
  const [newTrafficSource, setNewTrafficSource] = useState('');
  const [featured, setFeatured] = useState(initial?.featured ?? false);
  const [networkOfferId, setNetworkOfferId] = useState(initial?.networkOfferId ?? '');
  const [advertiserNetworkId, setAdvertiserNetworkId] = useState(initial?.advertiserNetworkId ?? '');
  const [networks, setNetworks] = useState<AdvertiserNetwork[]>([]);
  const selectedNetwork = networks.find((n) => n.id === advertiserNetworkId);
  const suggestedParam = selectedNetwork ? paramNameFromToken(selectedNetwork.clickIdToken) : '';
  const [isPublic, setIsPublic] = useState(initial?.isPublic ?? true);
  const [iconUrl, setIconUrl] = useState(initial?.iconUrl ?? '');
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [draggingIcon, setDraggingIcon] = useState(false);

  const [destinationUrl, setDestinationUrl] = useState(initial?.destinationUrl ?? '');
  const [postbackSecret, setPostbackSecret] = useState(initial?.postbackSecret ?? '');
  const [allowedPostbackIps, setAllowedPostbackIps] = useState(initial?.allowedPostbackIps ?? '');
  const [blockedRedirectUrl, setBlockedRedirectUrl] = useState(initial?.blockedRedirectUrl ?? '');
  const [fallbackUrl, setFallbackUrl] = useState(initial?.fallbackUrl ?? '');

  const [payoutRules, setPayoutRules] = useState<PayoutRuleInput[]>(initial?.payoutRules ?? []);
  const [draftRule, setDraftRule] = useState<PayoutRuleInput>(EMPTY_RULE);
  // A percentage rule has no fixed base: every conversion is priced from the amount the
  // advertiser reports on its postback (`sum`, required there), which differs per sale or
  // per inner offer of a content locker. The figure here is only a margin-preview example.
  const isVariableBase = draftRule.payoutType === 'PERCENTAGE';

  const [caps, setCaps] = useState<OfferCapInput[]>(initial?.caps ?? []);

  const [autoApproveConversions, setAutoApproveConversions] = useState(initial?.autoApproveConversions ?? false);
  const [allowDeepLinking, setAllowDeepLinking] = useState(initial?.allowDeepLinking ?? false);
  const [remarksForAdmin, setRemarksForAdmin] = useState(initial?.remarksForAdmin ?? '');
  const [remarksForAffiliateManager, setRemarksForAffiliateManager] = useState(initial?.remarksForAffiliateManager ?? '');

  useEffect(() => {
    getAdvertisers().then(setAdvertisers);
    getOfferCategories().then(setCategories);
    // The networks API is admin-only; a manager just gets no picker.
    getAdvertiserNetworks()
      .then(setNetworks)
      .catch(() => setNetworks([]));
    // Swallowed rather than surfaced: a manager can hold offers.create without
    // affiliates.view, and a 403 here should cost them the "dedicate to affiliate"
    // dropdown, not block the whole offer form with an error toast.
    getAffiliates()
      .then(setAffiliates)
      .catch(() => setAffiliates([]));
  }, []);

  // `keywords` carries the public id so "1011" finds AFF-1011 — the combobox matches
  // with punctuation stripped, and the id is what an operator reads off the affiliate
  // list, not the internal uuid in `value`.
  const affiliateOptions = affiliates.map((a) => ({
    value: a.id,
    label: a.fullName ?? a.email,
    sublabel: a.publicId ?? a.email,
    keywords: `${a.publicId ?? ''} ${a.email}`,
  }));

  const valid = name.trim().length > 0 && !!advertiserId && payoutRules.length > 0;

  async function handleAddAdvertiser() {
    if (!newAdvertiserName.trim()) return;
    const created = await createAdvertiser({ name: newAdvertiserName.trim() });
    setAdvertisers((prev) => [...prev, created]);
    setAdvertiserId(created.id);
    setNewAdvertiserName('');
  }

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
      const { url } = await uploadOfferThumbnail(file);
      setIconUrl(url);
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

  async function handleAddCategory() {
    if (!newCategoryName.trim()) return;
    const created = await createOfferCategory(newCategoryName.trim());
    setCategories((prev) => [...prev, created]);
    setCategory(created.name);
    setNewCategoryName('');
    setShowNewCategory(false);
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
    setTrafficTypes((types) => types.filter((type) => type !== name));
    setDisallowedTrafficTypes((types) => types.filter((type) => type !== name));
  }

  function addPayoutRule() {
    // Message names the field as it is labelled on screen. It used to say "Payout
    // Amount", which stopped matching anything visible when the fields were renamed.
    if (draftRule.amount <= 0) {
      toast.error('Fill in "Affiliate gets" before adding the rule');
      return;
    }
    // No "Advertiser pays you" check for a percentage rule: its base is the `sum` on each
    // postback, and a postback without one is rejected rather than paid as zero.
    if (draftRule.payoutType === 'PERCENTAGE' && draftRule.amount > 100) {
      toast.error('A percentage cannot be more than 100');
      return;
    }
    setPayoutRules((rules) => [...rules, draftRule]);
    setDraftRule(EMPTY_RULE);
  }

  function removePayoutRule(index: number) {
    setPayoutRules((rules) => rules.filter((_, i) => i !== index));
  }

  function addCap() {
    setCaps((c) => [...c, { period: 'DAILY', metric: 'CONVERSIONS', limit: 0 }]);
  }

  function updateCap(index: number, patch: Partial<OfferCapInput>) {
    setCaps((c) => c.map((cap, i) => (i === index ? { ...cap, ...patch } : cap)));
  }

  function removeCap(index: number) {
    setCaps((c) => c.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!valid) {
      toast.error('Advertiser, offer name, and at least one payout rule are required');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(
        {
          advertiserId,
          name,
          previewLink: previewLink || undefined,
          description: description || undefined,
          kpi: kpi || undefined,
          category: category || undefined,
          iconUrl: iconUrl || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          currency,
          defaultPayoutAmount: Number(defaultPayoutAmount) || 0,
          // No longer admin-configurable (issue #8) — every offer routes directly, no
          // separate tracking-platform integration exists to select between.
          trackingPlatform: 'DIRECT',
          isPublic,
          trafficTypes,
          disallowedTrafficTypes,
          featured,
          networkOfferId: networkOfferId || undefined,
          advertiserNetworkId: advertiserNetworkId || null,
          autoApproveConversions,
          allowDeepLinking,
          remarksForAdmin: remarksForAdmin || undefined,
          remarksForAffiliateManager: remarksForAffiliateManager || undefined,
          destinationUrl: destinationUrl || undefined,
          fallbackUrl: fallbackUrl || undefined,
          postbackSecret: postbackSecret || undefined,
          allowedPostbackIps: allowedPostbackIps || undefined,
          blockedRedirectUrl: blockedRedirectUrl || undefined,
          payoutRules,
          caps,
        },
        status,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save offer');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-2xl font-semibold">{heading}</h1>

      <SectionCard title="Basic Details">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-sm font-medium text-foreground">
              Advertiser
              <span className="text-destructive"> *</span>
            </label>
            <div className="flex gap-2">
              <select value={advertiserId} onChange={(e) => setAdvertiserId(e.target.value)} className={selectClass}>
                <option value="">Select an advertiser…</option>
                {advertisers.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <Input placeholder="New advertiser name" value={newAdvertiserName} onChange={(e) => setNewAdvertiserName(e.target.value)} className="w-56" />
              <button type="button" onClick={handleAddAdvertiser} className="shrink-0 rounded-md border border-border px-3 text-sm hover:bg-accent">
                + New
              </button>
            </div>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Field label="Title" required>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Example: My US Offer" />
            </Field>
          </div>

          {/* The field existed on the type and in the DTO but had no input, so no offer
              could ever have one — while both portals already rendered a preview button
              that was therefore permanently hidden. */}
          <div className="space-y-1.5 sm:col-span-2">
            <Field label="Preview link">
              <Input
                value={previewLink}
                onChange={(e) => setPreviewLink(e.target.value)}
                placeholder="https://advertiser.com/landing-page"
              />
              <Help>
                The landing page as an affiliate should see it, without tracking. Shown as "Preview landing page" on the
                offer — leave blank to hide that button.
              </Help>
            </Field>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Field label="Description">
              <RichTextEditor value={description} onChange={setDescription} />
            </Field>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Field label="Offer KPI">
              <textarea
                value={kpi}
                onChange={(e) => setKpi(e.target.value)}
                className="h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </Field>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Category</label>
            <div className="flex gap-2">
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass}>
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
                <Input placeholder="New category name" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} />
                <button type="button" onClick={handleAddCategory} className="shrink-0 rounded-md bg-primary px-3 text-sm text-primary-foreground">
                  Add
                </button>
              </div>
            )}
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-sm font-medium text-foreground">Thumbnail image</label>
            {/* dragOver must preventDefault or the browser treats the drop as a
                navigation and opens the image in place of the form — losing everything
                typed so far. */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDraggingIcon(true);
              }}
              onDragLeave={() => setDraggingIcon(false)}
              onDrop={handleDrop}
              className={cn(
                'flex items-center gap-3 rounded-md border border-dashed p-3 transition-colors',
                draggingIcon ? 'border-primary bg-primary/5' : 'border-border',
              )}
            >
              {iconUrl && <img src={iconUrl} alt="" className="size-14 shrink-0 rounded-md border border-border object-cover" />}
              <div className="space-y-1">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  disabled={uploadingIcon}
                  onChange={(e) => void handleIconUpload(e.target.files?.[0])}
                  className="text-xs text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:text-secondary-foreground hover:file:bg-accent"
                />
                <p className="text-xs text-muted-foreground">
                  {uploadingIcon ? 'Uploading…' : 'or drop an image anywhere in this box'}
                </p>
                {iconUrl && !uploadingIcon && (
                  <button type="button" onClick={() => setIconUrl('')} className="text-xs text-destructive hover:underline">
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

        </div>
      </SectionCard>

      <SectionCard title="Schedule & Defaults" hint="When the offer runs, and the figures the payout rules below start from.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Start Date">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="End Date">
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>

          <Field label="Currency">
            <Input value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </Field>
          <Field label="Default Payout Amount">
            <Input type="number" step="0.01" value={defaultPayoutAmount} onChange={(e) => setDefaultPayoutAmount(e.target.value)} />
            <Help>Informational only — the Offers list and actual payouts are driven by the payout rules below, not this field.</Help>
          </Field>
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value as OfferStatus)} className={selectClass}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            {status === 'APPROVED' && (
              <Help>
                Approving requires the Destination URL below. The postback credentials are optional — leave them blank
                when the advertiser reports against the network-wide global postback.
              </Help>
            )}
          </Field>

        </div>
      </SectionCard>

      <SectionCard title="Traffic Sources" hint="What affiliates may and may not send. Affiliates see these on the offer — allowed in green, not allowed in red. Leave a source unset if the advertiser has no rule about it.">
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Three states per source, not a checkbox: allowed, disallowed, and unstated.
              A plain "Traffic Allowed" list could only say yes — an offer that forbids
              incent or email traffic had nowhere to say so, and an affiliate found out
              when their conversions were voided. Unstated stays available for sources
              the advertiser genuinely has no rule about. */}
          <div className="space-y-1.5 sm:col-span-2">
            <div className="space-y-1 rounded-md border border-border p-3">
              {trafficSourceOptions.map((t) => {
                const state = trafficTypes.includes(t) ? 'allowed' : disallowedTrafficTypes.includes(t) ? 'disallowed' : 'unset';
                // Each click sets one state and clears the other, so a source can never
                // end up in both lists — which would be a contradiction the affiliate
                // portal has no way to render.
                const choose = (next: 'allowed' | 'disallowed' | 'unset') => {
                  setTrafficTypes((types) => (next === 'allowed' ? [...types.filter((v) => v !== t), t] : types.filter((v) => v !== t)));
                  setDisallowedTrafficTypes((types) =>
                    next === 'disallowed' ? [...types.filter((v) => v !== t), t] : types.filter((v) => v !== t),
                  );
                };
                // A custom source lives only in the two lists. Left unset it is stored
                // nowhere and is gone on reopen — said here rather than discovered
                // after saving. A built-in left unset is fine: it comes back from the
                // constant either way.
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
                        onClick={() => choose(state === 'allowed' ? 'unset' : 'allowed')}
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
                        onClick={() => choose(state === 'disallowed' ? 'unset' : 'disallowed')}
                        className={cn(
                          'flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors',
                          state === 'disallowed'
                            ? 'border-rose-500 bg-rose-500/15 text-rose-500'
                            : 'border-border text-muted-foreground hover:bg-accent',
                        )}
                      >
                        <X className="size-3.5" /> Not allowed
                      </button>
                      {/* Only custom sources can be removed. The eight built-ins are a
                          fixed vocabulary — deleting one from a single offer would make
                          the list mean something different on each offer. */}
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

              {/* The eight defaults cover the common cases, not every advertiser's
                  vocabulary — "Brand bidding", "SMS", "Pop" and the like come up per
                  offer. A custom source is stored exactly like a built-in one (a string
                  in one of the two lists), so nothing downstream has to know which is
                  which. */}
              <div className="flex gap-2 border-t border-border pt-3">
                <Input
                  value={newTrafficSource}
                  onChange={(e) => setNewTrafficSource(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTrafficSource();
                    }
                  }}
                  placeholder="Add another source, e.g. Brand bidding"
                  className="h-8 text-sm"
                />
                <button
                  type="button"
                  onClick={addTrafficSource}
                  className="shrink-0 rounded-md border border-border px-3 text-sm hover:bg-accent"
                >
                  + Add
                </button>
              </div>
            </div>
          </div>

        </div>
      </SectionCard>

      <SectionCard title="Visibility" hint="Who can see this offer, and where it appears.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <div className="flex items-center gap-1.5">
              <Toggle checked={featured} onCheckedChange={setFeatured} label="Set as Featured Offer" />
              <InfoTip>Featured offers appear in the Featured Offers section of the affiliate dashboard.</InfoTip>
            </div>
          </div>

          <div className="sm:col-span-2">
            <div className="flex items-center gap-1.5">
              <Toggle checked={isPublic} onCheckedChange={setIsPublic} label="Public offer" />
              <InfoTip>
                {isPublic
                  ? 'Any affiliate can see and run this offer once it is Approved.'
                  : 'Gated — only affiliates with an approved access request can see or run this offer.'}
              </InfoTip>
            </div>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Field label="Advertiser Network Offer ID (Optional)">
              <Input value={networkOfferId} onChange={(e) => setNetworkOfferId(e.target.value)} />
            </Field>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Destination & Postback"
        hint="Where the Tracker sends clicks, and the credentials the advertiser uses to report conversions back. Only the Destination URL is required to approve the offer."
      >
        {/* Picked from Macros settings. Only used to write the postback URL (shown on the
            offer's page) and to suggest the Destination URL parameter below — nothing is
            added to the Destination URL until the admin clicks Insert. */}
        <Field label="Advertiser network (optional)">
          <select
            value={advertiserNetworkId}
            onChange={(e) => {
              setAdvertiserNetworkId(e.target.value);
              // The old network's click-id parameter no longer applies. Cleared here, not
              // swapped for the new one: the admin adds that with the button below.
              setDestinationUrl((url) => stripClickIdParams(url));
            }}
            className={selectClass}
          >
            <option value="">Other / generic {'{click_id}'}</option>
            {networks.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
          <Help>
            {selectedNetwork ? (
              <>
                {selectedNetwork.name} sends our click id back as <code className="text-foreground">{selectedNetwork.clickIdToken}</code>
                {selectedNetwork.payoutToken && (
                  <>
                    {' '}and the payout as <code className="text-foreground">{selectedNetwork.payoutToken}</code>
                  </>
                )}
                . The postback URL on the offer's page is written with these.
              </>
            ) : (
              'Add networks under Macros settings in the menu. Picking one writes the postback URL in that platform’s syntax.'
            )}
          </Help>
          {selectedNetwork && suggestedParam && !destinationUrl.includes(`${suggestedParam}={click_id}`) && (
            <Button type="button" size="sm" onClick={() => setDestinationUrl((url) => appendClickIdParam(url, suggestedParam))}>
              <Plus className="size-3.5" aria-hidden />
              Add {suggestedParam}={'{click_id}'} to Destination URL
            </Button>
          )}
        </Field>

        <Field label="Destination URL" required>
          <Input value={destinationUrl} onChange={(e) => setDestinationUrl(e.target.value)} placeholder="https://advertiser-tracking-link.com/?s1={click_id}" />
          <Help>
            Stored exactly as you type it. Add {'{click_id}'} yourself, under whichever parameter name the advertiser's
            platform reads — <code className="text-foreground">?s1={'{click_id}'}</code>,{' '}
            <code className="text-foreground">?aff_sub={'{click_id}'}</code>, whatever they call it. Only the macro is
            ours; the parameter name is theirs.
          </Help>
          {/* A warning, not a block: the parameter name is the advertiser's, so there is
              no spelling the server could require without also rejecting correct URLs.
              This is the one place the admin can see the URL while being told. */}
          {destinationUrl.trim() !== '' && !destinationUrl.includes('{click_id}') && (
            <p className="text-xs text-amber-500">
              No {'{click_id}'} in this URL. The advertiser will have no click id to send back, so conversions on this
              offer can never be attributed — every postback will be logged as "Offer not found".
            </p>
          )}
        </Field>

        <Field label="Fallback URL (optional)">
          <Input
            type="url"
            value={fallbackUrl}
            onChange={(e) => setFallbackUrl(e.target.value)}
            placeholder="Leave blank to use the Destination URL"
          />
          <Help>
            Where a click goes if it doesn't match any payout rule's geo/device/OS targeting below. Leave blank to
            send unmatched traffic to the Destination URL anyway.
          </Help>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Postback Secret (optional)">
            <div className="flex gap-2">
              <Input value={postbackSecret} onChange={(e) => setPostbackSecret(e.target.value)} placeholder="Leave blank to use the global postback" />
              <button
                type="button"
                onClick={() => setPostbackSecret(generatePostbackSecret())}
                className="shrink-0 rounded-md border border-border px-3 text-sm hover:bg-accent"
              >
                Generate
              </button>
            </div>
            <Help>
              Credentials for this offer alone. Skip both when the advertiser reports against the network-wide entry under
              Others → Global Postbacks — that is checked independently, and either path is enough to authorise a
              conversion.
            </Help>
          </Field>
          <Field label="Allowed Postback IPs (optional)">
            <Input value={allowedPostbackIps} onChange={(e) => setAllowedPostbackIps(e.target.value)} placeholder="Comma-separated IPs allowed to call /postback" />
          </Field>
        </div>
        {/* Both halves or neither: the service requires a secret *and* an allowlist
            together, so one on its own authorises nothing and silently falls through to
            the global entry — or to a rejection, if there isn't one. */}
        {(postbackSecret.trim() === '') !== (allowedPostbackIps.trim() === '') && (
          <p className="text-xs text-amber-500">
            A per-offer secret only works alongside an IP allowlist, and vice versa. With just one of the two filled
            in, this offer's own credentials authorise nothing and postbacks fall back to the global entry.
          </p>
        )}

        <Field label="Blocked traffic redirect (optional)">
          <Input
            type="url"
            value={blockedRedirectUrl}
            onChange={(e) => setBlockedRedirectUrl(e.target.value)}
            placeholder="Leave blank to use the network default"
          />
          <Help>
            Where clicks scored BLOCKED go instead of the destination URL. Set this only when the advertiser wants
            rejected traffic on a page of their own — otherwise the network-wide setting applies.
          </Help>
        </Field>

        <button type="button" onClick={() => setShowMacros((s) => !s)} className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          View List of Macros/Tokens
          <ChevronDown className={showMacros ? 'size-4 rotate-180 transition-transform' : 'size-4 transition-transform'} />
        </button>
        {showMacros && (
          <div className="space-y-1 rounded-md bg-secondary p-3 text-sm">
            <p>
              <code className="text-foreground">{'{click_id}'}</code>{' '}
              <span className="text-muted-foreground">
                — the unique click identifier, and the one macro that actually matters. Put it in the Destination URL
                under the advertiser&apos;s own parameter name, then have them send that same value back on their
                postback as <code className="text-foreground">click_id</code>. Nothing is added for you: a parameter
                name we guessed would be ignored by their tracker and the conversion would arrive unattributable.
              </span>
            </p>
            <p>
              <code className="text-foreground">{'{payout_amount}'}</code>{' '}
              <span className="text-muted-foreground">
                — the payout for the rule matching this click&apos;s geo/device/OS, substituted at redirect time from
                the offer&apos;s own payout rule. Optional, and worth thinking about before you add it: it puts your
                affiliate payout in the advertiser&apos;s query string, so they can read what you pay per conversion.
              </span>
            </p>
            {/* The macro is resolved at redirect time, before the sale exists. On a
                percentage rule the conversion is then priced from the sale amount the
                advertiser reports, so the two legitimately differ — said plainly here
                because an advertiser querying the mismatch is otherwise a support
                ticket nobody on this screen could answer. */}
            <p className="text-muted-foreground">
              On a percentage or revenue-share offer this is an estimate at the offer&apos;s configured revenue, not
              the final payout: the click happens before the sale, so the real amount is calculated when the advertiser
              posts back with <code className="text-foreground">{'{sum}'}</code>.
            </p>
            <p>
              <code className="text-foreground">{'{sum}'}</code>{' '}
              <span className="text-muted-foreground">
                — not a Destination URL macro. It is the one the advertiser adds to their <em>postback</em> URL,
                carrying the sale amount they are paying you. Required on every postback, and the base a percentage
                payout or a smart-link revenue share is calculated from.
              </span>
            </p>
            <p className="pt-2 font-medium text-foreground">Optional postback tokens</p>
            <p className="text-muted-foreground">
              Also accepted on the postback URL, if the advertiser&apos;s platform can send them — stored on the
              conversion, never used to price it:
            </p>
            <p className="text-muted-foreground">
              <code className="text-foreground">{'{timestamp}'}</code>, <code className="text-foreground">{'{ip}'}</code>,{' '}
              <code className="text-foreground">{'{atlas_code}'}</code>, <code className="text-foreground">{'{custom_parameters}'}</code>,{' '}
              <code className="text-foreground">{'{conversion_id}'}</code>, <code className="text-foreground">{'{conversion_type}'}</code>,{' '}
              <code className="text-foreground">{'{affiliate_username}'}</code>, <code className="text-foreground">{'{network_name}'}</code>,{' '}
              <code className="text-foreground">{'{site_name}'}</code>, <code className="text-foreground">{'{program_name}'}</code>,{' '}
              <code className="text-foreground">{'{campaign_name}'}</code>, <code className="text-foreground">{'{country_code}'}</code>,{' '}
              <code className="text-foreground">{'{device_type}'}</code>, <code className="text-foreground">{'{commission_amount}'}</code>,{' '}
              <code className="text-foreground">{'{user_agent}'}</code>, <code className="text-foreground">{'{prepaid_transactions}'}</code>.
            </p>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Offer Payout Settings" hint="At least one payout rule is required — fill in the fields below and click + Add Payout Rule.">
        <div className="space-y-3">
          {payoutRules.map((rule, i) => (
            <div key={i} className="rounded-md border border-border p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p>
                    Payout Mode: <span className="font-medium text-foreground">{rule.payoutMode}</span> · Payout Type: {rule.payoutType} · Payout:{' '}
                    {rule.payoutType === 'PERCENTAGE' ? `${rule.amount}% of advertiser payout` : `$${rule.amount.toFixed(2)}`}
                  </p>
                  <p>
                    Advertiser Payout Model: <span className="font-medium text-foreground">{rule.revenueModel}</span> · Advertiser payout:{' '}
                    {rule.revenueAmount > 0 ? `$${rule.revenueAmount.toFixed(2)}` : 'varies (from postback)'}
                  </p>
                  <p className="text-muted-foreground">
                    Manager Commission: {rule.managerCommissionPercent}% · Refer Affiliate Commission: {rule.referAffiliateCommissionPercent}%
                  </p>
                  <p className="text-muted-foreground">
                    {rule.targeting.affiliateIds.length > 0
                      ? `Dedicated to ${rule.targeting.affiliateIds.length} affiliate${rule.targeting.affiliateIds.length === 1 ? '' : 's'}`
                      : 'Available to every affiliate'}
                  </p>
                  <p className="text-muted-foreground">
                    Geo: {rule.targeting.countries.length ? rule.targeting.countries.join(', ') : 'All'} · Device:{' '}
                    {rule.targeting.devices.length ? rule.targeting.devices.join(', ') : 'All'} · OS: {rule.targeting.os.length ? rule.targeting.os.join(', ') : 'All'}
                  </p>
                </div>
                <button type="button" onClick={() => removePayoutRule(i)} className="rounded-md border border-destructive/50 px-2 py-1 text-xs text-destructive">
                  Remove
                </button>
              </div>
            </div>
          ))}
          {payoutRules.length === 0 && <p className="text-sm text-muted-foreground">No payout rules yet.</p>}
        </div>

        <div className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-3">
          <Field label="Payout Mode">
            <select
              value={draftRule.payoutMode}
              onChange={(e) => {
                const payoutMode = e.target.value as PayoutMode;
                // PERCENTAGE needs an advertiser-reported base: a sale (CPS) or an
                // install (CPI). Switching to any other mode drops back to FLAT rather
                // than leaving an invalid combination selected.
                setDraftRule((r) => ({ ...r, payoutMode, payoutType: PERCENT_MODES.includes(payoutMode) ? r.payoutType : 'FLAT' }));
              }}
              className={selectClass}
            >
              {PAYOUT_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Payout Type">
            <select
              value={draftRule.payoutType}
              onChange={(e) => setDraftRule((r) => ({ ...r, payoutType: e.target.value as PayoutType }))}
              className={selectClass}
            >
              {PAYOUT_TYPES.filter((t) => t !== 'PERCENTAGE' || PERCENT_MODES.includes(draftRule.payoutMode)).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {!PERCENT_MODES.includes(draftRule.payoutMode) && <Help>Percentage payout is only available for CPS (sale) and CPI (install).</Help>}
          </Field>
          <Field label="Advertiser Payout Model">
            <select value={draftRule.revenueModel} onChange={(e) => setDraftRule((r) => ({ ...r, revenueModel: e.target.value as RevenueModel }))} className={selectClass}>
              {REVENUE_MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>

          {/* The two money fields sit next to each other, named by whose money it is.
              They were a row apart with "Revenue Amount" and "Payout Amount" on either
              side of a dropdown, which said nothing about which side of the margin each
              one was. Everything above this line describes *how* the rule pays; this row
              is *how much*, both directions. */}
          <Field label={isVariableBase ? 'Typical advertiser payout (optional)' : 'Advertiser pays you'}>
            <Input
              type="number"
              step="0.01"
              value={draftRule.revenueAmount || ''}
              onChange={(e) => setDraftRule((r) => ({ ...r, revenueAmount: Number(e.target.value) }))}
            />
            <Help>
              {isVariableBase
                ? 'Leave empty: each conversion uses the amount the advertiser reports on its postback. Only used for the margin preview.'
                : 'Revenue per conversion. Never shown to affiliates.'}
            </Help>
          </Field>
          <Field label={draftRule.payoutType === 'PERCENTAGE' ? 'Affiliate gets (%)' : 'Affiliate gets'} required>
            <Input type="number" step="0.01" value={draftRule.amount || ''} onChange={(e) => setDraftRule((r) => ({ ...r, amount: Number(e.target.value) }))} />
            <Help>
              {draftRule.payoutType === 'PERCENTAGE'
                ? "Percent of whatever the advertiser reports per conversion, e.g. 70 = 70% of each conversion's payout."
                : 'Payout per conversion. This is what the affiliate sees.'}
            </Help>
          </Field>

          {/* Read-only, and only once both sides have a number — the whole point of
              putting them together is seeing what is left, and a negative figure means
              the rule pays out more than it earns. */}
          {draftRule.revenueAmount > 0 && draftRule.amount > 0 && (
            <div className="sm:col-span-3">
              {(() => {
                const payout =
                  draftRule.payoutType === 'PERCENTAGE'
                    ? (draftRule.revenueAmount * draftRule.amount) / 100
                    : draftRule.amount;
                const margin = draftRule.revenueAmount - payout;
                return (
                  <p className={cn('text-xs', margin < 0 ? 'text-destructive' : 'text-muted-foreground')}>
                    Your margin: {margin.toFixed(2)} {currency} per conversion
                    {margin < 0 && ' — this rule pays out more than it earns.'}
                  </p>
                );
              })()}
            </div>
          )}
          <div className="space-y-1.5 sm:col-span-3">
            <div className="flex items-center gap-1.5">
              <label className="text-sm font-medium text-foreground">Dedicate to affiliate(s) (optional)</label>
              <InfoTip>Leave empty to make this rule available to every affiliate. Search by name, email or id.</InfoTip>
            </div>
            <MultiSelectCombobox
              options={affiliateOptions}
              value={draftRule.targeting.affiliateIds}
              onChange={(affiliateIds) => setDraftRule((r) => ({ ...r, targeting: { ...r.targeting, affiliateIds } }))}
              placeholder="All affiliates"
              emptyLabel="Available to every affiliate"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-3">
            <div className="flex items-center gap-1.5">
              <label className="text-sm font-medium text-foreground">Geo targeting (optional)</label>
              <InfoTip>
                Leave empty for all countries. A click outside every rule's geo/device/OS targeting goes to the offer's Fallback URL.
              </InfoTip>
            </div>
            <MultiSelectCombobox
              options={COUNTRY_OPTIONS}
              value={draftRule.targeting.countries}
              onChange={(countries) => setDraftRule((r) => ({ ...r, targeting: { ...r.targeting, countries } }))}
              placeholder="All countries"
              emptyLabel="Available in every country"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Device targeting (optional)</label>
            <div className="flex flex-wrap gap-3 rounded-md border border-border p-3">
              {DEVICE_TYPE_OPTIONS.map((d) => (
                <label key={d} className="flex items-center gap-1.5 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={draftRule.targeting.devices.includes(d)}
                    onChange={(e) =>
                      setDraftRule((r) => ({
                        ...r,
                        targeting: { ...r.targeting, devices: e.target.checked ? [...r.targeting.devices, d] : r.targeting.devices.filter((v) => v !== d) },
                      }))
                    }
                  />
                  {d}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-sm font-medium text-foreground">OS targeting (optional)</label>
            <div className="flex flex-wrap gap-3 rounded-md border border-border p-3">
              {OS_OPTIONS.map((o) => (
                <label key={o} className="flex items-center gap-1.5 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={draftRule.targeting.os.includes(o)}
                    onChange={(e) =>
                      setDraftRule((r) => ({
                        ...r,
                        targeting: { ...r.targeting, os: e.target.checked ? [...r.targeting.os, o] : r.targeting.os.filter((v) => v !== o) },
                      }))
                    }
                  />
                  {o}
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-end sm:col-span-3">
            <button type="button" onClick={addPayoutRule} className="w-full rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
              + Add Payout Rule
            </button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Cap Limit Options" hint="Manage how many conversions, clicks, or payout this offer can accrue using daily, weekly, monthly, or overall limits.">
        <div className="space-y-2">
          {caps.map((cap, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2">
              <select value={cap.period} onChange={(e) => updateCap(i, { period: e.target.value as OfferCapInput['period'] })} className={`${selectClass} w-32`}>
                {CAP_PERIODS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <select value={cap.metric} onChange={(e) => updateCap(i, { metric: e.target.value as OfferCapInput['metric'] })} className={`${selectClass} w-36`}>
                {CAP_METRICS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <Input type="number" min="0" value={cap.limit} onChange={(e) => updateCap(i, { limit: Number(e.target.value) })} className="w-28" />
              <button type="button" onClick={() => removeCap(i)} className="rounded-md border border-destructive/50 px-2 py-1.5 text-xs text-destructive">
                Remove
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addCap} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent">
          + Add New Cap
        </button>
      </SectionCard>

      <section className="rounded-lg border border-border bg-card p-4">
        <button type="button" onClick={() => setShowAdvanced((s) => !s)} className="flex w-full items-center justify-between text-sm font-semibold text-foreground">
          Advanced Options
          <ChevronDown className={showAdvanced ? 'size-4 rotate-180 transition-transform' : 'size-4 transition-transform'} />
        </button>
        {showAdvanced && (
          <div className="mt-4 space-y-3">
            <Toggle checked={autoApproveConversions} onCheckedChange={setAutoApproveConversions} label="Auto-approve conversions" />
            <Toggle checked={allowDeepLinking} onCheckedChange={setAllowDeepLinking} label="Allow deep linking" />
          </div>
        )}
      </section>

      <SectionCard title="Offer Remarks (Optional)" hint="Just for the reminders — put the offer remarks if any.">
        <Field label="Remarks for Admin">
          <textarea
            value={remarksForAdmin}
            onChange={(e) => setRemarksForAdmin(e.target.value)}
            className="h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </Field>
        <Field label="Remarks for Affiliate Manager">
          <textarea
            value={remarksForAffiliateManager}
            onChange={(e) => setRemarksForAffiliateManager(e.target.value)}
            className="h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </Field>
      </SectionCard>

      <div className="flex justify-end">
        <button type="button" disabled={!valid || submitting} onClick={handleSubmit} className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {submitting ? submittingLabel : submitLabel}
        </button>
      </div>
    </div>
  );
}
