import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BlogPost, BlogStatus } from '@fatexia/types';
import { ConfirmModal, DataTable, StatusBadge, toast, type DataTableColumn } from '@fatexia/ui';
import { deleteBlog, getBlogs, updateBlogStatus } from '../../lib/blogs-api';

const STATUS_OPTIONS: { value: BlogStatus; label: string }[] = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'ARCHIVED', label: 'Archived' },
];

const STATUS_VARIANT: Record<BlogStatus, 'success' | 'destructive' | 'warning' | 'neutral'> = {
  PUBLISHED: 'success',
  DRAFT: 'neutral',
  ARCHIVED: 'warning',
};

const selectClass = 'h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground';

const STATUS_CHANGE_COPY: Record<BlogStatus, (title: string) => string> = {
  PUBLISHED: (title) => `"${title}" becomes visible on the public site immediately.`,
  DRAFT: (title) => `"${title}" is pulled back to draft and stops appearing on the public site.`,
  ARCHIVED: (title) => `"${title}" is archived and stops appearing on the public site.`,
};

export function AllBlogs() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [statusFilter, setStatusFilter] = useState<BlogStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [pendingStatus, setPendingStatus] = useState<{ post: BlogPost; next: BlogStatus } | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<BlogPost | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    setPosts(await getBlogs());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filteredPosts = posts.filter((p) => !statusFilter || p.status === statusFilter);

  function handleStatusChange(post: BlogPost, next: BlogStatus) {
    if (next === post.status) return;
    setPendingStatus({ post, next });
  }

  async function confirmStatusChange() {
    if (!pendingStatus) return;
    setStatusSaving(true);
    try {
      await updateBlogStatus(pendingStatus.post.id, pendingStatus.next);
      toast.success(`Post status updated to ${pendingStatus.next}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update post status');
    } finally {
      setStatusSaving(false);
      setPendingStatus(null);
    }
  }

  async function handleConfirmDelete() {
    if (!confirmTarget) return;
    setDeleting(true);
    try {
      await deleteBlog(confirmTarget.id);
      toast.success('Blog post deleted');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete blog post');
    } finally {
      setDeleting(false);
      setConfirmTarget(null);
    }
  }

  const columns: DataTableColumn<BlogPost>[] = [
    {
      key: 'title',
      header: 'Title',
      render: (p) => (
        <button type="button" onClick={() => navigate(`/blogs/${p.id}`)} className="text-left font-medium text-foreground hover:underline">
          {p.title}
        </button>
      ),
    },
    { key: 'slug', header: 'Slug', render: (p) => <span className="text-muted-foreground">/blog/{p.slug}</span> },
    {
      key: 'status',
      header: 'Status',
      render: (p) => <StatusBadge variant={STATUS_VARIANT[p.status]}>{p.status}</StatusBadge>,
    },
    { key: 'publishedAt', header: 'Published', render: (p) => (p.publishedAt ? new Date(p.publishedAt).toLocaleDateString() : '—') },
    { key: 'createdAt', header: 'Created', render: (p) => new Date(p.createdAt).toLocaleDateString() },
    {
      key: 'actions',
      header: '',
      render: (p) => (
        <div className="flex gap-2">
          <button type="button" onClick={() => navigate(`/blogs/${p.id}`)} className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent">
            View
          </button>
          <button type="button" onClick={() => navigate(`/blogs/${p.id}/edit`)} className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent">
            Edit
          </button>
          <select
            value={p.status}
            onChange={(e) => handleStatusChange(p, e.target.value as BlogStatus)}
            className="h-7 rounded-md border border-border bg-background px-1.5 text-xs text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => setConfirmTarget(p)} className="rounded-md border border-destructive/50 px-2 py-1 text-xs text-destructive">
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">All Blog Posts</h1>
        <button type="button" onClick={() => navigate('/blogs/create')} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Create Post
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as BlogStatus | '')} className={`${selectClass} w-44`}>
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : <DataTable columns={columns} rows={filteredPosts} getRowKey={(p) => p.id} emptyMessage="No blog posts match these filters." />}

      <ConfirmModal
        open={!!confirmTarget}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
        title="Delete this blog post?"
        description={confirmTarget ? `This permanently deletes "${confirmTarget.title}". It stops appearing on the public site immediately.` : ''}
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={handleConfirmDelete}
      />

      <ConfirmModal
        open={!!pendingStatus}
        onOpenChange={(open) => !open && setPendingStatus(null)}
        title={`Change status to ${pendingStatus?.next}?`}
        description={pendingStatus ? STATUS_CHANGE_COPY[pendingStatus.next](pendingStatus.post.title) : ''}
        confirmLabel="Confirm"
        destructive={pendingStatus?.next !== 'PUBLISHED'}
        loading={statusSaving}
        onConfirm={confirmStatusChange}
      />
    </div>
  );
}
