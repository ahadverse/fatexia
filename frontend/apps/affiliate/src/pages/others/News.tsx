import { EmptyState, PageHeader, Skeleton } from '@fatexia/ui';
import type { NewsPost } from '@fatexia/types';
import { getPublishedNews } from '../../lib/portal-api';
import { useAsync } from '../../hooks/useAsync';
import { date } from '../../lib/format';

// Published announcements only — the API filters drafts out server-side, so an
// unfinished post can never appear here.
export function News() {
  const posts = useAsync<NewsPost[]>(() => getPublishedNews(), []);

  return (
    <div className="space-y-6">
      <PageHeader title="News" description="Payout changes, new offers and anything else the network needs you to know." />

      {posts.error && <p className="text-sm text-destructive">{posts.error}</p>}

      {posts.loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-32 w-full" />
          ))}
        </div>
      ) : (posts.data ?? []).length === 0 ? (
        <EmptyState title="Nothing posted yet" description="Network announcements will show up here." />
      ) : (
        <div className="space-y-4">
          {(posts.data ?? []).map((post) => (
            <article key={post.id} className="overflow-hidden rounded-lg border border-border bg-card">
              {post.imageUrl && (
                <img src={post.imageUrl} alt="" loading="lazy" className="aspect-[21/6] w-full object-cover" />
              )}
              <div className="p-5">
                <div className="flex flex-wrap items-baseline gap-2">
                  {post.pinned && <span className="text-xs font-medium text-primary">Pinned</span>}
                  <h2 className="text-base font-semibold text-card-foreground">{post.title}</h2>
                  <span className="ml-auto text-xs text-muted-foreground">{date(post.publishedAt)}</span>
                </div>
                {post.excerpt && <p className="mt-1 text-sm text-muted-foreground">{post.excerpt}</p>}
                <p className="mt-3 whitespace-pre-wrap text-sm text-card-foreground">{post.body}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
