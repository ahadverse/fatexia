import { z } from 'zod';
import { paginationSchema } from '../../common/pagination';
import { CampaignAudience, CampaignRecipientStatus } from './email-campaign.entity';
import type { CampaignStatus } from './email-campaign.entity';

/** Filled in per recipient at send time, so never asked of the admin. */
export const RECIPIENT_MACROS = ['first_name', 'full_name', 'email', 'public_id'] as const;

export const audienceQuerySchema = z.object({
  activeOnly: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
});

export const createCampaignSchema = z.object({
  audience: z.nativeEnum(CampaignAudience),
  activeOnly: z.boolean().default(true),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(20000),
  macros: z.record(z.string().max(500)).optional(),
  // The count the admin confirmed on screen. A mismatch means the audience changed
  // between the dialog and the click, and the send is refused instead of going to a
  // different number of people than the admin agreed to.
  expectedRecipients: z.number().int().min(0),
});

export type CreateCampaignDto = z.infer<typeof createCampaignSchema>;

export const campaignListQuerySchema = paginationSchema;

export const campaignRecipientsQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(CampaignRecipientStatus).optional(),
});

export type CampaignRecipientsQuery = z.infer<typeof campaignRecipientsQuerySchema>;

export interface AudienceCountsDto {
  ALL: number;
  AFFILIATES: number;
  ADVERTISERS: number;
  MANAGERS: number;
}

export interface CampaignDto {
  id: string;
  subject: string;
  body: string;
  audience: CampaignAudience;
  activeOnly: boolean;
  status: CampaignStatus;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  pendingCount: number;
  createdByEmail: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface CampaignRecipientDto {
  id: string;
  email: string;
  kind: string;
  fullName: string | null;
  status: CampaignRecipientStatus;
  error: string | null;
  sentAt: string | null;
}
