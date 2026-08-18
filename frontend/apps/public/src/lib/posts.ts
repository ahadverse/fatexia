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
  // The network error is swallowed, not just the non-2xx: `fetch` throws on
  // ECONNREFUSED, and this list also feeds app/sitemap.ts — an unreachable backend
  // would otherwise turn the sitemap into a 500, which is a far worse outcome for
  // crawling than a sitemap that is briefly missing its blog entries.
  try {
    const res = await fetch(`${API_URL}/blogs/published`, { cache: 'no-store' });
    if (!res.ok) return [];
    return (await res.json()) as BlogPost[];
  } catch {
    return [];
  }
}

/**
 * Deliberately *not* wrapped in a try/catch.
 *
 * The caller renders `notFound()` when this returns undefined, so swallowing a
 * transient backend outage here would serve a hard 404 for a post that exists — and a
 * 404 is a signal Google acts on by dropping the URL. Letting the error surface gives a
 * 500 instead, which crawlers treat as "come back later".
 */
export async function getPostBySlug(slug: string): Promise<BlogPost | undefined> {
  const res = await fetch(`${API_URL}/blogs/published/${slug}`, { cache: 'no-store' });
  if (!res.ok) return undefined;
  return (await res.json()) as BlogPost;
}
