import { Router } from 'express';
import { validate } from '../../common/validate';
import { clickController } from './click.controller';
import { clickQuerySchema, smartLinkClickParamsSchema, smartLinkClickQuerySchema } from './click.dto';

export const clickRoutes = Router();

clickRoutes.get('/', validate(clickQuerySchema, 'query'), clickController.handleClick);

// Mounted on the Tracker at `/sl` — the address `smart-link.dto.ts` hands affiliates.
// Public and unauthenticated, exactly like `/click`: it is a link a visitor follows.
export const smartLinkClickRoutes = Router();

smartLinkClickRoutes.get(
  '/:slug',
  validate(smartLinkClickParamsSchema, 'params'),
  validate(smartLinkClickQuerySchema, 'query'),
  clickController.handleSmartLinkClick,
);
