'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Check, ArrowRight, ArrowLeft, ShieldCheck, ChevronDown } from 'lucide-react';
import { toast } from '@fatexia/ui';
import { registerAffiliate, ApiError, type MessengerType } from '@/lib/api';
import { COUNTRIES } from '@/lib/countries';

const TRAFFIC_SOURCES = ['Facebook', 'Google', 'Native', 'Push', 'Pop', 'Email', 'SEO', 'Influencer'];
const VERTICALS = ['Finance', 'Nutra & Health', 'Sweepstakes', 'Dating', 'Mobile Content', 'iGaming', 'E-commerce', 'Insurance', 'Software & VPN', 'Lead Gen'];
const MONTHLY_VOLUMES = ['Just starting out', 'Under $1k / mo', '$1k-$10k / mo', '$10k-$50k / mo', '$50k+ / mo'];
const REFERRAL_SOURCES = ['Search engine', 'Social media', 'Affiliate forum', 'Friend or referral', 'Event or conference', 'Other'];
const MESSENGERS: { value: MessengerType; label: string }[] = [
  { value: 'TELEGRAM', label: 'Telegram' },
  { value: 'SKYPE', label: 'Skype' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
];

const FIELD =
  'w-full rounded-lg border border-white/10 bg-background/60 px-3.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 hover:border-white/20 focus:border-primary/60 focus:ring-2 focus:ring-ring/40';
const INPUT = `h-11 ${FIELD}`;

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="text-sm font-medium text-foreground">
      {children}
      {required && <span className="ml-0.5 text-destructive">*</span>}
    </label>
  );
}

function Select({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: readonly string[]; placeholder?: string }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} className={`${INPUT} appearance-none pr-10 ${value ? '' : 'text-muted-foreground/70'}`}>
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o} value={o} className="text-foreground">
            {o}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

function Chips({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((s) => {
        const active = selected.includes(s);
        return (
          <button
            key={s}
            type="button"
            onClick={() => onToggle(s)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
              active ? 'border-primary/40 bg-primary/15 text-primary' : 'border-white/10 bg-background/60 text-muted-foreground hover:border-primary/30 hover:text-foreground'
            }`}
          >
            {active && <Check className="size-3.5" />}
            {s}
          </button>
        );
      })}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</p>;
}

const STEPS = ['Personal information', 'Additional information'];

function Stepper({ step }: { step: number }) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-center gap-3 sm:gap-4">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const done = step > n;
          const active = step === n;
          return (
            <div key={label} className="flex items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-2.5">
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                    done || active ? 'bg-brand text-white' : 'border border-border text-muted-foreground'
                  }`}
                >
                  {done ? <Check className="size-4" /> : n}
                </span>
                <span className={`hidden text-sm font-medium sm:inline ${active ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
              </div>
              {n < STEPS.length && <div className={`h-0.5 w-10 rounded transition-colors sm:w-14 ${step > n ? 'bg-brand' : 'bg-border'}`} />}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-center text-xs font-medium text-muted-foreground sm:hidden">
        Step {step} of {STEPS.length} — {STEPS[step - 1]}
      </p>
    </div>
  );
}

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [country, setCountry] = useState('');
  const [phone, setPhone] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [messengerType, setMessengerType] = useState<MessengerType>('TELEGRAM');
  const [messengerHandle, setMessengerHandle] = useState('');
  const [trafficSources, setTrafficSources] = useState<string[]>([]);
  const [verticals, setVerticals] = useState<string[]>([]);
  const [monthlyVolume, setMonthlyVolume] = useState('');
  const [referralSource, setReferralSource] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (v: string) =>
    setter((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  function validateStep1(): boolean {
    if (!email || password.length < 8) {
      toast.error('Enter a valid email and a password of at least 8 characters');
      return false;
    }
    if (fullName.trim().length < 2) {
      toast.error('Please enter your full name');
      return false;
    }
    if (!country) {
      toast.error('Please select your country');
      return false;
    }
    if (messengerHandle.trim().length < 2) {
      toast.error('Please add your messenger handle');
      return false;
    }
    return true;
  }

  function goToStep(n: number) {
    setStep(n);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (step === 1) {
      if (validateStep1()) goToStep(2);
      return;
    }
    if (trafficSources.length === 0) return void toast.error('Select at least one traffic source');

    const site = websiteUrl.trim();
    const normalizedSite = site && !/^https?:\/\//i.test(site) ? `https://${site}` : site;

    setSubmitting(true);
    try {
      await registerAffiliate({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        country,
        messengerType,
        messengerHandle: messengerHandle.trim(),
        trafficSources,
        websiteUrl: normalizedSite || undefined,
        companyName: companyName.trim() || undefined,
        phone: phone.trim() || undefined,
        verticals: verticals.length ? verticals : undefined,
        monthlyVolume: monthlyVolume || undefined,
        referralSource: referralSource || undefined,
        notes: notes.trim() || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="container-page flex min-h-[70vh] max-w-md flex-col items-center justify-center py-24 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-success/15 text-success">
          <Check className="size-7" />
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-foreground">Application received</h1>
        <p className="mt-3 text-muted-foreground">
          Thanks, {fullName.split(' ')[0] || 'there'} — your affiliate application is in and pending manual review. We&apos;ll email {email} once it&apos;s approved; you won&apos;t be able to sign in until then.
        </p>
        <Link href="/" className="mt-8 text-sm font-medium text-primary hover:underline">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="container-page max-w-2xl py-16">
      <div className="text-center">
        <span className="eyebrow">
          <span className="dot-pulse size-1.5 rounded-full bg-brand" />
          Become an Affiliate
        </span>
        <h1 className="mt-5 text-3xl font-bold tracking-tight text-gradient sm:text-4xl">Apply to join Fatexia</h1>
        <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
          Applications are reviewed by a real person. The more you tell us about you and your traffic, the faster we can approve you.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="ring-gradient mt-10 rounded-2xl border border-white/10 bg-card p-6 sm:p-8">
        <Stepper step={step} />

        {/* ---- Step 1: Personal information ---- */}
        {step === 1 && (
          <div className="space-y-8">
            <div>
              <SectionLabel>Account</SectionLabel>
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label required>Email</Label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" placeholder="you@example.com" className={INPUT} />
                </div>
                <div className="space-y-2">
                  <Label required>Password</Label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="At least 8 characters" className={INPUT} />
                </div>
              </div>
            </div>

            <div>
              <SectionLabel>About you</SectionLabel>
              <div className="mt-4 space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label required>Full name</Label>
                    <input value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" placeholder="Your full name" className={INPUT} />
                  </div>
                  <div className="space-y-2">
                    <Label>Company name</Label>
                    <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} autoComplete="organization" placeholder="Company (optional)" className={INPUT} />
                  </div>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label required>Country</Label>
                    <Select value={country} onChange={setCountry} options={COUNTRIES} placeholder="Select your country" />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="+1 555 000 0000 (optional)" className={INPUT} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Website / promo URL</Label>
                  <input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="example.com (optional)" className={INPUT} />
                </div>
              </div>
            </div>

            <div>
              <SectionLabel>Best way to reach you</SectionLabel>
              <div className="mt-4 grid gap-5 sm:grid-cols-[150px_1fr]">
                <div className="space-y-2">
                  <Label>Messenger</Label>
                  <Select
                    value={MESSENGERS.find((m) => m.value === messengerType)?.label ?? ''}
                    onChange={(v) => setMessengerType(MESSENGERS.find((m) => m.label === v)?.value ?? 'TELEGRAM')}
                    options={MESSENGERS.map((m) => m.label)}
                  />
                </div>
                <div className="space-y-2">
                  <Label required>Handle</Label>
                  <input value={messengerHandle} onChange={(e) => setMessengerHandle(e.target.value)} placeholder="@yourhandle" className={INPUT} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---- Step 2: Additional information ---- */}
        {step === 2 && (
          <div className="space-y-8">
            <div>
              <SectionLabel>Your traffic</SectionLabel>
              <div className="mt-4 space-y-5">
                <div className="space-y-2">
                  <Label required>Traffic sources</Label>
                  <Chips options={TRAFFIC_SOURCES} selected={trafficSources} onToggle={toggle(setTrafficSources)} />
                </div>
                <div className="space-y-2">
                  <Label>Verticals of interest</Label>
                  <Chips options={VERTICALS} selected={verticals} onToggle={toggle(setVerticals)} />
                </div>
                <div className="space-y-2 sm:max-w-xs">
                  <Label>Estimated monthly volume</Label>
                  <Select value={monthlyVolume} onChange={setMonthlyVolume} options={MONTHLY_VOLUMES} placeholder="Select a range" />
                </div>
              </div>
            </div>

            <div>
              <SectionLabel>Anything else</SectionLabel>
              <div className="mt-4 space-y-5">
                <div className="space-y-2 sm:max-w-xs">
                  <Label>How did you hear about us?</Label>
                  <Select value={referralSource} onChange={setReferralSource} options={REFERRAL_SOURCES} placeholder="Select one" />
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    maxLength={1000}
                    placeholder="Tell us about your traffic, the geos you run, or anything that helps us approve you faster (optional)"
                    className={`${FIELD} py-2.5`}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---- Navigation ---- */}
        <div className="mt-8">
          {step === 1 ? (
            <button
              type="submit"
              className="bg-brand btn-shine relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-lg px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_34px_-8px_hsl(150_75%_38%/0.7)] transition-all hover:brightness-110"
            >
              Continue
              <ArrowRight className="size-4" />
            </button>
          ) : (
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => goToStep(1)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-background/60 px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:border-white/20 sm:w-40"
              >
                <ArrowLeft className="size-4" />
                Back
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="bg-brand btn-shine relative inline-flex flex-1 items-center justify-center gap-2 overflow-hidden rounded-lg px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_34px_-8px_hsl(150_75%_38%/0.7)] transition-all hover:brightness-110 disabled:opacity-50"
              >
                {submitting ? 'Submitting…' : 'Create Affiliate Account'}
                {!submitting && <ArrowRight className="size-4" />}
              </button>
            </div>
          )}
          <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" /> Reviewed manually — no bots, no auto-approval
          </p>
        </div>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
