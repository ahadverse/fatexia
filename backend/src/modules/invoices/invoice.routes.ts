import { Router } from 'express';
import { validate } from '../../common/validate';
import { requireAuth } from '../../common/guards/auth.guard';
import { requireRole } from '../../common/guards/role.guard';
import { UserRole } from '../users/user.entity';
import { invoiceController } from './invoice.controller';
import {
  createManualInvoiceSchema,
  generatePayoutBatchSchema,
  invoiceFiltersSchema,
  releaseInvoiceSchema,
  updateInvoiceStatusSchema,
} from './invoice.dto';

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
// The unrestricted, one-affiliate path: no threshold, no hold window if waived, no
// requirement that conversions exist or that the amount be above zero. Its own route
// rather than a flag on /batch so the rules each path applies stay legible.
invoiceRoutes.post('/manual', validate(createManualInvoiceSchema), invoiceController.createManual);
invoiceRoutes.patch('/:id/status', validate(updateInvoiceStatusSchema), invoiceController.updateStatus);
// Cancels the invoice and returns its conversions to the payable pool. Separate from a
// status change because it moves money-bearing rows, which rejecting alone does not.
invoiceRoutes.post('/:id/release', validate(releaseInvoiceSchema), invoiceController.release);
// Hard delete — restricted to REJECTED invoices in the service. A PAID one represents
// money that actually moved and is never deletable.
invoiceRoutes.delete('/:id', invoiceController.deleteInvoice);
