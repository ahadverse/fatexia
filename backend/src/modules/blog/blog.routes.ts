import { Router } from 'express';
import { validate } from '../../common/validate';
import { requireAuth } from '../../common/guards/auth.guard';
import { requireRole } from '../../common/guards/role.guard';
import { UserRole } from '../users/user.entity';
import { blogController } from './blog.controller';
import { blogFiltersSchema, createBlogSchema, updateBlogSchema } from './blog.dto';

export const blogRoutes = Router();

// Public marketing site — no auth. Ahead of the admin guard and of `/:id`.
blogRoutes.get('/published', blogController.getPublished);
blogRoutes.get('/published/:slug', blogController.getPublishedBySlug);

blogRoutes.use(requireAuth, requireRole(UserRole.ADMIN, UserRole.MANAGER));

blogRoutes.get('/', validate(blogFiltersSchema, 'query'), blogController.getPosts);
blogRoutes.get('/:id', blogController.getPost);
blogRoutes.post('/', validate(createBlogSchema), blogController.createPost);
blogRoutes.patch('/:id', validate(updateBlogSchema), blogController.updatePost);
blogRoutes.delete('/:id', blogController.deletePost);
