import { useState } from 'react';
import { Button, Input, PageHeader, toast } from '@fatexia/ui';
import { apiFetch } from '../../lib/api';
import { useSession } from '../../session/SessionContext';
import { dateTime } from '../../lib/format';
import { StatusPill } from '../../components/StatusPill';

export function Profile() {
  const { user, logout } = useSession();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('The new passwords do not match');
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/users/me/password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      toast.success('Password changed. Sign in again with the new one.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      // The stored tokens were issued against the old credentials; signing out
      // avoids leaving a half-valid session behind.
      logout();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" description="Your account and its credentials." />

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-card-foreground">Account</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Email</dt>
            <dd className="mt-0.5 text-sm text-card-foreground">{user?.email ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Role</dt>
            <dd className="mt-0.5 text-sm text-card-foreground">{user?.role ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Status</dt>
            <dd className="mt-0.5">{user ? <StatusPill status={user.status} /> : '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Last login</dt>
            <dd className="mt-0.5 text-sm text-card-foreground">{dateTime(user?.lastLogin ?? null)}</dd>
          </div>
        </dl>
      </section>

      <form onSubmit={changePassword} className="rounded-lg border border-border bg-card p-4">
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
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Change password'}
          </Button>
        </div>
      </form>
    </div>
  );
}
