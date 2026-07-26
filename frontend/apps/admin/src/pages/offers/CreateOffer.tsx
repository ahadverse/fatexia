import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import type { Advertiser, OfferCapInput, OfferCategory, PayoutMode, PayoutRuleInput, PayoutType, RevenueModel, TrackingPlatform } from '@fatexia/types';
import { Input, Toggle, toast } from '@fatexia/ui';
import { getAdvertisers, createAdvertiser } from '../../lib/advertisers-api';
import { getOfferCategories, createOfferCategory } from '../../lib/offer-categories-api';
import { createOffer } from '../../lib/offers-api';

const PAYOUT_MODES: PayoutMode[] = ['CPA', 'CPC', 'CPL', 'CPI', 'CPS'];
const PAYOUT_TYPES: PayoutType[] = ['FLAT', 'PERCENTAGE'];
const REVENUE_MODELS: RevenueModel[] = ['NONE', 'RPA', 'RPC'];
const TRACKING_PLATFORMS: TrackingPlatform[] = ['DIRECT', 'AFFISE', 'HASOFFERS', 'CAKE', 'OTHER'];
const CAP_PERIODS: OfferCapInput['period'][] = ['DAILY', 'WEEKLY', 'MONTHLY', 'OVERALL'];
const CAP_METRICS: OfferCapInput['metric'][] = ['CLICKS', 'CONVERSIONS', 'PAYOUT'];
const TRAFFIC_TYPE_OPTIONS = ['Search', 'Social', 'Native', 'Email', 'Push', 'Display', 'Incent', 'Non-Incent'];

const EMPTY_RULE: PayoutRuleInput = {
  payoutMode: 'CPA',
  payoutType: 'FLAT',
  amount: 0,
  revenueModel: 'NONE',
  revenueAmount: 0,
  targeting: { countries: [], devices: [], affiliateIds: [], affiliateGroupIds: [] },
  managerCommissionPercent: 0,
  referAffiliateCommissionPercent: 0,
  holdSchedule: { enabled: false, days: 0 },
  commissionPercent: 0,
};

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

const selectClass = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground';

export function CreateOffer() {
  const navigate = useNavigate();
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [categories, setCategories] = useState<OfferCategory[]>([]);
  const [newAdvertiserName, setNewAdvertiserName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showMacros, setShowMacros] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [advertiserId, setAdvertiserId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [kpi, setKpi] = useState('');
  const [category, setCategory] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [defaultPayoutAmount, setDefaultPayoutAmount] = useState('');
  const [trackingPlatform, setTrackingPlatform] = useState<TrackingPlatform>('DIRECT');
  const [trafficTypes, setTrafficTypes] = useState<string[]>([]);
  const [featured, setFeatured] = useState(false);
  const [networkOfferId, setNetworkOfferId] = useState('');

  const [destinationUrl, setDestinationUrl] = useState('');
  const [postbackSecret, setPostbackSecret] = useState('');
  const [allowedPostbackIps, setAllowedPostbackIps] = useState('');
  const [blockedRedirectUrl, setBlockedRedirectUrl] = useState('');

  const [payoutRules, setPayoutRules] = useState<PayoutRuleInput[]>([]);
  const [draftRule, setDraftRule] = useState<PayoutRuleInput>(EMPTY_RULE);

  const [caps, setCaps] = useState<OfferCapInput[]>([]);

  const [autoApproveConversions, setAutoApproveConversions] = useState(false);
  const [allowDeepLinking, setAllowDeepLinking] = useState(false);
  const [remarksForAdmin, setRemarksForAdmin] = useState('');
  const [remarksForAffiliateManager, setRemarksForAffiliateManager] = useState('');

  useEffect(() => {
    getAdvertisers().then(setAdvertisers);
    getOfferCategories().then(setCategories);
  }, []);

  const valid = name.trim().length > 0 && !!advertiserId && payoutRules.length > 0;

  async function handleAddAdvertiser() {
    if (!newAdvertiserName.trim()) return;
    const created = await createAdvertiser({ name: newAdvertiserName.trim() });
    setAdvertisers((prev) => [...prev, created]);
    setAdvertiserId(created.id);
    setNewAdvertiserName('');
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
      await createOffer({
        advertiserId,
        name,
        description: description || undefined,
        kpi: kpi || undefined,
        category: category || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        currency,
        defaultPayoutAmount: Number(defaultPayoutAmount) || 0,
        trackingPlatform,
        trafficTypes,
        featured,
        networkOfferId: networkOfferId || undefined,
        autoApproveConversions,
        allowDeepLinking,
        remarksForAdmin: remarksForAdmin || undefined,
        remarksForAffiliateManager: remarksForAffiliateManager || undefined,
        destinationUrl: destinationUrl || undefined,
        postbackSecret: postbackSecret || undefined,
        allowedPostbackIps: allowedPostbackIps || undefined,
        blockedRedirectUrl: blockedRedirectUrl || undefined,
        payoutRules,
        caps,
      });
      toast.success('Offer created');
      navigate('/offers/all');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create offer');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-2xl font-semibold">Create Offer</h1>

      <SectionCard title="Basic Details">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-sm font-medium text-foreground">Advertiser</label>
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
            <Field label="Title">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Example: My US Offer" />
            </Field>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Field label="Description">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
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

          <Field label="Tracking Platform">
            <select value={trackingPlatform} onChange={(e) => setTrackingPlatform(e.target.value as TrackingPlatform)} className={selectClass}>
              {TRACKING_PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>

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
        <Field label="Destination URL">
          <Input value={destinationUrl} onChange={(e) => setDestinationUrl(e.target.value)} placeholder="https://advertiser-landing-page.com?click_id={click_id}" />
          <p className="text-xs text-muted-foreground">Must contain the {'{click_id}'} macro.</p>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Postback Secret">
            <Input value={postbackSecret} onChange={(e) => setPostbackSecret(e.target.value)} placeholder="Shared secret the advertiser sends back on /postback" />
          </Field>
          <Field label="Allowed Postback IPs">
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
              <code className="text-foreground">{'{click_id}'}</code> <span className="text-muted-foreground">— unique click identifier, required in destinationUrl</span>
            </p>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Offer Payout Settings">
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
            <select value={draftRule.payoutMode} onChange={(e) => setDraftRule((r) => ({ ...r, payoutMode: e.target.value as PayoutMode }))} className={selectClass}>
              {PAYOUT_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Payout Type">
            <select value={draftRule.payoutType} onChange={(e) => setDraftRule((r) => ({ ...r, payoutType: e.target.value as PayoutType }))} className={selectClass}>
              {PAYOUT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Payout Amount">
            <Input type="number" step="0.01" value={draftRule.amount || ''} onChange={(e) => setDraftRule((r) => ({ ...r, amount: Number(e.target.value) }))} />
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
          <Field label="Revenue Amount">
            <Input type="number" step="0.01" value={draftRule.revenueAmount || ''} onChange={(e) => setDraftRule((r) => ({ ...r, revenueAmount: Number(e.target.value) }))} />
          </Field>
          <div className="flex items-end">
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
          {submitting ? 'Creating…' : 'Create Offer'}
        </button>
      </div>
    </div>
  );
}
