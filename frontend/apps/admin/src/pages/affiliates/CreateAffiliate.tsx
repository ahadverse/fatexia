import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, PageHeader, PayoutMethodFields, Select, Textarea, toast } from '@fatexia/ui';
import { readCryptoDetails } from '@fatexia/types';
import type { AffiliateMessenger, AffiliatePayoutMethod, CryptoPayoutDetails, Manager, UserStatus } from '@fatexia/types';
import { createAffiliate } from '../../lib/affiliates-api';
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

// Chip multi-select — the same closed lists the public register form uses, so an
// admin-created affiliate carries the same shape of profile as a self-registered one.
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
              active
                ? 'border-primary bg-primary/15 text-foreground'
                : 'border-border text-muted-foreground hover:border-muted-foreground'
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

export function CreateAffiliate() {
  const navigate = useNavigate();
  const { isAdmin, can } = useAccess();
  // Only an admin gets to choose — an affiliate a manager creates is always theirs
  // (issue #5), which the server enforces regardless of what this form sends.
  const managers = useAsync<Manager[]>(() => (isAdmin ? getManagers() : Promise.resolve([])), [isAdmin]);
  const canSetPayout = can('affiliates.payout');
  const [assignedManagerId, setAssignedManagerId] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
  const [payoutMethod, setPayoutMethod] = useState<AffiliatePayoutMethod | ''>('');
  const [payoutDetails, setPayoutDetails] = useState<CryptoPayoutDetails>(readCryptoDetails(undefined));
  const [postbackUrl, setPostbackUrl] = useState('');
  const [status, setStatus] = useState<UserStatus>('ACTIVE');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  function toggle(list: string[], setList: (next: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const affiliate = await createAffiliate({
        email,
        password,
        fullName,
        country,
        companyName: companyName || undefined,
        phone: phone || undefined,
        // A bare domain fails the server's URL check, so a scheme is added rather
        // than bouncing the whole form back for it.
        websiteUrl: websiteUrl ? (websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`) : undefined,
        messengerType,
        messengerHandle: messengerHandle || undefined,
        trafficSources,
        verticals,
        monthlyVolume: monthlyVolume || undefined,
        ...(isAdmin && { assignedManagerId: assignedManagerId || null }),
        ...(canSetPayout && {
          payoutMethod: payoutMethod || null,
          // Only crypto has structured details, and sending a stale wallet address
          // alongside a bank-transfer payout would leave a live address on the record.
          payoutDetails: payoutMethod === 'CRYPTO' ? { ...payoutDetails } : {},
        }),
        postbackUrl: postbackUrl || undefined,
        notes: notes || undefined,
        status,
      });
      toast.success(`${affiliate.fullName ?? affiliate.email} created`);
      navigate('/affiliates/all');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create affiliate');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <PageHeader
        title="Create affiliate"
        description="Provisions the login and the affiliate profile together. Unlike self-registration this starts active by default."
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => navigate('/affiliates/all')}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Creating…' : 'Create affiliate'}
            </Button>
          </>
        }
      />

      <Section title="Account" hint="These are the credentials the affiliate signs in with.">
        <Field label="Email">
          <Input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>
        <Field label="Password (minimum 8 characters)">
          <Input type="text" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} />
        </Field>
        <Field label="Account status">
          <Select value={status} onChange={(event) => setStatus(event.target.value as UserStatus)}>
            <option value="ACTIVE">Active — can log in immediately</option>
            <option value="PENDING">Pending — blocked until approved</option>
          </Select>
        </Field>
        {isAdmin ? (
          <Field label="Assigned manager">
            <Select value={assignedManagerId} onChange={(event) => setAssignedManagerId(event.target.value)}>
              <option value="">Admin (unassigned)</option>
              {(managers.data ?? []).map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.publicId ? `${manager.publicId} · ` : ''}
                  {manager.fullName ?? manager.email}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field label="Assigned manager">
            <p className="text-sm text-card-foreground">You — affiliates you create join your own book.</p>
          </Field>
        )}
      </Section>

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

      <Section title="Traffic profile">
        <Field label="Traffic sources" wide>
          <ChipGroup
            options={TRAFFIC_SOURCES}
            selected={trafficSources}
            onToggle={(value) => toggle(trafficSources, setTrafficSources, value)}
          />
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

      {/* Affiliates cannot set this themselves (issue #7), so whoever creates the
          account is the first person who can — provided they hold the grant. */}
      {canSetPayout && (
        <Section title="Payout" hint="How this affiliate gets paid. Crypto needs a coin, a network and a wallet address.">
          <PayoutMethodFields
            method={payoutMethod}
            details={payoutDetails}
            onMethodChange={setPayoutMethod}
            onDetailsChange={setPayoutDetails}
          />
        </Section>
      )}

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
