import { Link } from 'react-router-dom';
import { Newspaper } from 'lucide-react';
import type { NewsPost } from '@fatexia/types';
import { getPublishedNews } from '../lib/portal-api';
import { useAsync } from '../hooks/useAsync';
import { date } from '../lib/format';

/**
 * The network's latest announcements, as a card strip under the dashboard.
 *
 * A post's cover image is optional, so the card falls back to a tinted panel with the
 * title on it rather than collapsing to a different height — a grid where some cards
 * have images and others don't reads as broken, not as sparse.
 */
export function LatestNews({ limit = 4 }: { limit?: number }) {
  const posts = useAsync<NewsPost[]>(() => getPublishedNews(), []);

  // Pinned first, then newest — the same order the News page uses, so "the latest four"
  // here always matches the first four there.
  const latest = [...(posts.data ?? [])]
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.publishedAt ?? b.createdAt).getTime() - new Date(a.publishedAt ?? a.createdAt).getTime();
    })
    .slice(0, limit);

  // Nothing published yet is not worth an empty state on the dashboard — the section
  // simply isn't there. Same for a failed load: the dashboard's own numbers are the
  // point of the page, and news is decoration next to them.
  if (posts.loading) {
    return (
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-card-foreground">Latest news</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: limit }).map((_, index) => (
            <div key={index} className="h-40 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      </section>
    );
  }

  if (posts.error || latest.length === 0) return null;

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-card-foreground">Latest news</h2>
        <Link to="/news" className="text-xs font-medium text-primary hover:underline">
          View all
        </Link>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {latest.map((post) => (
          <Link
            key={post.id}
            to="/news"
            className="group overflow-hidden rounded-md border border-border bg-background transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="relative aspect-[16/10] overflow-hidden bg-primary/10">
              {post.imageUrl ? (
                <img
                  src={post.imageUrl}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="flex size-full flex-col justify-end gap-1 p-3">
                  <Newspaper className="size-5 text-primary/70" />
                  <span className="line-clamp-3 text-sm font-semibold leading-snug text-foreground">{post.title}</span>
                </div>
              )}
              {post.pinned && (
                <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  Pinned
                </span>
              )}
            </div>
            <div className="space-y-1 p-3">
              <p className="line-clamp-2 text-sm font-medium leading-snug text-card-foreground">{post.title}</p>
              {post.excerpt && <p className="line-clamp-2 text-xs text-muted-foreground">{post.excerpt}</p>}
              <p className="pt-0.5 text-[11px] text-muted-foreground">{date(post.publishedAt ?? post.createdAt)}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
