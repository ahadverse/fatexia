import type { CreateManagerInput, Manager, ManagerRole, UpdateManagerInput, UserStatus } from '@fatexia/types';
import { apiFetch } from './api';
import { toQuery } from './query';

export interface ManagerFilters {
  managerRole?: ManagerRole | '';
  status?: UserStatus | '';
  search?: string;
}

export function getManagers(filters: ManagerFilters = {}): Promise<Manager[]> {
  return apiFetch<Manager[]>(`/managers${toQuery({ ...filters })}`);
}

export function getManager(id: string): Promise<Manager> {
  return apiFetch<Manager>(`/managers/${id}`);
}

/**
 * The signed-in manager's own profile and permission grid (issue #20).
 *
 * MANAGER-role only — an admin has no manager row, so AccessContext never calls this
 * for one.
 */
export function getOwnManager(): Promise<Manager> {
  return apiFetch<Manager>('/managers/me');
}

export function createManager(input: CreateManagerInput): Promise<Manager> {
  return apiFetch<Manager>('/managers', { method: 'POST', body: JSON.stringify(input) });
}

export function updateManager(id: string, input: UpdateManagerInput): Promise<Manager> {
  return apiFetch<Manager>(`/managers/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function updateManagerStatus(id: string, status: UserStatus): Promise<Manager> {
  return apiFetch<Manager>(`/managers/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
}
