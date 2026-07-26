import { Router } from 'express';
import { validate } from '../../common/validate';
import { requireAuth } from '../../common/guards/auth.guard';
import { requireRole } from '../../common/guards/role.guard';
import { UserRole } from '../users/user.entity';
import { newsController } from './news.controller';
import { createNewsSchema, newsFiltersSchema, updateNewsSchema } from './news.dto';

export const newsRoutes = Router();

// Affiliate feed — published posts only, ahead of the admin guard and of `/:id`.
newsRoutes.get('/published', requireAuth, newsController.getPublished);

newsRoutes.use(requireAuth, requireRole(UserRole.ADMIN, UserRole.MANAGER));

newsRoutes.get('/', validate(newsFiltersSchema, 'query'), newsController.getPosts);
newsRoutes.get('/:id', newsController.getPost);
newsRoutes.post('/', validate(createNewsSchema), newsController.createPost);
newsRoutes.patch('/:id', validate(updateNewsSchema), newsController.updatePost);
newsRoutes.delete('/:id', newsController.deletePost);
