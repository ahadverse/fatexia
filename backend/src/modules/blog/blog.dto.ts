import { z } from 'zod';
import { BlogStatus, type BlogPost } from './blog-post.entity';

export const blogFiltersSchema = z.object({
  status: z.nativeEnum(BlogStatus).optional(),
  search: z.string().optional(),
});

export type BlogFiltersDto = z.infer<typeof blogFiltersSchema>;

const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug may contain lowercase letters, numbers and single hyphens only');

export const createBlogSchema = z.object({
  title: z.string().trim().min(1).max(200),
  slug: slugSchema,
  excerpt: z.string().trim().max(300).optional(),
  content: z.string().trim().min(1).max(50000),
  status: z.nativeEnum(BlogStatus).default(BlogStatus.DRAFT),
});

export type CreateBlogDto = z.infer<typeof createBlogSchema>;

export const updateBlogSchema = createBlogSchema.partial();

export type UpdateBlogDto = z.infer<typeof updateBlogSchema>;

export interface BlogPostDto {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  status: BlogStatus;
  readingTime: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ~200 wpm, rounded up to the nearest minute, minimum 1 — the same heuristic most
// CMSes use. Computed on read rather than stored, so it never goes stale when a post
// is edited.
function estimateReadingTime(content: string): string {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return `${minutes} min read`;
}

export function toBlogPostDto(post: BlogPost): BlogPostDto {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    content: post.content,
    status: post.status,
    readingTime: estimateReadingTime(post.content),
    publishedAt: post.publishedAt?.toISOString() ?? null,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  };
}

// Public marketing-site projection: paragraphs split out for the existing renderer,
// and nothing exposed that reveals draft/internal fields (id, status, authorUserId).
export interface PublicBlogPostDto {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  readingTime: string;
  content: string[];
}

export function toPublicBlogPostDto(post: BlogPost): PublicBlogPostDto {
  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt ?? '',
    publishedAt: post.publishedAt?.toISOString() ?? post.createdAt.toISOString(),
    readingTime: estimateReadingTime(post.content),
    content: post.content
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean),
  };
}
