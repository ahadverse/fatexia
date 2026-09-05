import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, PageHeader, Select, Textarea, toast } from '@fatexia/ui';
import type { Manager, ManagerPermissions, ManagerRole, UserStatus } from '@fatexia/types';
import { createManager, getManagers } from '../../lib/managers-api';
import { PermissionGrid } from '../../components/PermissionGrid';
import { useAsync } from '../../hooks/useAsync';

/**
 * A sensible opening position per role (issue #20) — not a hard rule, just what the
 * grid starts ticked as so an admin adjusts rather than builds from nothing. An
 * affiliate manager can run their book but not touch payouts; an account manager
 * works on the advertiser side; a general manager gets everything.
 */
const ROLE_DEFAULT_PERMISSIONS: Record<ManagerRole, ManagerPermissions> = {
  AFFILIATE: {
    'affiliates.view': true,
    'affiliates.create': true,
    'affiliates.edit': true,
    'affiliates.approve': true,
    'affiliates.reject': true,
    'affiliates.suspend': true,
    'offers.view': true,
    'reports.view': true,
    'messages.send': true,
  },
  ACCOUNT: {
    'affiliates.view': true,
    'offers.view': true,
    'offers.create': true,
    'offers.edit': true,
    'advertisers.manage': true,
    'reports.view': true,
  },
  GENERAL: {
    'affiliates.view': true,
    'affiliates.create': true,
    'affiliates.edit': true,
    'affiliates.approve': true,
    'affiliates.reject': true,
    'affiliates.suspend': true,
    'affiliates.payout': true,
    'affiliates.impersonate': true,
    'offers.view': true,
    'offers.create': true,
    'offers.edit': true,
    'advertisers.manage': true,
    'reports.view': true,
    'messages.send': true,
  },
};

const ROLES: { value: ManagerRole; label: string; hint: string }[] = [
  { value: 'AFFILIATE', label: 'Affiliate manager', hint: 'Owns affiliate relationships — recruiting, approvals, messaging.' },
  { value: 'ACCOUNT', label: 'Account manager', hint: 'Owns advertiser relationships and their offers.' },
  { value: 'GENERAL', label: 'General manager', hint: 'Senior staff the other manager roles report to.' },
];

export function CreateManager() {
  const navigate = useNavigate();
  const managers = useAsync<Manager[]>(() => getManagers(), []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [managerRole, setManagerRole] = useState<ManagerRole>('AFFILIATE');
  const [phone, setPhone] = useState('');
  const [skype, setSkype] = useState('');
  const [defaultCommissionPercent, setDefaultCommissionPercent] = useState('0');
  const [reportsToId, setReportsToId] = useState('');
  const [status, setStatus] = useState<UserStatus>('ACTIVE');
  const [notes, setNotes] = useState('');
  const [permissions, setPermissions] = useState<ManagerPermissions>(ROLE_DEFAULT_PERMISSIONS.AFFILIATE);
  // Tracks whether the admin has touched the grid: changing the role re-seeds the
  // defaults only while they haven't, so switching roles early is helpful and
  // switching roles after deliberate edits never silently discards them.
  const [permissionsTouched, setPermissionsTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  function handleRoleChange(nextRole: ManagerRole) {
    setManagerRole(nextRole);
    if (!permissionsTouched) setPermissions(ROLE_DEFAULT_PERMISSIONS[nextRole]);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await createManager({
        email,
        password,
        fullName,
        managerRole,
        phone: phone || undefined,
        skype: skype || undefined,
        defaultCommissionPercent: Number(defaultCommissionPercent) || 0,
        reportsToId: reportsToId || null,
        permissions,
        notes: notes || undefined,
        status,
      });
      toast.success(`${fullName} created`);
      navigate('/managers/all');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create manager');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <PageHeader
        title="Create manager"
        description="Provisions a MANAGER-role login and profile together. Managers share this portal but cannot reach integrations, staff management, payout batches or network settings."
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => navigate('/managers/all')}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Creating…' : 'Create manager'}
            </Button>
          </>
        }
      />

      <section className="rounded-lg border border-border bg-card p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Email</span>
            <Input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Password (minimum 8 characters)</span>
            <Input required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Full name</span>
            <Input required minLength={2} value={fullName} onChange={(event) => setFullName(event.target.value)} className="mt-1" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Role</span>
            <Select value={managerRole} onChange={(event) => handleRoleChange(event.target.value as ManagerRole)} className="mt-1">
              {ROLES.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </Select>
            <span className="mt-1 block text-xs text-muted-foreground">
              {ROLES.find((role) => role.value === managerRole)?.hint}
            </span>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Phone</span>
            <Input value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Skype</span>
            <Input value={skype} onChange={(event) => setSkype(event.target.value)} className="mt-1" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Default commission %</span>
            <Input
              type="number"
              min={0}
              max={100}
              value={defaultCommissionPercent}
              onChange={(event) => setDefaultCommissionPercent(event.target.value)}
              className="mt-1"
            />
            <span className="mt-1 block text-xs text-muted-foreground">
              A payout rule's own manager commission overrides this per offer.
            </span>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Reports to</span>
            <Select value={reportsToId} onChange={(event) => setReportsToId(event.target.value)} className="mt-1">
              <option value="">Nobody</option>
              {(managers.data ?? []).map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.fullName ?? manager.email}
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Account status</span>
            <Select value={status} onChange={(event) => setStatus(event.target.value as UserStatus)} className="mt-1">
              <option value="ACTIVE">Active — can log in immediately</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-muted-foreground">Notes</span>
            <Textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1" />
          </label>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-card-foreground">Permissions</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Exactly what this manager can do. Whatever you grant applies only to the affiliates assigned to them — never
          to the whole network.
        </p>
        <div className="mt-4">
          <PermissionGrid
            value={permissions}
            onChange={(next) => {
              setPermissionsTouched(true);
              setPermissions(next);
            }}
          />
        </div>
      </section>
    </form>
  );
}
