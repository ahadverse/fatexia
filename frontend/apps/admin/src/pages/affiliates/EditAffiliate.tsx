import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Input, PageHeader, PayoutMethodFields, Select, Skeleton, Textarea, toast } from '@fatexia/ui';
import { readCryptoDetails } from '@fatexia/types';
import type {
  Affiliate,
  AffiliateMessenger,
  AffiliatePayoutMethod,
  CryptoPayoutDetails,
  Manager,
} from '@fatexia/types';
import { getAffiliate, updateAffiliate } from '../../lib/affiliates-api';
import { getManagers } from '../../lib/managers-api';
import { useAsync } from '../../hooks/useAsync';
import { useAccess } from '../../session/AccessContext';

const TRAFFIC_SOURCES = ['Facebook', 'Google', 'Native', 'Push', 'Pop', 'Email', 'SEO', 'Influencer'];
const VERTICALS = [
  'Finance',
  'Nutra & Health',
  'Sweepstakes',
  'Dating',
  'Mobile Content',
  'iGaming',
  'E-commerce',
  'Insurance',
  'Software & VPN',
  'Lead Gen',
];
const MONTHLY_VOLUMES = ['Just starting out', 'Under $1k / mo', '$1k-$10k / mo', '$10k-$50k / mo', '$50k+ / mo'];

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-card-foreground">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={wide ? 'block sm:col-span-2' : 'block'}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function ChipGroup({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (value: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const active = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => onToggle(option)}
            aria-pressed={active}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              active ? 'border-primary bg-primary/15 text-foreground' : 'border-border text-muted-foreground hover:border-muted-foreground'
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Issue #7's other half.
 *
 * Taking payout details away from the affiliate only works if someone else can
 * actually set them — before this page there was nowhere in the portal to change an
 * existing affiliate's payout method at all, so "contact your manager" led nowhere.
 *
 * Manager reassignment is admin-only (issue #5): a manager editing their own affiliate
 * sees who owns the account but cannot move it off their book, and the server rejects
 * the field even if it were sent.
 */
export function EditAffiliate() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin, can } = useAccess();
  const affiliate = useAsync<Affiliate>(() => getAffiliate(id!), [id]);
  const managers = useAsync<Manager[]>(() => getManagers(), []);
  const canEditPayout = can('affiliates.payout');

  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [country, setCountry] = useState('');
  const [phone, setPhone] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [messengerType, setMessengerType] = useState<AffiliateMessenger>('TELEGRAM');
  const [messengerHandle, setMessengerHandle] = useState('');
  const [trafficSources, setTrafficSources] = useState<string[]>([]);
  const [verticals, setVerticals] = useState<string[]>([]);
  const [monthlyVolume, setMonthlyVolume] = useState('');
  const [assignedManagerId, setAssignedManagerId] = useState('');
  const [payoutMethod, setPayoutMethod] = useState<AffiliatePayoutMethod | ''>('');
  const [payoutDetails, setPayoutDetails] = useState<CryptoPayoutDetails>(readCryptoDetails(undefined));
  const [postbackUrl, setPostbackUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const data = affiliate.data;
    if (!data) return;
    setFullName(data.fullName ?? '');
    setCompanyName(data.companyName ?? '');
    setCountry(data.country ?? '');
    setPhone(data.phone ?? '');
    setWebsiteUrl(data.websiteUrl ?? '');
    setMessengerType(data.messengerType ?? 'TELEGRAM');
    setMessengerHandle(data.messengerHandle ?? '');
    setTrafficSources(data.trafficSources);
    setVerticals(data.verticals);
    setMonthlyVolume(data.monthlyVolume ?? '');
    setAssignedManagerId(data.assignedManagerId ?? '');
    setPayoutMethod(data.payoutMethod ?? '');
    setPayoutDetails(readCryptoDetails(data.payoutDetails));
    setPostbackUrl(data.postbackUrl ?? '');
    setNotes(data.notes ?? '');
  }, [affiliate.data]);

  function toggle(list: string[], setList: (next: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!id) return;
    setSaving(true);
    try {
      await updateAffiliate(id, {
        fullName,
        country,
        companyName: companyName || undefined,
        phone: phone || undefined,
        // A bare domain fails the server's URL check, so a scheme is added rather than
        // bouncing the whole form back for it.
        websiteUrl: websiteUrl ? (websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`) : undefined,
        messengerType,
        messengerHandle: messengerHandle || undefined,
        trafficSources,
        verticals,
        monthlyVolume: monthlyVolume || undefined,
        // Only sent by an admin — the server rejects a manager trying to reassign.
        ...(isAdmin && { assignedManagerId: assignedManagerId || null }),
        // Omitted entirely without the grant, so a manager saving a phone-number fix
        // never silently rewrites payout fields they weren't allowed to see change.
        ...(canEditPayout && {
          payoutMethod: payoutMethod || null,
          // Only crypto has structured details; sending a stale wallet address next to
          // a bank-transfer payout would leave a live address on the record.
          payoutDetails: payoutMethod === 'CRYPTO' ? { ...payoutDetails } : {},
        }),
        postbackUrl: postbackUrl || undefined,
        notes: notes || undefined,
      });
      toast.success('Affiliate updated');
      navigate('/affiliates/all');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update affiliate');
    } finally {
      setSaving(false);
    }
  }

  if (affiliate.loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Edit affiliate" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (affiliate.error || !affiliate.data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Edit affiliate" />
        <p className="text-sm text-destructive">{affiliate.error ?? 'Affiliate not found.'}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <PageHeader
        title={affiliate.data.fullName ?? affiliate.data.email}
        description={`${affiliate.data.publicId ?? 'No ID'} · ${affiliate.data.email}`}
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => navigate('/affiliates/all')}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </>
        }
      />

      <Section title="Contact">
        <Field label="Full name">
          <Input required minLength={2} value={fullName} onChange={(event) => setFullName(event.target.value)} />
        </Field>
        <Field label="Company">
          <Input value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
        </Field>
        <Field label="Country">
          <Input required minLength={2} value={country} onChange={(event) => setCountry(event.target.value)} />
        </Field>
        <Field label="Phone">
          <Input value={phone} onChange={(event) => setPhone(event.target.value)} />
        </Field>
        <Field label="Messenger">
          <Select value={messengerType} onChange={(event) => setMessengerType(event.target.value as AffiliateMessenger)}>
            <option value="TELEGRAM">Telegram</option>
            <option value="SKYPE">Skype</option>
            <option value="WHATSAPP">WhatsApp</option>
          </Select>
        </Field>
        <Field label="Messenger handle">
          <Input value={messengerHandle} onChange={(event) => setMessengerHandle(event.target.value)} />
        </Field>
        <Field label="Website" wide>
          <Input value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} placeholder="example.com" />
        </Field>
      </Section>

      <Section
        title="Ownership"
        hint={
          isAdmin
            ? 'Which manager owns this affiliate. Unassigned means they sit under the admin directly.'
            : 'This affiliate is on your book. Only an admin can move them to another manager.'
        }
      >
        <Field label="Assigned manager">
          {isAdmin ? (
            <Select value={assignedManagerId} onChange={(event) => setAssignedManagerId(event.target.value)}>
              <option value="">Admin (unassigned)</option>
              {(managers.data ?? []).map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.publicId ? `${manager.publicId} · ` : ''}
                  {manager.fullName ?? manager.email}
                </option>
              ))}
            </Select>
          ) : (
            <p className="text-sm text-card-foreground">
              {(managers.data ?? []).find((manager) => manager.id === assignedManagerId)?.fullName ?? 'You'}
            </p>
          )}
        </Field>
      </Section>

      <Section title="Traffic profile">
        <Field label="Traffic sources" wide>
          <ChipGroup options={TRAFFIC_SOURCES} selected={trafficSources} onToggle={(value) => toggle(trafficSources, setTrafficSources, value)} />
        </Field>
        <Field label="Verticals" wide>
          <ChipGroup options={VERTICALS} selected={verticals} onToggle={(value) => toggle(verticals, setVerticals, value)} />
        </Field>
        <Field label="Estimated monthly volume">
          <Select value={monthlyVolume} onChange={(event) => setMonthlyVolume(event.target.value)}>
            <option value="">Not specified</option>
            {MONTHLY_VOLUMES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </Field>
      </Section>

      <Section
        title="Payout"
        hint={
          canEditPayout
            ? 'Affiliates cannot set this themselves — they ask you. Crypto needs a coin, a network and a wallet address.'
            : 'Read-only: your account does not have permission to change payout details.'
        }
      >
        {canEditPayout ? (
          <PayoutMethodFields method={payoutMethod} details={payoutDetails} onMethodChange={setPayoutMethod} onDetailsChange={setPayoutDetails} />
        ) : (
          <Field label="Current method" wide>
            <p className="text-sm text-card-foreground">{payoutMethod || 'Not set'}</p>
          </Field>
        )}
      </Section>

      <Section title="Tracking &amp; notes">
        <Field label="Postback URL" wide>
          <Input
            value={postbackUrl}
            onChange={(event) => setPostbackUrl(event.target.value)}
            placeholder="https://their-tracker.com/cb?click_id={click_id}&payout={payout}&status={status}"
          />
        </Field>
        <Field label="Internal notes" wide>
          <Textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
      </Section>
    </form>
  );
}
