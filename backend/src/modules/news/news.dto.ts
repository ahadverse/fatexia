import { z } from 'zod';
import { NewsAudience, NewsStatus, type NewsPost } from './news-post.entity';

export const newsFiltersSchema = z.object({
  status: z.nativeEnum(NewsStatus).optional(),
  audience: z.nativeEnum(NewsAudience).optional(),
  search: z.string().optional(),
});

export type NewsFiltersDto = z.infer<typeof newsFiltersSchema>;

const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug may contain lowercase letters, numbers and single hyphens only');

export const createNewsSchema = z.object({
  title: z.string().trim().min(1).max(200),
  slug: slugSchema,
  excerpt: z.string().trim().max(300).optional(),
  body: z.string().trim().min(1).max(20000),
  status: z.nativeEnum(NewsStatus).default(NewsStatus.DRAFT),
  audience: z.nativeEnum(NewsAudience).default(NewsAudience.ALL),
  pinned: z.boolean().default(false),
});

export type CreateNewsDto = z.infer<typeof createNewsSchema>;

export const updateNewsSchema = createNewsSchema.partial();

export type UpdateNewsDto = z.infer<typeof updateNewsSchema>;

export interface NewsPostDto {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body: string;
  status: NewsStatus;
  audience: NewsAudience;
  pinned: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toNewsPostDto(post: NewsPost): NewsPostDto {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    body: post.body,
    status: post.status,
    audience: post.audience,
    pinned: post.pinned,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  };
}
