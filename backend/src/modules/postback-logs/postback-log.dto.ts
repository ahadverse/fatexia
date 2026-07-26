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
