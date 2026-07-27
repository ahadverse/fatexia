import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../common/guards/auth.guard';
import { blogService } from './blog.service';
import type { BlogFiltersDto, CreateBlogDto, UpdateBlogDto } from './blog.dto';

export const blogController = {
  async getPosts(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await blogService.getPosts(req.query as unknown as BlogFiltersDto));
    } catch (err) {
      next(err);
    }
  },

  async getPublished(_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await blogService.getPublished());
    } catch (err) {
      next(err);
    }
  },

  async getPublishedBySlug(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await blogService.getPublishedBySlug(req.params.slug!));
    } catch (err) {
      next(err);
    }
  },

  async getPost(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await blogService.getPost(req.params.id!));
    } catch (err) {
      next(err);
    }
  },

  async createPost(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(201).json(await blogService.createPost(req.body as CreateBlogDto, req.user!.id));
    } catch (err) {
      next(err);
    }
  },

  async updatePost(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await blogService.updatePost(req.params.id!, req.body as UpdateBlogDto));
    } catch (err) {
      next(err);
    }
  },

  async deletePost(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await blogService.deletePost(req.params.id!);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};
