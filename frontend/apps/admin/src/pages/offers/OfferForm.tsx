import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Advertiser, Affiliate, CreateOfferInput, Offer, OfferCapInput, OfferCategory, OfferStatus, PayoutMode, PayoutRuleInput, PayoutType, RevenueModel } from '@fatexia/types';
import { COUNTRY_CODES } from '@fatexia/types';
import { Input, MultiSelectCombobox, Toggle, cn, toast } from '@fatexia/ui';
import { getAdvertisers, createAdvertiser } from '../../lib/advertisers-api';
import { getOfferCategories, createOfferCategory } from '../../lib/offer-categories-api';
import { getAffiliates } from '../../lib/affiliates-api';
import { uploadOfferThumbnail } from '../../lib/offers-api';
import { RichTextEditor } from '../../components/RichTextEditor';

const PAYOUT_MODES: PayoutMode[] = ['CPA', 'CPC', 'CPL', 'CPI', 'CPS'];
const PAYOUT_TYPES: PayoutType[] = ['FLAT', 'PERCENTAGE'];
const REVENUE_MODELS: RevenueModel[] = ['NONE', 'RPA', 'RPC', 'RPS'];
// Matches UAParser's device.type taxonomy plus the "desktop" fallback click.service.ts
// applies — the exact same values a click's deviceType is stored as.
const DEVICE_TYPE_OPTIONS = ['desktop', 'mobile', 'tablet', 'console', 'smarttv', 'wearable', 'embedded'];
// UAParser's os.name is free text, not a closed enum — this is the common subset
// worth targeting on. A rule matches by exact string, so this must stay in sync with
// what UAParser actually reports for these platforms.
const OS_OPTIONS = ['Windows', 'Mac OS', 'iOS', 'Android', 'Linux', 'Chrome OS'];
const COUNTRY_OPTIONS = COUNTRY_CODES.map((c) => ({ value: c.code, label: c.name, sublabel: c.code }));
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

// 24 random bytes (192 bits) as hex, "sk_"-prefixed so it reads unambiguously as a
// secret rather than some other id when it shows up in logs or the postback URL.
function generatePostbackSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `sk_${hex}`;
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
    featured: offer.featured,
    networkOfferId: offer.networkOfferId,
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
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </label>
      {children}
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
  const [description, setDescription] = useState(initial?.description ?? '');
  const [kpi, setKpi] = useState(initial?.kpi ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [startDate, setStartDate] = useState(initial?.startDate ?? '');
  const [endDate, setEndDate] = useState(initial?.endDate ?? '');
  const [currency, setCurrency] = useState(initial?.currency ?? 'USD');
  const [defaultPayoutAmount, setDefaultPayoutAmount] = useState(initial ? String(initial.defaultPayoutAmount || '') : '');
  const [status, setStatus] = useState<OfferStatus>(initialStatus ?? 'PENDING');
  const [trafficTypes, setTrafficTypes] = useState<string[]>(initial?.trafficTypes ?? []);
  const [featured, setFeatured] = useState(initial?.featured ?? false);
  const [networkOfferId, setNetworkOfferId] = useState(initial?.networkOfferId ?? '');
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

  const [caps, setCaps] = useState<OfferCapInput[]>(initial?.caps ?? []);

  const [autoApproveConversions, setAutoApproveConversions] = useState(initial?.autoApproveConversions ?? false);
  const [allowDeepLinking, setAllowDeepLinking] = useState(initial?.allowDeepLinking ?? false);
  const [remarksForAdmin, setRemarksForAdmin] = useState(initial?.remarksForAdmin ?? '');
  const [remarksForAffiliateManager, setRemarksForAffiliateManager] = useState(initial?.remarksForAffiliateManager ?? '');

  useEffect(() => {
    getAdvertisers().then(setAdvertisers);
    getOfferCategories().then(setCategories);
    // Swallowed rather than surfaced: a manager can hold offers.create without
    // affiliates.view, and a 403 here should cost them the "dedicate to affiliate"
    // dropdown, not block the whole offer form with an error toast.
    getAffiliates()
      .then(setAffiliates)
      .catch(() => setAffiliates([]));
  }, []);

  const affiliateOptions = affiliates.map((a) => ({ value: a.id, label: a.fullName ?? a.email, sublabel: a.email }));

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

  function addPayoutRule() {
    // Message names the field as it is labelled on screen. It used to say "Payout
    // Amount", which stopped matching anything visible when the fields were renamed.
    if (draftRule.amount <= 0) {
      toast.error('Fill in "Affiliate gets" before adding the rule');
      return;
    }
    // A percentage rule with no base silently computes a zero payout on every
    // conversion, and nothing downstream would flag it.
    if (draftRule.payoutType === 'PERCENTAGE' && draftRule.revenueAmount <= 0) {
      toast.error('A percentage rule needs "Advertiser pays you" to take the percentage from');
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
          featured,
          networkOfferId: networkOfferId || undefined,
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
            <p className="text-xs text-muted-foreground">
              Informational only — the Offers list and actual payouts are driven by the payout rules below, not this field.
            </p>
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
              <p className="text-xs text-muted-foreground">
                Approving requires the Destination URL, Postback Secret and Allowed Postback IPs below to be filled in
                first.
              </p>
            )}
          </Field>

          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-sm font-medium text-foreground">Traffic Allowed</label>
            <div className="flex flex-wrap gap-3 rounded-md border border-border p-3">
              {TRAFFIC_TYPE_OPTIONS.map((t) => (
                <label key={t} className="flex items-center gap-1.5 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={trafficTypes.includes(t)}
                    onChange={(e) => setTrafficTypes((types) => (e.target.checked ? [...types, t] : types.filter((v) => v !== t)))}
                  />
                  {t}
                </label>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2">
            <Toggle checked={featured} onCheckedChange={setFeatured} label="Set as Featured Offer" />
            <p className="mt-1 text-xs text-muted-foreground">Featured offers appear in the Featured Offers section of the affiliate dashboard.</p>
          </div>

          <div className="sm:col-span-2">
            <Toggle checked={isPublic} onCheckedChange={setIsPublic} label="Public offer" />
            <p className="mt-1 text-xs text-muted-foreground">
              {isPublic
                ? 'Any affiliate can see and run this offer once it is Approved.'
                : 'Gated — only affiliates with an approved access request can see or run this offer.'}
            </p>
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
        hint="Where the Tracker sends clicks, and the credentials the advertiser uses to report conversions back. All three are required before this offer can go Approved."
      >
        <Field label="Destination URL" required>
          <Input value={destinationUrl} onChange={(e) => setDestinationUrl(e.target.value)} placeholder="https://advertiser-landing-page.com/lp" />
          <p className="text-xs text-muted-foreground">
            Just the landing page — {'{click_id}'} and {'{payout_amount}'} are appended automatically on save. Write
            them in yourself only when the advertiser needs them under different parameter names; whatever you type is
            kept as-is.
          </p>
        </Field>

        <Field label="Fallback URL (optional)">
          <Input
            type="url"
            value={fallbackUrl}
            onChange={(e) => setFallbackUrl(e.target.value)}
            placeholder="Leave blank to use the Destination URL"
          />
          <p className="text-xs text-muted-foreground">
            Where a click goes if it doesn't match any payout rule's geo/device/OS targeting below. Leave blank to
            send unmatched traffic to the Destination URL anyway.
          </p>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Postback Secret" required>
            <div className="flex gap-2">
              <Input value={postbackSecret} onChange={(e) => setPostbackSecret(e.target.value)} placeholder="Shared secret the advertiser sends back on /postback" />
              <button
                type="button"
                onClick={() => setPostbackSecret(generatePostbackSecret())}
                className="shrink-0 rounded-md border border-border px-3 text-sm hover:bg-accent"
              >
                Generate
              </button>
            </div>
          </Field>
          <Field label="Allowed Postback IPs" required>
            <Input value={allowedPostbackIps} onChange={(e) => setAllowedPostbackIps(e.target.value)} placeholder="Comma-separated IPs allowed to call /postback" />
          </Field>
        </div>

        <Field label="Blocked traffic redirect (optional)">
          <Input
            type="url"
            value={blockedRedirectUrl}
            onChange={(e) => setBlockedRedirectUrl(e.target.value)}
            placeholder="Leave blank to use the network default"
          />
          <p className="text-xs text-muted-foreground">
            Where clicks scored BLOCKED go instead of the destination URL. Set this only when the advertiser wants
            rejected traffic on a page of their own — otherwise the network-wide setting applies.
          </p>
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
                — the unique click identifier. Added to the Destination URL for you if you don&apos;t type it, and it is
                what the advertiser must send back on the postback for a conversion to be attributed.
              </span>
            </p>
            <p>
              <code className="text-foreground">{'{payout_amount}'}</code>{' '}
              <span className="text-muted-foreground">
                — the payout for the rule matching this click&apos;s geo/device/OS, substituted at redirect time and
                always computed from the offer&apos;s own payout rule, never trusted from an inbound call. Also added
                automatically. Worth knowing: this puts your affiliate payout in the advertiser&apos;s query string,
                so they can read what you pay per conversion.
              </span>
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
                    Payout Mode: <span className="font-medium text-foreground">{rule.payoutMode}</span> · Payout Type: {rule.payoutType} · Payout: ${rule.amount.toFixed(2)}
                  </p>
                  <p>
                    Revenue Model: <span className="font-medium text-foreground">{rule.revenueModel}</span> · Revenue: ${rule.revenueAmount.toFixed(2)}
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
                // PERCENTAGE only makes sense for CPS (a sale has a value to take a %
                // of; a lead/click/install doesn't) — switching away from CPS drops
                // back to FLAT rather than leaving an invalid combination selected.
                setDraftRule((r) => ({ ...r, payoutMode, payoutType: payoutMode === 'CPS' ? r.payoutType : 'FLAT' }));
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
              {PAYOUT_TYPES.filter((t) => t !== 'PERCENTAGE' || draftRule.payoutMode === 'CPS').map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {draftRule.payoutMode !== 'CPS' && (
              <p className="text-xs text-muted-foreground">Percentage payout is only available for CPS (Cost Per Sale).</p>
            )}
          </Field>
          <Field label="Revenue Model">
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
          <Field label="Advertiser pays you" required={draftRule.payoutType === 'PERCENTAGE'}>
            <Input
              type="number"
              step="0.01"
              value={draftRule.revenueAmount || ''}
              onChange={(e) => setDraftRule((r) => ({ ...r, revenueAmount: Number(e.target.value) }))}
            />
            <p className="text-xs text-muted-foreground">
              {draftRule.payoutType === 'PERCENTAGE'
                ? 'The sale value the affiliate percentage is taken from.'
                : 'Revenue per conversion. Never shown to affiliates.'}
            </p>
          </Field>
          <Field label={draftRule.payoutType === 'PERCENTAGE' ? 'Affiliate gets (%)' : 'Affiliate gets'} required>
            <Input type="number" step="0.01" value={draftRule.amount || ''} onChange={(e) => setDraftRule((r) => ({ ...r, amount: Number(e.target.value) }))} />
            <p className="text-xs text-muted-foreground">
              {draftRule.payoutType === 'PERCENTAGE'
                ? 'Percent of the advertiser amount, e.g. 20 = 20%.'
                : 'Payout per conversion. This is what the affiliate sees.'}
            </p>
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
            <label className="text-sm font-medium text-foreground">Dedicate to affiliate(s) (optional)</label>
            <p className="text-xs text-muted-foreground">Leave empty to make this rule available to every affiliate. Search by name, email or id.</p>
            <MultiSelectCombobox
              options={affiliateOptions}
              value={draftRule.targeting.affiliateIds}
              onChange={(affiliateIds) => setDraftRule((r) => ({ ...r, targeting: { ...r.targeting, affiliateIds } }))}
              placeholder="All affiliates"
              emptyLabel="Available to every affiliate"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-3">
            <label className="text-sm font-medium text-foreground">Geo targeting (optional)</label>
            <p className="text-xs text-muted-foreground">
              Leave empty for all countries. A click outside every rule's geo/device/OS targeting goes to the offer's Fallback URL.
            </p>
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
