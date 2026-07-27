import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { BlogPost, BlogStatus } from '@fatexia/types';
import { StatusBadge, toast } from '@fatexia/ui';
import { getBlog } from '../../lib/blogs-api';

const STATUS_VARIANT: Record<BlogStatus, 'success' | 'destructive' | 'warning' | 'neutral'> = {
  PUBLISHED: 'success',
  DRAFT: 'neutral',
  ARCHIVED: 'warning',
};

export function BlogDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getBlog(id)
      .then(setPost)
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed to load blog post'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!post || !id) return <p className="text-sm text-muted-foreground">Blog post not found.</p>;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{post.title}</h1>
          <div className="mt-1 flex items-center gap-2">
            <StatusBadge variant={STATUS_VARIANT[post.status]}>{post.status}</StatusBadge>
            <span className="text-sm text-muted-foreground">{post.readingTime}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => navigate('/blogs/all')} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
            Back
          </button>
          <button type="button" onClick={() => navigate(`/blogs/${id}/edit`)} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Edit Post
          </button>
        </div>
      </div>

      <section className="space-y-1 rounded-lg border border-border bg-card p-4 text-sm">
        <div className="flex justify-between gap-4 border-b border-border/50 py-2 last:border-0">
          <span className="text-muted-foreground">Slug</span>
          <span className="text-right font-medium text-foreground">/blog/{post.slug}</span>
        </div>
        <div className="flex justify-between gap-4 border-b border-border/50 py-2 last:border-0">
          <span className="text-muted-foreground">Published</span>
          <span className="text-right font-medium text-foreground">{post.publishedAt ? new Date(post.publishedAt).toLocaleString() : 'Not published yet'}</span>
        </div>
        <div className="flex justify-between gap-4 py-2">
          <span className="text-muted-foreground">Created</span>
          <span className="text-right font-medium text-foreground">{new Date(post.createdAt).toLocaleString()}</span>
        </div>
      </section>

      {post.excerpt && (
        <section className="space-y-1 rounded-lg border border-border bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold text-foreground">Excerpt</h2>
          <p className="text-sm text-foreground">{post.excerpt}</p>
        </section>
      )}

      <section className="space-y-1 rounded-lg border border-border bg-card p-4">
        <h2 className="mb-2 text-sm font-semibold text-foreground">Content</h2>
        <div className="space-y-3 whitespace-pre-wrap text-sm text-foreground">{post.content}</div>
      </section>
    </div>
  );
}
