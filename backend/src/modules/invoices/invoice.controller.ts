import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../common/guards/auth.guard';
import { invoiceService } from './invoice.service';
import type {
  CreateManualInvoiceDto,
  GeneratePayoutBatchDto,
  InvoiceFiltersDto,
  ReleaseInvoiceDto,
  UpdateInvoiceStatusDto,
} from './invoice.dto';

export const invoiceController = {
  async getInvoices(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await invoiceService.getInvoices(req.query as unknown as InvoiceFiltersDto));
    } catch (err) {
      next(err);
    }
  },

  async getOwnInvoices(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await invoiceService.getOwnInvoices(req.user!.id, req.query as unknown as InvoiceFiltersDto));
    } catch (err) {
      next(err);
    }
  },

  async getOwnBalance(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await invoiceService.getOwnBalance(req.user!.id));
    } catch (err) {
      next(err);
    }
  },

  async getPendingBalances(_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await invoiceService.getPendingBalances());
    } catch (err) {
      next(err);
    }
  },

  async getInvoice(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await invoiceService.getInvoice(req.params.id!));
    } catch (err) {
      next(err);
    }
  },

  async generateBatch(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(201).json(await invoiceService.generateBatch(req.body as GeneratePayoutBatchDto, req.user!.id));
    } catch (err) {
      next(err);
    }
  },

  async createManual(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(201).json(await invoiceService.createManual(req.body as CreateManualInvoiceDto, req.user!.id));
    } catch (err) {
      next(err);
    }
  },

  async updateStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await invoiceService.updateStatus(req.params.id!, req.body as UpdateInvoiceStatusDto, req.user!.id));
    } catch (err) {
      next(err);
    }
  },

  async release(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await invoiceService.releaseInvoice(req.params.id!, req.body as ReleaseInvoiceDto, req.user!.id));
    } catch (err) {
      next(err);
    }
  },

  async deleteInvoice(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await invoiceService.deleteInvoice(req.params.id!);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};
