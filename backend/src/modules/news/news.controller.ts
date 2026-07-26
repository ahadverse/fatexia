import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../common/guards/auth.guard';
import { newsService } from './news.service';
import type { CreateNewsDto, NewsFiltersDto, UpdateNewsDto } from './news.dto';

export const newsController = {
  async getPosts(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await newsService.getPosts(req.query as unknown as NewsFiltersDto));
    } catch (err) {
      next(err);
    }
  },

  async getPublished(_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await newsService.getPublishedForAffiliates());
    } catch (err) {
      next(err);
    }
  },

  async getPost(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await newsService.getPost(req.params.id!));
    } catch (err) {
      next(err);
    }
  },

  async createPost(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(201).json(await newsService.createPost(req.body as CreateNewsDto, req.user!.id));
    } catch (err) {
      next(err);
    }
  },

  async updatePost(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await newsService.updatePost(req.params.id!, req.body as UpdateNewsDto));
    } catch (err) {
      next(err);
    }
  },

  async deletePost(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await newsService.deletePost(req.params.id!);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};
