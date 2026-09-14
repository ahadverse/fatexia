import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { LogoMark, toast } from '@fatexia/ui';
import { forgotPassword } from '../../lib/auth-api';
import { AuthShell, INPUT, PRIMARY_BUTTON } from './fields';
import './auth-theme.css';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email) return;
    setSubmitting(true);
    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      // Only a transport or server failure reaches here — an unknown address still
      // resolves. Worth showing, because silently claiming success when the request
      // never landed leaves someone waiting for an email that is not coming.
      toast.error(err instanceof Error ? err.message : 'Could not send the reset link');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <div className="flex justify-center">
        <LogoMark className="h-9" />
      </div>

      <div className="mt-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-gradient">Reset your password</h1>
        <p className="mt-2 text-muted-foreground">
          {sent ? 'Check your inbox.' : "We'll email you a link to set a new one."}
        </p>
      </div>

      <div className="ring-gradient mt-8 rounded-2xl border border-white/10 bg-card p-6 sm:p-8">
        {sent ? (
          // Deliberately does not confirm the address exists — the API withholds that,
          // and saying "sent!" here would hand back exactly what it is protecting.
          <div className="space-y-4 text-sm">
            <p className="text-foreground">
              If <span className="font-medium">{email.trim()}</span> is registered with us, a reset link is on its way.
              It works once and expires in an hour.
            </p>
            <p className="text-muted-foreground">
              Nothing after a few minutes? Check spam, and make sure you used the address you signed up with.
            </p>
            <button
              type="button"
              onClick={() => setSent(false)}
              className="text-sm font-medium text-primary hover:underline"
            >
              Use a different address
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="forgot-email" className="text-sm font-medium text-foreground">
                Email
              </label>
              <input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                placeholder="you@example.com"
                className={INPUT}
              />
            </div>
            <button type="submit" disabled={!email || submitting} className={PRIMARY_BUTTON}>
              {submitting ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Remembered it?{' '}
        <Link to="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
