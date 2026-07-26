import { Router } from 'express';
import { validate } from '../../common/validate';
import { requireAuth } from '../../common/guards/auth.guard';
import { requireRole } from '../../common/guards/role.guard';
import { UserRole } from '../users/user.entity';
import { networkSettingController } from './network-setting.controller';
import { updateNetworkSettingsSchema } from './network-setting.dto';

// Admin-only both ways — Managers are locked out of network settings entirely
// (PLAN-backend.md permission matrix).
export const networkSettingRoutes = Router();

networkSettingRoutes.use(requireAuth, requireRole(UserRole.ADMIN));

networkSettingRoutes.get('/', networkSettingController.getSettings);
networkSettingRoutes.patch('/', validate(updateNetworkSettingsSchema), networkSettingController.updateSettings);
