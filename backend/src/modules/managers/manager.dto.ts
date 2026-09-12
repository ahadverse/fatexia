import { z } from 'zod';
import { UserStatus } from '../users/user.entity';
import { MANAGER_PERMISSION_KEYS, ManagerRole, type Manager, type ManagerPermissions } from './manager.entity';

export const managerFiltersSchema = z.object({
  managerRole: z.nativeEnum(ManagerRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  search: z.string().optional(),
});

export type ManagerFiltersDto = z.infer<typeof managerFiltersSchema>;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal('').transform(() => undefined));

/**
 * Normalises the permission grid on the way in (issue #20).
 *
 * Both directions of the normalisation matter: keys the server doesn't know are
 * dropped rather than stored (so a stale portal build can't persist a permission no
 * guard reads), and an explicit `false` is dropped rather than saved, keeping "absent
 * means not granted" the single representation of a denied capability.
 */
const permissionsSchema = z.record(z.string(), z.boolean()).transform((raw): ManagerPermissions => {
  const permissions: ManagerPermissions = {};
  for (const key of MANAGER_PERMISSION_KEYS) {
    if (raw[key] === true) permissions[key] = true;
  }
  return permissions;
});

const optionalEmail = () =>
  z
    .string()
    .trim()
    .email()
    .max(255)
    .optional()
    .or(z.literal('').transform(() => undefined));

export const createManagerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(255),
  fullName: z.string().trim().min(2).max(120),
  managerRole: z.nativeEnum(ManagerRole),
  phone: optionalText(40),
  skype: optionalText(120),
  telegram: optionalText(120),
  teams: optionalText(120),
  contactEmail: optionalEmail(),
  avatarUrl: optionalText(500),
  defaultCommissionPercent: z.number().int().min(0).max(100).default(0),
  reportsToId: z.string().uuid().optional().nullable(),
  permissions: permissionsSchema.optional(),
  notes: optionalText(1000),
  status: z.nativeEnum(UserStatus).default(UserStatus.ACTIVE),
});

export type CreateManagerDto = z.infer<typeof createManagerSchema>;

export const updateManagerSchema = createManagerSchema.omit({ email: true, password: true, status: true }).partial();

export type UpdateManagerDto = z.infer<typeof updateManagerSchema>;

export const updateManagerStatusSchema = z.object({
  status: z.nativeEnum(UserStatus),
});

export type UpdateManagerStatusDto = z.infer<typeof updateManagerStatusSchema>;

export interface ManagerDto {
  id: string;
  publicId: string | null;
  userId: string;
  email: string;
  status: UserStatus;
  fullName: string | null;
  managerRole: ManagerRole;
  phone: string | null;
  skype: string | null;
  telegram: string | null;
  teams: string | null;
  contactEmail: string | null;
  avatarUrl: string | null;
  defaultCommissionPercent: number;
  reportsToId: string | null;
  permissions: ManagerPermissions;
  notes: string | null;
  assignedAffiliateCount: number;
  lastLogin: string | null;
  createdAt: string;
}

export function toManagerDto(manager: Manager, assignedAffiliateCount = 0): ManagerDto {
  return {
    id: manager.id,
    publicId: manager.publicId,
    userId: manager.userId,
    email: manager.user?.email ?? '',
    status: manager.user?.status ?? UserStatus.PENDING,
    fullName: manager.fullName,
    managerRole: manager.managerRole,
    phone: manager.phone,
    skype: manager.skype,
    telegram: manager.telegram,
    teams: manager.teams,
    contactEmail: manager.contactEmail,
    avatarUrl: manager.avatarUrl,
    defaultCommissionPercent: manager.defaultCommissionPercent,
    reportsToId: manager.reportsToId,
    permissions: manager.permissions ?? {},
    notes: manager.notes,
    assignedAffiliateCount,
    lastLogin: manager.user?.lastLogin?.toISOString() ?? null,
    createdAt: manager.createdAt.toISOString(),
  };
}

/**
 * What an affiliate is allowed to see about the manager who owns their account
 * (issue #6 — the contact card in their sidebar).
 *
 * A separate, deliberately small shape rather than `ManagerDto`: the affiliate-facing
 * card must never carry commission percentages, internal notes, the permission grid,
 * or the reporting chain.
 */
export interface AffiliateManagerContactDto {
  /**
   * SUPPORT when no active manager owns this affiliate.
   *
   * Most affiliates are in that state — a self-registration with no referral code
   * lands unassigned, which is "under the admin directly". Returning a support desk
   * rather than null lets the portal render one card design for everyone, instead of
   * a designed card for some affiliates and a bare paragraph for the rest.
   */
  kind: 'MANAGER' | 'SUPPORT';
  publicId: string | null;
  fullName: string | null;
  email: string;
  phone: string | null;
  skype: string | null;
  telegram: string | null;
  teams: string | null;
  avatarUrl: string | null;
  /** Null for the SUPPORT fallback, which is a desk rather than a person. */
  managerRole: ManagerRole | null;
}

export function toManagerContactDto(manager: Manager): AffiliateManagerContactDto {
  return {
    kind: 'MANAGER',
    publicId: manager.publicId,
    fullName: manager.fullName,
    // The public-facing contact address wins over the login email when the manager
    // has set one — an affiliate should never be pointed at a sign-in credential.
    email: manager.contactEmail ?? manager.user?.email ?? '',
    phone: manager.phone,
    skype: manager.skype,
    telegram: manager.telegram,
    teams: manager.teams,
    avatarUrl: manager.avatarUrl,
    managerRole: manager.managerRole,
  };
}

export function toSupportContactDto(
  networkName: string,
  supportEmail: string | null,
  supportTelegram: string | null = null,
): AffiliateManagerContactDto {
  return {
    kind: 'SUPPORT',
    publicId: null,
    fullName: `${networkName} Support`,
    email: supportEmail ?? '',
    phone: null,
    skype: null,
    telegram: supportTelegram,
    teams: null,
    avatarUrl: null,
    managerRole: null,
  };
}
