import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../common/guards/auth.guard';
import { transactionService } from './transaction.service';
import type { RecordAdjustmentDto, TransactionFiltersDto } from './transaction.dto';

export const transactionController = {
  async getTransactions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await transactionService.getTransactions(req.query as unknown as TransactionFiltersDto));
    } catch (err) {
      next(err);
    }
  },

  async getSummary(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await transactionService.getSummary(req.query as unknown as TransactionFiltersDto));
    } catch (err) {
      next(err);
    }
  },

  async getOwnTransactions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await transactionService.getOwnTransactions(req.user!.id, req.query as unknown as TransactionFiltersDto));
    } catch (err) {
      next(err);
    }
  },

  async recordAdjustment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(201).json(await transactionService.recordAdjustment(req.body as RecordAdjustmentDto, req.user!.id));
    } catch (err) {
      next(err);
    }
  },
};
