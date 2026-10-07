import { Router, type NextFunction, type Response } from 'express';
import { validate } from '../../common/validate';
import type { AuthenticatedRequest } from '../../common/guards/auth.guard';
import { emailCampaignService } from './email-campaign.service';
import {
  audienceQuerySchema,
  campaignListQuerySchema,
  campaignRecipientsQuerySchema,
  createCampaignSchema,
  type CampaignRecipientsQuery,
  type CreateCampaignDto,
} from './email-campaign.dto';
import type { PaginationDto } from '../../common/pagination';

type Handler = (req: AuthenticatedRequest, res: Response) => Promise<unknown>;

// Mounted under /emails, which already requires an authenticated ADMIN.
function handle(fn: Handler) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    fn(req, res).then((body) => res.json(body), next);
  };
}

export const emailCampaignRoutes = Router();

emailCampaignRoutes.get(
  '/audiences',
  validate(audienceQuerySchema, 'query'),
  handle(async (req) => emailCampaignService.audienceCounts((req.query as unknown as { activeOnly: boolean }).activeOnly)),
);

emailCampaignRoutes.get(
  '/',
  validate(campaignListQuerySchema, 'query'),
  handle(async (req) => emailCampaignService.list(req.query as unknown as PaginationDto)),
);

emailCampaignRoutes.post(
  '/',
  validate(createCampaignSchema),
  handle(async (req, res) => {
    res.status(201);
    return emailCampaignService.create(req.body as CreateCampaignDto, req.user!.id);
  }),
);

emailCampaignRoutes.get('/:id', handle(async (req) => emailCampaignService.get(String(req.params.id))));

emailCampaignRoutes.get(
  '/:id/recipients',
  validate(campaignRecipientsQuerySchema, 'query'),
  handle(async (req) =>
    emailCampaignService.recipients(String(req.params.id), req.query as unknown as CampaignRecipientsQuery),
  ),
);

emailCampaignRoutes.post('/:id/cancel', handle(async (req) => emailCampaignService.cancel(String(req.params.id))));

emailCampaignRoutes.post('/:id/retry', handle(async (req) => emailCampaignService.retryFailed(String(req.params.id))));
