import { Router } from 'express';
import { validate } from '../../common/validate';
import { requireAuth } from '../../common/guards/auth.guard';
import { requireRole } from '../../common/guards/role.guard';
import { UserRole } from '../users/user.entity';
import { globalPostbackService } from './global-postback.service';
import { createGlobalPostbackSchema, updateGlobalPostbackSchema } from './global-postback.dto';

/**
 * Admin-only. These entries authorise conversions for every offer at once and fire
 * network-wide outbound calls — the same class of network-level control as Integrations
 * and Network Settings, which managers also cannot reach.
 */
export const globalPostbackRoutes = Router();

globalPostbackRoutes.use(requireAuth, requireRole(UserRole.ADMIN));

globalPostbackRoutes.get('/', async (_req, res, next) => {
  try {
    res.json(await globalPostbackService.list());
  } catch (err) {
    next(err);
  }
});

globalPostbackRoutes.post('/', validate(createGlobalPostbackSchema), async (req, res, next) => {
  try {
    res.status(201).json(await globalPostbackService.create(req.body));
  } catch (err) {
    next(err);
  }
});

globalPostbackRoutes.patch('/:id', validate(updateGlobalPostbackSchema), async (req, res, next) => {
  try {
    res.json(await globalPostbackService.update(req.params.id!, req.body));
  } catch (err) {
    next(err);
  }
});

globalPostbackRoutes.delete('/:id', async (req, res, next) => {
  try {
    await globalPostbackService.remove(req.params.id!);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
