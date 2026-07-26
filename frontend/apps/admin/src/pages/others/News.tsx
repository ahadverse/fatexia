import { useState } from 'react';
import {
  Button,
  ConfirmModal,
  DataTable,
  FilterBar,
  FilterField,
  Input,
  Modal,
  PageHeader,
  Select,
  TableSkeleton,
  Textarea,
  Toggle,
  type DataTableColumn,
} from '@fatexia/ui';
import type { NewsAudience, NewsPost, NewsStatus } from '@fatexia/types';
import { createNewsPost, deleteNewsPost, getNewsPosts, updateNewsPost } from '../../lib/platform-api';
import { runAction, useAsync } from '../../hooks/useAsync';
import { date } from '../../lib/format';
import { StatusPill } from '../../components/StatusPill';

interface FormState {
  id: string | null;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  status: NewsStatus;
  audience: NewsAudience;
  pinned: boolean;
}

const EMPTY_FORM: FormState = {
  id: null,
  title: '',
  slug: '',
  excerpt: '',
  body: '',
  status: 'DRAFT',
  audience: 'ALL',
  pinned: false,
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// Network announcements shown in the affiliate portal's News section.
export function News() {
  const [status, setStatus] = useState<NewsStatus | ''>('');
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<NewsPost | null>(null);

  const posts = useAsync(() => getNewsPosts({ status: status || undefined }), [status]);

  async function save() {
    if (!form) return;
    const payload = {
      title: form.title,
      slug: form.slug,
      excerpt: form.excerpt || undefined,
      body: form.body,
      status: form.status,
      audience: form.audience,
      pinned: form.pinned,
    };
    setSaving(true);
    const result = await runAction(() => (form.id ? updateNewsPost(form.id, payload) : createNewsPost(payload)), {
      success: form.id ? 'Post updated' : 'Post created',
      onDone: posts.reload,
    });
    setSaving(false);
    if (result) setForm(null);
  }

  const columns: DataTableColumn<NewsPost>[] = [
    {
      key: 'title',
      header: 'Post',
      render: (row) => (
        <div>
          <p className="text-card-foreground">
            {row.pinned && <span className="mr-1.5 text-xs text-primary">Pinned</span>}
            {row.title}
          </p>
          <p className="text-xs text-muted-foreground">/{row.slug}</p>
        </div>
      ),
    },
    { key: 'audience', header: 'Audience', render: (row) => row.audience.toLowerCase() },
    { key: 'status', header: 'Status', render: (row) => <StatusPill status={row.status} /> },
    { key: 'publishedAt', header: 'Published', render: (row) => date(row.publishedAt) },
    { key: 'updatedAt', header: 'Updated', render: (row) => date(row.updatedAt) },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setForm({
                id: row.id,
                title: row.title,
                slug: row.slug,
                excerpt: row.excerpt ?? '',
                body: row.body,
                status: row.status,
                audience: row.audience,
                pinned: row.pinned,
              })
            }
          >
            Edit
          </Button>
          {row.status !== 'PUBLISHED' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                runAction(() => updateNewsPost(row.id, { status: 'PUBLISHED' }), {
                  success: 'Post published',
                  onDone: posts.reload,
                })
              }
            >
              Publish
            </Button>
          )}
          <Button size="sm" variant="destructive" onClick={() => setDeleting(row)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="News"
        description="Announcements shown to affiliates in their portal. Drafts stay invisible until published."
        actions={<Button onClick={() => setForm({ ...EMPTY_FORM })}>New post</Button>}
      />

      <FilterBar>
        <FilterField label="Status">
          <Select value={status} onChange={(event) => setStatus(event.target.value as NewsStatus | '')} className="w-44">
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
          </Select>
        </FilterField>
      </FilterBar>

      {posts.error && <p className="text-sm text-destructive">{posts.error}</p>}

      {posts.loading ? (
        <TableSkeleton columns={6} />
      ) : (
        <DataTable columns={columns} rows={posts.data ?? []} getRowKey={(row) => row.id} emptyMessage="No posts yet." />
      )}

      <Modal
        open={!!form}
        onOpenChange={(open) => !open && setForm(null)}
        title={form?.id ? 'Edit post' : 'New post'}
        className="max-w-2xl"
      >
        {form && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Title</span>
                <Input
                  value={form.title}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      title: event.target.value,
                      // Only auto-fill while creating — changing a published post's
                      // slug breaks any link already shared.
                      slug: form.id ? form.slug : slugify(event.target.value),
                    })
                  }
                  className="mt-1"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Slug</span>
                <Input value={form.slug} onChange={(event) => setForm({ ...form, slug: slugify(event.target.value) })} className="mt-1" />
              </label>
            </div>

            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Excerpt</span>
              <Input value={form.excerpt} onChange={(event) => setForm({ ...form, excerpt: event.target.value })} className="mt-1" />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Body</span>
              <Textarea rows={10} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} className="mt-1" />
            </label>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Status</span>
                <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as NewsStatus })} className="mt-1">
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="ARCHIVED">Archived</option>
                </Select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Audience</span>
                <Select value={form.audience} onChange={(event) => setForm({ ...form, audience: event.target.value as NewsAudience })} className="mt-1">
                  <option value="ALL">Everyone</option>
                  <option value="AFFILIATES">Affiliates</option>
                  <option value="ADVERTISERS">Advertisers</option>
                </Select>
              </label>
              <div className="flex items-end pb-1">
                <Toggle checked={form.pinned} onCheckedChange={(value) => setForm({ ...form, pinned: value })} label="Pin to top" />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setForm(null)}>
                Cancel
              </Button>
              <Button disabled={saving} onClick={save}>
                {saving ? 'Saving…' : form.id ? 'Save changes' : 'Create post'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this post?"
        description={deleting ? `"${deleting.title}" will be removed permanently.` : ''}
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          await runAction(() => deleteNewsPost(deleting.id), { success: 'Post deleted', onDone: posts.reload });
          setDeleting(null);
        }}
      />
    </div>
  );
}
