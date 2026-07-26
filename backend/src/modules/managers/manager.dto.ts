import { z } from 'zod';
import { UserStatus } from '../users/user.entity';
import { ManagerRole, type Manager } from './manager.entity';

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

export const createManagerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(255),
  fullName: z.string().trim().min(2).max(120),
  managerRole: z.nativeEnum(ManagerRole),
  phone: optionalText(40),
  skype: optionalText(120),
  defaultCommissionPercent: z.number().int().min(0).max(100).default(0),
  reportsToId: z.string().uuid().optional().nullable(),
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
  userId: string;
  email: string;
  status: UserStatus;
  fullName: string | null;
  managerRole: ManagerRole;
  phone: string | null;
  skype: string | null;
  defaultCommissionPercent: number;
  reportsToId: string | null;
  notes: string | null;
  assignedAffiliateCount: number;
  lastLogin: string | null;
  createdAt: string;
}

export function toManagerDto(manager: Manager, assignedAffiliateCount = 0): ManagerDto {
  return {
    id: manager.id,
    userId: manager.userId,
    email: manager.user?.email ?? '',
    status: manager.user?.status ?? UserStatus.PENDING,
    fullName: manager.fullName,
    managerRole: manager.managerRole,
    phone: manager.phone,
    skype: manager.skype,
    defaultCommissionPercent: manager.defaultCommissionPercent,
    reportsToId: manager.reportsToId,
    notes: manager.notes,
    assignedAffiliateCount,
    lastLogin: manager.user?.lastLogin?.toISOString() ?? null,
    createdAt: manager.createdAt.toISOString(),
  };
}
