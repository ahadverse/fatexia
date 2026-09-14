import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LogoMark, toast } from '@fatexia/ui';
import { resetPassword } from '../../lib/auth-api';
import { AuthShell, INPUT, PRIMARY_BUTTON } from './fields';
import './auth-theme.css';

// Matches the backend's own floor (resetPasswordSchema). Checked here as well so the
// form can say so before a round trip, never instead of the server check.
const MIN_LENGTH = 8;

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const tooShort = password.length > 0 && password.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = password.length >= MIN_LENGTH && password === confirm && !submitting;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      // The server names the reason — expired, already used, never valid — and that
      // distinction is the whole difference between "request another" and "you already
      // did this", so it is shown rather than replaced with something generic.
      toast.error(err instanceof Error ? err.message : 'Could not reset your password');
    } finally {
      setSubmitting(false);
    }
  }

  // A link that arrived mangled, or this page opened directly. Say so immediately
  // rather than presenting a form that cannot succeed.
  if (!token) {
    return (
      <AuthShell>
        <div className="flex justify-center">
          <LogoMark className="h-9" />
        </div>
        <div className="mt-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gradient">Link not valid</h1>
          <p className="mt-2 text-muted-foreground">This page needs the link from your reset email.</p>
        </div>
        <div className="ring-gradient mt-8 rounded-2xl border border-white/10 bg-card p-6 text-sm text-muted-foreground sm:p-8">
          Open the most recent “Reset your password” email and use the button in it. Some mail clients cut long links,
          so copying the whole address is more reliable than retyping it.
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link to="/forgot-password" className="font-medium text-primary hover:underline">
            Send a new link
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="flex justify-center">
        <LogoMark className="h-9" />
      </div>

      <div className="mt-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-gradient">
          {done ? 'Password changed' : 'Set a new password'}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {done ? 'You can sign in with it now.' : 'Choose something you have not used here before.'}
        </p>
      </div>

      <div className="ring-gradient mt-8 rounded-2xl border border-white/10 bg-card p-6 sm:p-8">
        {done ? (
          <Link to="/login" className={PRIMARY_BUTTON + ' block text-center'}>
            Sign in
          </Link>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="new-password" className="text-sm font-medium text-foreground">
                New password
              </label>
              <input
                id="new-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                placeholder={`At least ${MIN_LENGTH} characters`}
                className={INPUT}
              />
              {tooShort && <p className="text-xs text-destructive">Use at least {MIN_LENGTH} characters.</p>}
            </div>

            <div className="space-y-2">
              <label htmlFor="confirm-password" className="text-sm font-medium text-foreground">
                Confirm password
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                autoComplete="new-password"
                placeholder="Type it again"
                className={INPUT}
              />
              {mismatch && <p className="text-xs text-destructive">These do not match.</p>}
            </div>

            <button type="submit" disabled={!canSubmit} className={PRIMARY_BUTTON}>
              {submitting ? 'Saving…' : 'Change password'}
            </button>
          </form>
        )}
      </div>

      {!done && (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link to="/login" className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      )}
    </AuthShell>
  );
}
