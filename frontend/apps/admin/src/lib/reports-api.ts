import type {
  AffiliateOfferCr,
  ClickLog,
  Conversion,
  ConversionStatus,
  ConversionTotals,
  CrAnomaly,
  Dashboard,
  GroupedReport,
  Paginated,
  PostbackLog,
  ReportDimension,
  ReportFilters,
  ReportRow,
} from '@fatexia/types';
import { apiFetch } from './api';
import { toQuery } from './query';

export function getDashboard(filters: ReportFilters = {}): Promise<Dashboard> {
  return apiFetch<Dashboard>(`/dashboard${toQuery({ ...filters })}`);
}

// One endpoint backs Performance, Sub-ID Tracking, Advanced Reports and the
// per-offer/affiliate/advertiser pages — they differ only by `groupBy`.
export function getGroupedReport(groupBy: ReportDimension, filters: ReportFilters = {}, limit = 100): Promise<GroupedReport> {
  return apiFetch<GroupedReport>(`/reports/grouped${toQuery({ groupBy, limit, ...filters })}`);
}

export function getTrend(filters: ReportFilters = {}): Promise<ReportRow[]> {
  return apiFetch<ReportRow[]>(`/reports/trend${toQuery({ ...filters })}`);
}

export interface CrOptimizerParams {
  recentDays?: number;
  baselineDays?: number;
  minClicks?: number;
}

export function getOfferCrOptimizer(params: CrOptimizerParams = {}): Promise<CrAnomaly[]> {
  return apiFetch<CrAnomaly[]>(`/reports/cr/offers${toQuery({ ...params })}`);
}

export function getAffiliateCrOptimizer(params: CrOptimizerParams = {}): Promise<CrAnomaly[]> {
  return apiFetch<CrAnomaly[]>(`/reports/cr/affiliates${toQuery({ ...params })}`);
}

export function getAffiliateOfferCr(filters: ReportFilters = {}): Promise<AffiliateOfferCr[]> {
  return apiFetch<AffiliateOfferCr[]>(`/reports/cr/affiliate-offer${toQuery({ ...filters })}`);
}

export interface ClickLogFilters {
  offerId?: string;
  affiliateId?: string;
  qualityStatus?: string;
  countryCode?: string;
  subId1?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortDir?: 'ASC' | 'DESC';
  page?: number;
  pageSize?: number;
}

// The page carries its own totals so the stat tiles reflect the filtered set rather
// than only the 50 rows currently on screen.
export interface ClickLogPage extends Paginated<ClickLog> {
  summary: { clicks: number; uniqueClicks: number };
}

export function getClickLogs(filters: ClickLogFilters = {}): Promise<ClickLogPage> {
  return apiFetch<ClickLogPage>(`/click-logs${toQuery({ ...filters })}`);
}

/** Countries that actually have click traffic — the filter dropdown's option list. */
export function getClickCountries(): Promise<string[]> {
  return apiFetch<string[]>('/click-logs/countries');
}

export interface ConversionFilters {
  offerId?: string;
  affiliateId?: string;
  status?: ConversionStatus | '';
  countryCode?: string;
  subId1?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface ConversionList extends Paginated<Conversion> {
  totals: ConversionTotals;
}

export function getConversions(filters: ConversionFilters = {}): Promise<ConversionList> {
  return apiFetch<ConversionList>(`/conversions${toQuery({ ...filters })}`);
}

export function updateConversionStatus(id: string, status: ConversionStatus): Promise<Conversion> {
  return apiFetch<Conversion>(`/conversions/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
}

export interface PostbackLogFilters {
  direction?: string;
  offerId?: string;
  affiliateId?: string;
  success?: boolean;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export function getPostbackLogs(filters: PostbackLogFilters = {}): Promise<Paginated<PostbackLog>> {
  return apiFetch<Paginated<PostbackLog>>(`/postback-logs${toQuery({ ...filters })}`);
}
