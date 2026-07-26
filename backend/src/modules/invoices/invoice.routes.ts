import { Router } from 'express';
import { validate } from '../../common/validate';
import { requireAuth } from '../../common/guards/auth.guard';
import { requireRole } from '../../common/guards/role.guard';
import { UserRole } from '../users/user.entity';
import { invoiceController } from './invoice.controller';
import { generatePayoutBatchSchema, invoiceFiltersSchema, updateInvoiceStatusSchema } from './invoice.dto';

export const invoiceRoutes = Router();

// Affiliate self-service, ahead of the admin guards and of `/:id`.
invoiceRoutes.get(
  '/mine',
  requireAuth,
  requireRole(UserRole.AFFILIATE),
  validate(invoiceFiltersSchema, 'query'),
  invoiceController.getOwnInvoices,
);
invoiceRoutes.get('/mine/balance', requireAuth, requireRole(UserRole.AFFILIATE), invoiceController.getOwnBalance);

// Managers may read billing but cannot trigger a payout batch or mark money as sent
// (PLAN-backend.md permission matrix) — hence the split guards below.
invoiceRoutes.get(
  '/',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.MANAGER),
  validate(invoiceFiltersSchema, 'query'),
  invoiceController.getInvoices,
);

invoiceRoutes.use(requireAuth, requireRole(UserRole.ADMIN));

invoiceRoutes.get('/pending-balances', invoiceController.getPendingBalances);
invoiceRoutes.get('/:id', invoiceController.getInvoice);
invoiceRoutes.post('/batch', validate(generatePayoutBatchSchema), invoiceController.generateBatch);
invoiceRoutes.patch('/:id/status', validate(updateInvoiceStatusSchema), invoiceController.updateStatus);
