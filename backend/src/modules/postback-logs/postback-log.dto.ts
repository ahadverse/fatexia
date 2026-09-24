import { z } from 'zod';
import { paginationSchema } from '../../common/pagination';
import { PostbackDirection, type PostbackLog } from './postback-log.entity';

export const postbackLogFiltersSchema = paginationSchema.extend({
  direction: z.nativeEnum(PostbackDirection).optional(),
  offerId: z.string().uuid().optional(),
  affiliateId: z.string().uuid().optional(),
  conversionId: z.string().uuid().optional(),
  success: z.coerce.boolean().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export type PostbackLogFiltersDto = z.infer<typeof postbackLogFiltersSchema>;

// Capped well above a single page (50 rows) — "select all on this page" is the only
// way the UI builds this list, but the cap still bounds a hand-crafted request.
export const bulkDeletePostbackLogsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
});

export type BulkDeletePostbackLogsDto = z.infer<typeof bulkDeletePostbackLogsSchema>;

export interface PostbackLogDto {
  id: string;
  conversionId: string | null;
  offerId: string | null;
  offerName: string | null;
  affiliateId: string | null;
  affiliateName: string | null;
  direction: PostbackDirection;
  url: string | null;
  payload: Record<string, unknown>;
  responseStatus: number | null;
  success: boolean;
  errorMessage: string | null;
  attemptCount: number;
  sourceIp: string | null;
  createdAt: string;
}

export function toPostbackLogDto(
  log: PostbackLog,
  context: { offerName?: string | null; affiliateName?: string | null } = {},
): PostbackLogDto {
  return {
    id: log.id,
    conversionId: log.conversionId,
    offerId: log.offerId,
    offerName: context.offerName ?? null,
    affiliateId: log.affiliateId,
    affiliateName: context.affiliateName ?? null,
    direction: log.direction,
    url: log.url,
    payload: log.payload ?? {},
    responseStatus: log.responseStatus,
    success: log.success,
    errorMessage: log.errorMessage,
    attemptCount: log.attemptCount,
    sourceIp: log.sourceIp,
    createdAt: log.createdAt.toISOString(),
  };
}
