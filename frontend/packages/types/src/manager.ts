import type { UserStatus } from './user';

export type ManagerRole = 'GENERAL' | 'ACCOUNT' | 'AFFILIATE';

export interface Manager {
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

export interface CreateManagerInput {
  email: string;
  password: string;
  fullName: string;
  managerRole: ManagerRole;
  phone?: string;
  skype?: string;
  defaultCommissionPercent?: number;
  reportsToId?: string | null;
  notes?: string;
  status?: UserStatus;
}

export type UpdateManagerInput = Partial<Omit<CreateManagerInput, 'email' | 'password' | 'status'>>;
