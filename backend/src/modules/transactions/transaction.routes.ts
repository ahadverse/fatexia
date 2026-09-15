import { Router } from 'express';
import { validate } from '../../common/validate';
import { requireAuth } from '../../common/guards/auth.guard';
import { requireRole } from '../../common/guards/role.guard';
import { UserRole } from '../users/user.entity';
import { transactionController } from './transaction.controller';
import { recordAdjustmentSchema, transactionFiltersSchema } from './transaction.dto';

export const transactionRoutes = Router();

// Affiliate self-service, ahead of the admin guards.
transactionRoutes.get(
  '/mine',
  requireAuth,
  requireRole(UserRole.AFFILIATE),
  validate(transactionFiltersSchema, 'query'),
  transactionController.getOwnTransactions,
);

// Same split as the invoice routes: a manager may read the ledger but cannot write to
// it, because writing to it is moving money (PLAN-backend.md permission matrix).
transactionRoutes.get(
  '/',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.MANAGER),
  validate(transactionFiltersSchema, 'query'),
  transactionController.getTransactions,
);
transactionRoutes.get(
  '/summary',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.MANAGER),
  validate(transactionFiltersSchema, 'query'),
  transactionController.getSummary,
);

transactionRoutes.use(requireAuth, requireRole(UserRole.ADMIN));

transactionRoutes.post('/adjustment', validate(recordAdjustmentSchema), transactionController.recordAdjustment);
// Restricted to MANUAL_ADJUSTMENT rows in the service — every other type is written
// alongside the invoice event it describes and stays permanent history.
transactionRoutes.delete('/:id', transactionController.deleteTransaction);
