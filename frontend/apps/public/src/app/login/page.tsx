'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowRight, LayoutDashboard } from 'lucide-react';
import { toast } from '@fatexia/ui';
import { login, ApiError } from '@/lib/api';

// The Affiliate portal is a separate app (affiliates.fatexia.com / :5174 in dev). A
// real cross-origin token handoff from this public login isn't wired yet, so we don't
// fake a seamless redirect — we confirm the sign-in and point to the portal.
const AFFILIATE_URL = process.env.NEXT_PUBLIC_AFFILIATE_URL ?? 'http://localhost:5174';

const INPUT =
  'h-11 w-full rounded-lg border border-white/10 bg-background/60 px-3.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 hover:border-white/20 focus:border-primary/60 focus:ring-2 focus:ring-ring/40';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      setLoggedIn(true);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Invalid email or password');
    } finally {
      setSubmitting(false);
    }
  }

  if (loggedIn) {
    return (
      <div className="container-page flex min-h-[70vh] max-w-md flex-col items-center justify-center py-24 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <LayoutDashboard className="size-7" />
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-foreground">You&apos;re signed in</h1>
        <p className="mt-3 text-muted-foreground">Your affiliate dashboard is where you manage offers, tracking links, and payouts. Head over to get started.</p>
        <a
          href={AFFILIATE_URL}
          className="bg-brand btn-shine relative mt-8 inline-flex items-center gap-2 overflow-hidden rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_34px_-8px_hsl(150_75%_38%/0.7)] transition-all hover:brightness-110"
        >
          Go to your dashboard
          <ArrowRight className="size-4" />
        </a>
        <Link href="/" className="mt-4 text-sm font-medium text-muted-foreground hover:text-foreground">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="container-page flex min-h-[70vh] max-w-md flex-col justify-center py-16">
      <div className="mx-auto w-full">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gradient">Welcome back</h1>
          <p className="mt-2 text-muted-foreground">Sign in to your affiliate account.</p>
        </div>

        <div className="ring-gradient mt-8 rounded-2xl border border-white/10 bg-card p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" placeholder="you@example.com" className={INPUT} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="Your password" className={INPUT} />
            </div>
            <button
              type="submit"
              disabled={!email || !password || submitting}
              className="bg-brand btn-shine relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-lg px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_34px_-8px_hsl(150_75%_38%/0.7)] transition-all hover:brightness-110 disabled:opacity-50"
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Become an affiliate
          </Link>
        </p>
      </div>
    </div>
  );
}
