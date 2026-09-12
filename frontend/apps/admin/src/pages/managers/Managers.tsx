import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  ConfirmModal,
  DataTable,
  FilterBar,
  FilterField,
  Input,
  Modal,
  PageHeader,
  Select,
  TableSkeleton,
  Textarea,
  toast,
  type DataTableColumn,
} from '@fatexia/ui';
import { MANAGER_PERMISSION_KEYS } from '@fatexia/types';
import type { Manager, ManagerPermissions, ManagerRole, UserStatus } from '@fatexia/types';
import { getManagers, updateManager, updateManagerStatus, uploadManagerAvatar } from '../../lib/managers-api';
import { runAction, useAsync } from '../../hooks/useAsync';
import { date, dateTime } from '../../lib/format';
import { PermissionGrid } from '../../components/PermissionGrid';
import { StatusPill } from '../../components/StatusPill';

const ROLE_LABELS: Record<ManagerRole, string> = {
  GENERAL: 'General manager',
  ACCOUNT: 'Account manager',
  AFFILIATE: 'Affiliate manager',
};

interface EditState {
  id: string;
  fullName: string;
  phone: string;
  telegram: string;
  teams: string;
  contactEmail: string;
  avatarUrl: string;
  managerRole: ManagerRole;
  defaultCommissionPercent: string;
  reportsToId: string;
  permissions: ManagerPermissions;
  notes: string;
}

export interface ManagersProps {
  /** Pins the list to one role — the nav has a page per manager type. */
  role?: ManagerRole;
  title?: string;
  description?: string;
}

export function Managers({
  role,
  title = 'Managers',
  description = 'Staff who share this portal at a lesser privilege than admin. Managers are scoped to their own affiliates and cannot reach integrations, staff management, payout batches or network settings.',
}: ManagersProps) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<UserStatus | ''>('');
  const [search, setSearch] = useState('');
  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [decision, setDecision] = useState<{ manager: Manager; next: UserStatus } | null>(null);
  const [decisionSaving, setDecisionSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const managers = useAsync(
    () => getManagers({ managerRole: role, status: status || undefined, search: search || undefined }),
    [role, status, search],
  );

  const managerName = (id: string | null) =>
    id ? ((managers.data ?? []).find((manager) => manager.id === id)?.fullName ?? 'Unknown') : '—';

  async function confirmDecision() {
    if (!decision) return;
    setDecisionSaving(true);
    const result = await runAction(() => updateManagerStatus(decision.manager.id, decision.next), {
      success: `${decision.manager.fullName ?? decision.manager.email} is now ${decision.next.toLowerCase()}`,
      onDone: managers.reload,
    });
    setDecisionSaving(false);
    if (result) setDecision(null);
  }

  async function saveEdit() {
    if (!edit) return;
    setSaving(true);
    const result = await runAction(
      () =>
        updateManager(edit.id, {
          fullName: edit.fullName,
          phone: edit.phone || undefined,
          telegram: edit.telegram || undefined,
          teams: edit.teams || undefined,
          contactEmail: edit.contactEmail || undefined,
          avatarUrl: edit.avatarUrl || undefined,
          managerRole: edit.managerRole,
          defaultCommissionPercent: Number(edit.defaultCommissionPercent) || 0,
          reportsToId: edit.reportsToId || null,
          permissions: edit.permissions,
          notes: edit.notes || undefined,
        }),
      { success: 'Manager updated', onDone: managers.reload },
    );
    setSaving(false);
    if (result) setEdit(null);
  }

  async function handleAvatarUpload(file: File | undefined) {
    if (!file || !edit) return;
    setUploadingAvatar(true);
    try {
      const { url } = await uploadManagerAvatar(file);
      setEdit({ ...edit, avatarUrl: url });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
    }
  }

  const columns: DataTableColumn<Manager>[] = [
    {
      key: 'publicId',
      header: 'ID',
      render: (row) => <span className="font-mono text-xs text-muted-foreground">{row.publicId ?? '—'}</span>,
    },
    {
      key: 'name',
      header: 'Manager',
      render: (row) => (
        <div>
          <p className="text-card-foreground">{row.fullName ?? '—'}</p>
          <p className="text-xs text-muted-foreground">{row.email}</p>
        </div>
      ),
    },
    { key: 'role', header: 'Role', render: (row) => ROLE_LABELS[row.managerRole] },
    { key: 'reportsTo', header: 'Reports to', render: (row) => managerName(row.reportsToId) },
    { key: 'affiliates', header: 'Affiliates', render: (row) => String(row.assignedAffiliateCount) },
    {
      key: 'permissions',
      header: 'Access',
      render: (row) => {
        const granted = MANAGER_PERMISSION_KEYS.filter((key) => row.permissions?.[key] === true).length;
        return granted === 0 ? (
          <span className="text-xs text-warning">No access</span>
        ) : (
          <span className="text-xs text-muted-foreground">
            {granted}/{MANAGER_PERMISSION_KEYS.length}
          </span>
        );
      },
    },
    { key: 'commission', header: 'Default commission', render: (row) => `${row.defaultCommissionPercent}%` },
    { key: 'status', header: 'Status', render: (row) => <StatusPill status={row.status} /> },
    { key: 'lastLogin', header: 'Last login', render: (row) => dateTime(row.lastLogin) },
    { key: 'createdAt', header: 'Added', render: (row) => date(row.createdAt) },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setEdit({
                id: row.id,
                fullName: row.fullName ?? '',
                phone: row.phone ?? '',
                telegram: row.telegram ?? '',
                teams: row.teams ?? '',
                contactEmail: row.contactEmail ?? '',
                avatarUrl: row.avatarUrl ?? '',
                managerRole: row.managerRole,
                defaultCommissionPercent: String(row.defaultCommissionPercent),
                reportsToId: row.reportsToId ?? '',
                permissions: row.permissions ?? {},
                notes: row.notes ?? '',
              })
            }
          >
            Edit
          </Button>
          {row.status === 'ACTIVE' ? (
            <Button size="sm" variant="destructive" onClick={() => setDecision({ manager: row, next: 'BLOCKED' })}>
              Suspend
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setDecision({ manager: row, next: 'ACTIVE' })}>
              Reactivate
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
        actions={<Button onClick={() => navigate('/managers/create')}>Create manager</Button>}
      />

      <FilterBar>
        <FilterField label="Search">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or email" className="w-56" />
        </FilterField>
        <FilterField label="Status">
          <Select value={status} onChange={(event) => setStatus(event.target.value as UserStatus | '')} className="w-40">
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="BLOCKED">Suspended</option>
            <option value="INACTIVE">Inactive</option>
          </Select>
        </FilterField>
      </FilterBar>

      {managers.error && <p className="text-sm text-destructive">{managers.error}</p>}

      {managers.loading ? (
        <TableSkeleton columns={11} />
      ) : (
        <DataTable
          columns={columns}
          rows={managers.data ?? []}
          getRowKey={(row) => row.id}
          emptyMessage="No managers match these filters."
        />
      )}

      <Modal open={!!edit} onOpenChange={(open) => !open && setEdit(null)} title="Edit manager" className="max-w-4xl">
        {edit && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="block sm:col-span-2">
              <span className="text-xs font-medium text-muted-foreground">Avatar</span>
              <div className="mt-1 flex items-center gap-3">
                {edit.avatarUrl && (
                  <img src={edit.avatarUrl} alt="" className="size-12 shrink-0 rounded-full border border-border object-cover" />
                )}
                <div className="space-y-1">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    disabled={uploadingAvatar}
                    onChange={(event) => void handleAvatarUpload(event.target.files?.[0])}
                    className="text-xs text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:text-secondary-foreground hover:file:bg-accent"
                  />
                  {uploadingAvatar && <p className="text-xs text-muted-foreground">Uploading…</p>}
                </div>
              </div>
            </div>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Full name</span>
              <Input value={edit.fullName} onChange={(event) => setEdit({ ...edit, fullName: event.target.value })} className="mt-1" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Role</span>
              <Select
                value={edit.managerRole}
                onChange={(event) => setEdit({ ...edit, managerRole: event.target.value as ManagerRole })}
                className="mt-1"
              >
                {(Object.keys(ROLE_LABELS) as ManagerRole[]).map((option) => (
                  <option key={option} value={option}>
                    {ROLE_LABELS[option]}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Phone</span>
              <Input value={edit.phone} onChange={(event) => setEdit({ ...edit, phone: event.target.value })} className="mt-1" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Telegram</span>
              <Input value={edit.telegram} onChange={(event) => setEdit({ ...edit, telegram: event.target.value })} className="mt-1" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Microsoft Teams</span>
              <Input value={edit.teams} onChange={(event) => setEdit({ ...edit, teams: event.target.value })} className="mt-1" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Contact email</span>
              <Input
                type="email"
                value={edit.contactEmail}
                onChange={(event) => setEdit({ ...edit, contactEmail: event.target.value })}
                placeholder="Shown to affiliates instead of the login email"
                className="mt-1"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Default commission %</span>
              <Input
                type="number"
                min={0}
                max={100}
                value={edit.defaultCommissionPercent}
                onChange={(event) => setEdit({ ...edit, defaultCommissionPercent: event.target.value })}
                className="mt-1"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Reports to</span>
              <Select
                value={edit.reportsToId}
                onChange={(event) => setEdit({ ...edit, reportsToId: event.target.value })}
                className="mt-1"
              >
                <option value="">Nobody</option>
                {(managers.data ?? [])
                  // A manager reporting to themselves would make the org chart cyclic.
                  .filter((manager) => manager.id !== edit.id)
                  .map((manager) => (
                    <option key={manager.id} value={manager.id}>
                      {manager.fullName ?? manager.email}
                    </option>
                  ))}
              </Select>
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-muted-foreground">Notes</span>
              <Textarea rows={3} value={edit.notes} onChange={(event) => setEdit({ ...edit, notes: event.target.value })} className="mt-1" />
            </label>
            <div className="sm:col-span-2">
              <p className="text-xs font-medium text-muted-foreground">Permissions</p>
              <p className="mb-3 mt-0.5 text-xs text-muted-foreground">
                Applies only to the affiliates assigned to this manager. Un-ticking a box revokes it immediately.
              </p>
              <PermissionGrid value={edit.permissions} onChange={(permissions) => setEdit({ ...edit, permissions })} />
            </div>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button variant="outline" onClick={() => setEdit(null)}>
                Cancel
              </Button>
              <Button disabled={saving} onClick={saveEdit}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={!!decision}
        onOpenChange={(open) => !open && setDecision(null)}
        title={decision?.next === 'BLOCKED' ? 'Suspend this manager?' : 'Reactivate this manager?'}
        description={
          decision
            ? decision.next === 'BLOCKED'
              ? `${decision.manager.fullName ?? decision.manager.email} loses access to this portal immediately.`
              : `${decision.manager.fullName ?? decision.manager.email} can log in again.`
            : ''
        }
        confirmLabel={decision?.next === 'BLOCKED' ? 'Suspend' : 'Reactivate'}
        destructive={decision?.next === 'BLOCKED'}
        loading={decisionSaving}
        onConfirm={confirmDecision}
      />
    </div>
  );
}

export function AffiliateManagers() {
  return (
    <Managers
      role="AFFILIATE"
      title="Affiliate managers"
      description="Staff who own affiliate relationships — recruiting, approving applications and answering their messages."
    />
  );
}

export function AccountManagers() {
  return (
    <Managers
      role="ACCOUNT"
      title="Account managers"
      description="Staff who own advertiser relationships and the offers those advertisers run."
    />
  );
}

export function GeneralManagers() {
  return (
    <Managers
      role="GENERAL"
      title="General managers"
      description="Senior staff the other manager roles report to."
    />
  );
}
