import { Router } from 'express';
import { requireAuth } from '../../common/guards/auth.guard';
import { requireRole } from '../../common/guards/role.guard';
import { UserRole } from '../users/user.entity';
import { geoipController } from './geoip.controller';

// Admin-only — this triggers a real download on the Tracker service and MaxMind
// rate-limits it, so it isn't something any logged-in role should be able to fire.
export const geoipRoutes = Router();

geoipRoutes.use(requireAuth, requireRole(UserRole.ADMIN));

geoipRoutes.get('/status', geoipController.getStatus);
geoipRoutes.post('/fetch', geoipController.fetchNow);
