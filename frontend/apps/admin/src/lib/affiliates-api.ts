import type {
  Affiliate,
  AffiliateGroup,
  AffiliatePoint,
  AffiliatePointBalance,
  CreateAffiliateGroupInput,
  CreateAffiliateInput,
  Paginated,
  UpdateAffiliateInput,
  UserStatus,
} from '@fatexia/types';
import { apiFetch } from './api';
import { toQuery } from './query';

export interface AffiliateFilters {
  status?: UserStatus | '';
  country?: string;
  assignedManagerId?: string;
  referredByAffiliateId?: string;
  search?: string;
}

export function getAffiliates(filters: AffiliateFilters = {}): Promise<Affiliate[]> {
  return apiFetch<Affiliate[]>(`/affiliates${toQuery({ ...filters })}`);
}

export function getAffiliate(id: string): Promise<Affiliate> {
  return apiFetch<Affiliate>(`/affiliates/${id}`);
}

export function createAffiliate(input: CreateAffiliateInput): Promise<Affiliate> {
  return apiFetch<Affiliate>('/affiliates', { method: 'POST', body: JSON.stringify(input) });
}

export function updateAffiliate(id: string, input: UpdateAffiliateInput): Promise<Affiliate> {
  return apiFetch<Affiliate>(`/affiliates/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function updateAffiliateStatus(id: string, status: UserStatus): Promise<Affiliate> {
  return apiFetch<Affiliate>(`/affiliates/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
}

export function getAffiliateGroups(): Promise<AffiliateGroup[]> {
  return apiFetch<AffiliateGroup[]>('/affiliate-groups');
}

export function createAffiliateGroup(input: CreateAffiliateGroupInput): Promise<AffiliateGroup> {
  return apiFetch<AffiliateGroup>('/affiliate-groups', { method: 'POST', body: JSON.stringify(input) });
}

export function updateAffiliateGroup(id: string, input: Partial<CreateAffiliateGroupInput>): Promise<AffiliateGroup> {
  return apiFetch<AffiliateGroup>(`/affiliate-groups/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function deleteAffiliateGroup(id: string): Promise<void> {
  return apiFetch<void>(`/affiliate-groups/${id}`, { method: 'DELETE' });
}

export function getAffiliatePoints(params: { affiliateId?: string; page?: number; pageSize?: number } = {}): Promise<Paginated<AffiliatePoint>> {
  return apiFetch<Paginated<AffiliatePoint>>(`/affiliate-points${toQuery({ ...params })}`);
}

export function getAffiliatePointBalances(): Promise<AffiliatePointBalance[]> {
  return apiFetch<AffiliatePointBalance[]>('/affiliate-points/balances');
}

export function adjustAffiliatePoints(input: { affiliateId: string; points: number; reason: string }): Promise<AffiliatePoint> {
  return apiFetch<AffiliatePoint>('/affiliate-points', { method: 'POST', body: JSON.stringify(input) });
}
