import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/seo';
import { getPublishedPosts } from '@/lib/posts';

// The blog is admin-managed and fetched with `no-store`, so the sitemap has to be
// generated per request rather than frozen at build time — otherwise a post published
// from the admin panel would not appear in the sitemap until the next deploy.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Priority is relative within this site only. The two audience pages carry the
 * commercial intent, so they sit just under the home page; legal pages are listed
 * because they should be crawlable, not because they should rank.
 *
 * `/login` and `/register` are deliberately absent: both are redirect shims pointing at
 * the affiliate portal on another subdomain, and a sitemap entry that resolves to a
 * redirect is a crawl-budget cost with no upside.
 */
const STATIC_ROUTES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
  { path: '/', priority: 1, changeFrequency: 'weekly' },
  { path: '/affiliates', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/advertisers', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/verticals', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/payments', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/blog', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/faq', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/about', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/contact', priority: 0.6, changeFrequency: 'yearly' },
  { path: '/terms', priority: 0.2, changeFrequency: 'yearly' },
  { path: '/privacy', priority: 0.2, changeFrequency: 'yearly' },
  { path: '/cookies', priority: 0.2, changeFrequency: 'yearly' },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  // A backend that is down returns an empty list rather than throwing, so a blog
  // outage degrades the sitemap to its static routes instead of 500-ing it away.
  const posts = await getPublishedPosts();
  const postEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: absoluteUrl(`/blog/${post.slug}`),
    lastModified: post.publishedAt ? new Date(post.publishedAt) : now,
    changeFrequency: 'yearly',
    priority: 0.5,
  }));

  return [...staticEntries, ...postEntries];
}
