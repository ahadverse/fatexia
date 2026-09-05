import { useEffect, useState } from 'react';
import { Button, ConfirmModal, Input, PageHeader, Select, Skeleton, toast } from '@fatexia/ui';
import type { Affiliate, AffiliateMessenger } from '@fatexia/types';
import { getOwnProfile, updateOwnProfile } from '../../lib/portal-api';
import { apiFetch } from '../../lib/api';
import { useAsync } from '../../hooks/useAsync';
import { useSession } from '../../session/SessionContext';
import { dateTime } from '../../lib/format';
import { StatusPill } from '../../components/StatusPill';

interface ContactForm {
  fullName: string;
  companyName: string;
  country: string;
  phone: string;
  websiteUrl: string;
  messengerType: AffiliateMessenger;
  messengerHandle: string;
}

const PAYOUT_METHOD_LABEL: Record<string, string> = {
  BANK_TRANSFER: 'Bank transfer',
  PAYPAL: 'PayPal',
  CRYPTO: 'Cryptocurrency',
};

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-card-foreground">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

// Self-service profile. The manager assignment and account status are shown read-only
// — an affiliate cannot reassign their own manager (PLAN-affiliate-portal.md), and the
// server rejects it even if the field were sent.
export function Profile() {
  const { user, logout } = useSession();
  const profile = useAsync<Affiliate>(() => getOwnProfile(), []);
  const [form, setForm] = useState<ContactForm | null>(null);
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [confirmPasswordChange, setConfirmPasswordChange] = useState(false);

  useEffect(() => {
    if (!profile.data) return;
    setForm({
      fullName: profile.data.fullName ?? '',
      companyName: profile.data.companyName ?? '',
      country: profile.data.country ?? '',
      phone: profile.data.phone ?? '',
      websiteUrl: profile.data.websiteUrl ?? '',
      messengerType: profile.data.messengerType ?? 'TELEGRAM',
      messengerHandle: profile.data.messengerHandle ?? '',
    });
  }, [profile.data]);

  function set<K extends keyof ContactForm>(key: K, value: ContactForm[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  async function save(): Promise<boolean> {
    if (!form) return false;
    setSaving(true);
    try {
      await updateOwnProfile({
        fullName: form.fullName,
        companyName: form.companyName,
        country: form.country,
        phone: form.phone,
        // A bare domain fails the server's URL check, so a scheme is added rather
        // than bouncing the form back for it.
        websiteUrl: form.websiteUrl ? (form.websiteUrl.startsWith('http') ? form.websiteUrl : `https://${form.websiteUrl}`) : '',
        messengerType: form.messengerType,
        messengerHandle: form.messengerHandle,
      });
      toast.success('Profile saved');
      profile.reload();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save profile');
      return false;
    } finally {
      setSaving(false);
    }
  }

  function handlePasswordSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('The new passwords do not match');
      return;
    }
    setConfirmPasswordChange(true);
  }

  async function changePassword() {
    setChangingPassword(true);
    try {
      await apiFetch('/users/me/password', { method: 'PATCH', body: JSON.stringify({ currentPassword, newPassword }) });
      toast.success('Password changed. Sign in again with the new one.');
      logout();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to change password');
      setChangingPassword(false);
      setConfirmPasswordChange(false);
    }
  }

  if (profile.loading || !form) {
    return (
      <div className="space-y-6">
        <PageHeader title="Profile" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile"
        description="Your contact and payout details."
        actions={
          <Button disabled={saving} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        }
      />

      <Section title="Account" hint="These are set by the network and cannot be changed here.">
        {/* Quote this, not the internal UUID, when contacting support (issue #21). */}
        <Field label="Affiliate ID">
          <p className="font-mono text-sm font-semibold text-card-foreground">{profile.data?.publicId ?? '—'}</p>
        </Field>
        <Field label="Email">
          <p className="text-sm text-card-foreground">{user?.email ?? '—'}</p>
        </Field>
        <Field label="Account status">
          <div>{profile.data && <StatusPill status={profile.data.status} />}</div>
        </Field>
        <Field label="Referral code">
          <p className="font-mono text-sm text-card-foreground">{profile.data?.referralCode ?? '—'}</p>
        </Field>
        <Field label="Last login">
          <p className="text-sm text-card-foreground">{dateTime(profile.data?.lastLogin ?? null)}</p>
        </Field>
      </Section>

      <Section title="Contact">
        <Field label="Full name">
          <Input value={form.fullName} onChange={(event) => set('fullName', event.target.value)} />
        </Field>
        <Field label="Company">
          <Input value={form.companyName} onChange={(event) => set('companyName', event.target.value)} />
        </Field>
        <Field label="Country">
          <Input value={form.country} onChange={(event) => set('country', event.target.value)} />
        </Field>
        <Field label="Phone">
          <Input value={form.phone} onChange={(event) => set('phone', event.target.value)} />
        </Field>
        <Field label="Website">
          <Input value={form.websiteUrl} onChange={(event) => set('websiteUrl', event.target.value)} placeholder="example.com" />
        </Field>
        <Field label="Messenger">
          <Select value={form.messengerType} onChange={(event) => set('messengerType', event.target.value as AffiliateMessenger)}>
            <option value="TELEGRAM">Telegram</option>
            <option value="SKYPE">Skype</option>
            <option value="WHATSAPP">WhatsApp</option>
          </Select>
        </Field>
        <Field label="Messenger handle">
          <Input value={form.messengerHandle} onChange={(event) => set('messengerHandle', event.target.value)} />
        </Field>
      </Section>

      <Section title="Payout method" hint="Only your manager or admin can change this — contact them to update where your payouts are sent.">
        <Field label="Method">
          <p className="text-sm text-card-foreground">
            {profile.data?.payoutMethod ? PAYOUT_METHOD_LABEL[profile.data.payoutMethod] ?? profile.data.payoutMethod : 'Not set'}
          </p>
        </Field>
        <Field label="Details">
          <p className="text-sm text-card-foreground">
            {profile.data?.payoutMethod === 'PAYPAL' && String(profile.data.payoutDetails?.paypalEmail ?? '—')}
            {profile.data?.payoutMethod === 'BANK_TRANSFER' && `Account ending ${String(profile.data.payoutDetails?.accountLast4 ?? '····')}`}
            {profile.data?.payoutMethod === 'CRYPTO' &&
              `${String(profile.data.payoutDetails?.cryptoCurrency ?? '')} (${String(profile.data.payoutDetails?.cryptoNetwork ?? '')})`}
            {!profile.data?.payoutMethod && '—'}
          </p>
        </Field>
      </Section>

      <form onSubmit={handlePasswordSubmit} className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-card-foreground">Change password</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">You will be signed out afterwards.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Current password</span>
            <Input
              type="password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="mt-1"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">New password</span>
            <Input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="mt-1"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Confirm new password</span>
            <Input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="mt-1"
            />
          </label>
        </div>
        <div className="mt-4 flex justify-end">
          <Button type="submit" disabled={changingPassword}>
            {changingPassword ? 'Saving…' : 'Change password'}
          </Button>
        </div>
      </form>

      <ConfirmModal
        open={confirmPasswordChange}
        onOpenChange={(open) => !open && setConfirmPasswordChange(false)}
        title="Change your password?"
        description="You'll be signed out immediately and need to log in again with the new password."
        confirmLabel="Change password"
        loading={changingPassword}
        onConfirm={changePassword}
      />
    </div>
  );
}
