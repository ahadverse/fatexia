import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { LogoMark, toast } from '@fatexia/ui';
import { useSession } from '../../session/SessionContext';
import { AuthShell, INPUT, PRIMARY_BUTTON } from './fields';
import './auth-theme.css';

export function Login() {
  const { login } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    try {
      // A successful login flips the session to authenticated, which swaps the whole
      // anonymous router out for the portal — so there is no redirect to write here.
      await login(email.trim(), password);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invalid email or password');
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
        <h1 className="text-3xl font-bold tracking-tight text-gradient">Welcome back</h1>
        <p className="mt-2 text-muted-foreground">Sign in to your affiliate account.</p>
      </div>

      <div className="ring-gradient mt-8 rounded-2xl border border-white/10 bg-card p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Email</label>
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
            <label className="text-sm font-medium text-foreground">Password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="Your password"
              className={INPUT}
            />
          </div>
          <button type="submit" disabled={!email || !password || submitting} className={PRIMARY_BUTTON}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link to="/register" className="font-medium text-primary hover:underline">
          Become an affiliate
        </Link>
      </p>
    </AuthShell>
  );
}
