export type BlogStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface BlogPost {
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

export interface CreateBlogInput {
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  status: BlogStatus;
}

// Public marketing-site projection — see backend/src/modules/blog/blog.dto.ts
// (toPublicBlogPostDto). No id/status/authorUserId; content is pre-split into
// paragraphs for the public blog page's renderer.
export interface PublicBlogPost {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  readingTime: string;
  content: string[];
}
