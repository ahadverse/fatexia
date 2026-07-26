export type UserRole = 'ADMIN' | 'MANAGER' | 'AFFILIATE';
export type UserStatus = 'ACTIVE' | 'PENDING' | 'BLOCKED' | 'REJECTED' | 'INACTIVE';

export interface PublicUser {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  lastLogin: string | null;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
