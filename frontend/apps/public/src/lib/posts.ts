const API_URL = process.env.NEXT_PUBLIC_API_URL as string;

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  readingTime: string;
  content: string[];
}

// Backed by the admin-managed blog (backend/src/modules/blog). `no-store` because
// this is a small, low-traffic list that should reflect an admin's publish/edit
// immediately rather than sit behind Next's fetch cache.
export async function getPublishedPosts(): Promise<BlogPost[]> {
  const res = await fetch(`${API_URL}/blogs/published`, { cache: 'no-store' });
  if (!res.ok) return [];
  return (await res.json()) as BlogPost[];
}

export async function getPostBySlug(slug: string): Promise<BlogPost | undefined> {
  const res = await fetch(`${API_URL}/blogs/published/${slug}`, { cache: 'no-store' });
  if (!res.ok) return undefined;
  return (await res.json()) as BlogPost;
}
