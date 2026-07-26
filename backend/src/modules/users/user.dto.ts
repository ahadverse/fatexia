import { z } from 'zod';
import type { User } from './user.entity';

export interface PublicUserDto {
  id: string;
  email: string;
  role: User['role'];
  status: User['status'];
  lastLogin: Date | null;
}

export function toPublicUser(user: User): PublicUserDto {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    lastLogin: user.lastLogin,
  };
}

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(255),
});

export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;
