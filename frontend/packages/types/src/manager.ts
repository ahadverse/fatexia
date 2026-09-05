import type { UserStatus } from './user';

export type ManagerRole = 'GENERAL' | 'ACCOUNT' | 'AFFILIATE';

/**
 * The capability checkboxes an admin ticks per manager (issue #20).
 *
 * Mirrors `MANAGER_PERMISSION_KEYS` in the Backend's `manager.entity.ts`, which is the
 * authority: the server drops any key it does not recognise, so a key added here alone
 * renders a checkbox that silently never saves. Add it in both places or neither.
 */
export const MANAGER_PERMISSION_KEYS = [
  'affiliates.view',
  'affiliates.create',
  'affiliates.edit',
  'affiliates.approve',
  'affiliates.suspend',
  'affiliates.reject',
  'affiliates.delete',
  'affiliates.payout',
  'affiliates.impersonate',
  'offers.view',
  'offers.create',
  'offers.edit',
  'advertisers.manage',
  'reports.view',
  'messages.send',
] as const;

export type ManagerPermission = (typeof MANAGER_PERMISSION_KEYS)[number];

/** Absent key means "not granted" — the server never stores an explicit `false`. */
export type ManagerPermissions = Partial<Record<ManagerPermission, boolean>>;

export interface ManagerPermissionGroup {
  label: string;
  permissions: { key: ManagerPermission; label: string; hint?: string }[];
}

// Grouped for the checkbox grid so an admin reads "what can they do with affiliates"
// rather than a flat list of fifteen dotted keys.
export const MANAGER_PERMISSION_GROUPS: ManagerPermissionGroup[] = [
  {
    label: 'Affiliates',
    permissions: [
      { key: 'affiliates.view', label: 'View affiliates', hint: 'Only the affiliates assigned to them.' },
      { key: 'affiliates.create', label: 'Create affiliates', hint: 'New accounts are assigned to them automatically.' },
      { key: 'affiliates.edit', label: 'Edit affiliate details' },
      { key: 'affiliates.approve', label: 'Approve applications' },
      { key: 'affiliates.reject', label: 'Reject applications' },
      { key: 'affiliates.suspend', label: 'Suspend or deactivate' },
      { key: 'affiliates.delete', label: 'Delete affiliates' },
      { key: 'affiliates.payout', label: 'Change payout details', hint: 'Affiliates cannot set their own — someone must.' },
      { key: 'affiliates.impersonate', label: 'Log in as an affiliate' },
    ],
  },
  {
    label: 'Offers & advertisers',
    permissions: [
      { key: 'offers.view', label: 'View offers' },
      { key: 'offers.create', label: 'Create offers' },
      { key: 'offers.edit', label: 'Edit offers and change their status' },
      { key: 'advertisers.manage', label: 'Create and edit advertisers' },
    ],
  },
  {
    label: 'Other',
    permissions: [
      { key: 'reports.view', label: 'View reports' },
      { key: 'messages.send', label: 'Message affiliates' },
    ],
  },
];

export function hasPermission(permissions: ManagerPermissions | undefined, permission: ManagerPermission): boolean {
  return permissions?.[permission] === true;
}

export interface Manager {
  id: string;
  /** Sequential display id — `MAN-1001` upward (issue #21). */
  publicId: string | null;
  userId: string;
  email: string;
  status: UserStatus;
  fullName: string | null;
  managerRole: ManagerRole;
  phone: string | null;
  skype: string | null;
  defaultCommissionPercent: number;
  reportsToId: string | null;
  permissions: ManagerPermissions;
  notes: string | null;
  assignedAffiliateCount: number;
  lastLogin: string | null;
  createdAt: string;
}

/**
 * What an affiliate is allowed to see about their own manager (issue #6) — no
 * commission percentages, notes, permissions or reporting chain.
 */
export interface AffiliateManagerContact {
  /** SUPPORT when no active manager owns the affiliate — the card renders the same either way. */
  kind: 'MANAGER' | 'SUPPORT';
  publicId: string | null;
  fullName: string | null;
  email: string;
  phone: string | null;
  skype: string | null;
  /** Null for the SUPPORT fallback, which is a desk rather than a person. */
  managerRole: ManagerRole | null;
}

export interface CreateManagerInput {
  email: string;
  password: string;
  fullName: string;
  managerRole: ManagerRole;
  phone?: string;
  skype?: string;
  defaultCommissionPercent?: number;
  reportsToId?: string | null;
  permissions?: ManagerPermissions;
  notes?: string;
  status?: UserStatus;
}

export type UpdateManagerInput = Partial<Omit<CreateManagerInput, 'email' | 'password' | 'status'>>;
