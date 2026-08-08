import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, ShieldCheck } from 'lucide-react';
import { LogoMark, toast } from '@fatexia/ui';
import { COUNTRIES } from '@fatexia/types';
import { ApiError } from '../../lib/api';
import { registerAffiliate, resendVerification, verifyEmail, type MessengerType } from '../../lib/auth-api';
import { AuthShell, Chips, FIELD, INPUT, Label, PRIMARY_BUTTON, SectionLabel, Select, scrollAuthToTop } from './fields';
import './auth-theme.css';

// Mirrors the closed lists the backend's register schema validates against
// (auth.dto.ts) — a value outside these is rejected server-side.
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
const REFERRAL_SOURCES = [
  'Search engine',
  'Social media',
  'Affiliate forum',
  'Friend or referral',
  'Event or conference',
  'Other',
];
const MESSENGERS: { value: MessengerType; label: string }[] = [
  { value: 'TELEGRAM', label: 'Telegram' },
  { value: 'SKYPE', label: 'Skype' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
];

const STEPS = ['Personal information', 'Additional information'];

/**
 * Turns what someone types in the website field into a URL the server will accept,
 * or null if it cannot be one.
 *
 * A bare domain is the common input, so a scheme is added rather than bouncing the
 * form back. What this must not do is prepend `https://` unconditionally: free text
 * like "Consequatur Dolores" then becomes "https://Consequatur Dolores", which the
 * server rejects with a message about a URL the user never typed.
 */
function normalizeWebsite(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    // `new URL` accepts a hostname with no dot ("https://localhost"), which is not a
    // usable promo URL, and spaces survive as %20 — both have to fail here.
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function Stepper({ step }: { step: number }) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-center gap-3 sm:gap-4">
        {STEPS.map((label, index) => {
          const n = index + 1;
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
                <span className={`hidden text-sm font-medium sm:inline ${active ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {label}
                </span>
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

export function Register() {
  const navigate = useNavigate();
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
  const [phase, setPhase] = useState<'form' | 'verify' | 'done'>('form');
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (value: string) =>
    setter((prev) => (prev.includes(value) ? prev.filter((entry) => entry !== value) : [...prev, value]));

  function validateStep1(): boolean {
    if (!email || password.length < 8) {
      toast.error('Enter a valid email and a password of at least 8 characters');
      return false;
    }
    if (fullName.trim().length < 2) return void toast.error('Please enter your full name'), false;
    if (!country) return void toast.error('Please select your country'), false;
    if (messengerHandle.trim().length < 2) return void toast.error('Please add your messenger handle'), false;
    if (websiteUrl.trim() && !normalizeWebsite(websiteUrl)) {
      toast.error('That website address is not valid — use something like example.com');
      return false;
    }
    return true;
  }

  function goToStep(n: number) {
    setStep(n);
    scrollAuthToTop();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (step === 1) {
      if (validateStep1()) goToStep(2);
      return;
    }
    if (trafficSources.length === 0) return void toast.error('Select at least one traffic source');

    // Already validated on step 1; null here just means the field was left blank.
    const normalizedSite = normalizeWebsite(websiteUrl);

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
        websiteUrl: normalizedSite ?? undefined,
        companyName: companyName.trim() || undefined,
        phone: phone.trim() || undefined,
        verticals: verticals.length ? verticals : undefined,
        monthlyVolume: monthlyVolume || undefined,
        referralSource: referralSource || undefined,
        notes: notes.trim() || undefined,
      });
      setPhase('verify');
      scrollAuthToTop(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify(event: FormEvent) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) return void toast.error('Enter the 6-digit code from your email');
    setVerifying(true);
    try {
      await verifyEmail(email.trim(), code.trim());
      setPhase('done');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setVerifying(false);
    }
  }

  async function handleResend() {
    setResending(true);
    try {
      await resendVerification(email.trim());
      toast.success('New code sent');
    } catch {
      toast.error('Could not resend the code. Please try again shortly.');
    } finally {
      setResending(false);
    }
  }

  if (phase === 'verify') {
    return (
      <AuthShell>
        <div className="flex flex-col items-center text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <ShieldCheck className="size-7" />
          </div>
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-foreground">Verify your email</h1>
          <p className="mt-3 text-muted-foreground">
            Enter the 6-digit code we sent to <span className="text-foreground">{email}</span>. It expires in 15 minutes.
          </p>

          <form onSubmit={handleVerify} className="mt-8 w-full space-y-4">
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              className={`${INPUT} text-center text-lg tracking-[0.5em]`}
            />
            <button type="submit" disabled={verifying} className={PRIMARY_BUTTON}>
              {verifying ? 'Verifying…' : 'Verify email'}
              {!verifying && <ArrowRight className="size-4" />}
            </button>
          </form>

          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="mt-4 text-sm font-medium text-primary hover:underline disabled:opacity-50"
          >
            {resending ? 'Sending…' : "Didn't get it? Resend code"}
          </button>

          <p className="mt-8 text-xs text-muted-foreground">
            Verifying doesn&apos;t approve your application — a real person still reviews it, and we&apos;ll email {email}{' '}
            once that&apos;s done.
          </p>
        </div>
      </AuthShell>
    );
  }

  if (phase === 'done') {
    return (
      <AuthShell>
        <div className="flex flex-col items-center text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-success/15 text-success">
            <Check className="size-7" />
          </div>
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-foreground">Email verified</h1>
          <p className="mt-3 text-muted-foreground">
            Your application is in and pending review. We&apos;ll email you once it&apos;s approved — you won&apos;t be
            able to sign in until then.
          </p>
          <button type="button" onClick={() => navigate('/login')} className={`${PRIMARY_BUTTON} mt-8`}>
            Back to sign in
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell wide>
      <div className="flex justify-center">
        <LogoMark className="h-9" />
      </div>

      <div className="mt-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-gradient sm:text-4xl">Apply to join Fatexia</h1>
        <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
          Applications are reviewed by a real person. The more you tell us about you and your traffic, the faster we can
          approve you.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="ring-gradient mt-8 rounded-2xl border border-white/10 bg-card p-6 sm:p-8">
        <Stepper step={step} />

        {step === 1 && (
          <div className="space-y-8">
            <div>
              <SectionLabel>Account</SectionLabel>
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label required>Email</Label>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="username"
                    placeholder="you@example.com"
                    className={INPUT}
                  />
                </div>
                <div className="space-y-2">
                  <Label required>Password</Label>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    className={INPUT}
                  />
                </div>
              </div>
            </div>

            <div>
              <SectionLabel>About you</SectionLabel>
              <div className="mt-4 space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label required>Full name</Label>
                    <input
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      autoComplete="name"
                      placeholder="Your full name"
                      className={INPUT}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Company name</Label>
                    <input
                      value={companyName}
                      onChange={(event) => setCompanyName(event.target.value)}
                      autoComplete="organization"
                      placeholder="Company (optional)"
                      className={INPUT}
                    />
                  </div>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label required>Country</Label>
                    <Select value={country} onChange={setCountry} options={COUNTRIES} placeholder="Select your country" />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      autoComplete="tel"
                      placeholder="+1 555 000 0000 (optional)"
                      className={INPUT}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Website / promo URL</Label>
                  <input
                    value={websiteUrl}
                    onChange={(event) => setWebsiteUrl(event.target.value)}
                    placeholder="example.com (optional)"
                    className={INPUT}
                  />
                </div>
              </div>
            </div>

            <div>
              <SectionLabel>Best way to reach you</SectionLabel>
              <div className="mt-4 grid gap-5 sm:grid-cols-[150px_1fr]">
                <div className="space-y-2">
                  <Label>Messenger</Label>
                  <Select
                    value={MESSENGERS.find((entry) => entry.value === messengerType)?.label ?? ''}
                    onChange={(label) =>
                      setMessengerType(MESSENGERS.find((entry) => entry.label === label)?.value ?? 'TELEGRAM')
                    }
                    options={MESSENGERS.map((entry) => entry.label)}
                  />
                </div>
                <div className="space-y-2">
                  <Label required>Handle</Label>
                  <input
                    value={messengerHandle}
                    onChange={(event) => setMessengerHandle(event.target.value)}
                    placeholder="@yourhandle"
                    className={INPUT}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

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
                    onChange={(event) => setNotes(event.target.value)}
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

        <div className="mt-8">
          {step === 1 ? (
            <button type="submit" className={PRIMARY_BUTTON}>
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
              <button type="submit" disabled={submitting} className={`${PRIMARY_BUTTON} flex-1`}>
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
        <Link to="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
