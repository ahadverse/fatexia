import { useState } from 'react';
import type { BlogPost, BlogStatus, CreateBlogInput } from '@fatexia/types';
import { Input, toast } from '@fatexia/ui';

const STATUS_OPTIONS: { value: BlogStatus; label: string }[] = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'ARCHIVED', label: 'Archived' },
];

const selectClass = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground';

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Shared by CreateBlog and EditBlog — an existing BlogPost already has every field
// CreateBlogInput needs (plus id/timestamps this form ignores), so it doubles as the
// edit form's initial values.
export function blogToFormInput(post: BlogPost): CreateBlogInput {
  return {
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt ?? undefined,
    content: post.content,
    status: post.status,
  };
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

interface BlogFormProps {
  heading: string;
  submitLabel: string;
  submittingLabel: string;
  initial?: CreateBlogInput;
  onSubmit: (input: CreateBlogInput) => Promise<void>;
}

export function BlogForm({ heading, submitLabel, submittingLabel, initial, onSubmit }: BlogFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [slugTouched, setSlugTouched] = useState(!!initial);

  const [title, setTitle] = useState(initial?.title ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [status, setStatus] = useState<BlogStatus>(initial?.status ?? 'DRAFT');

  const valid = title.trim().length > 0 && slug.trim().length > 0 && content.trim().length > 0;

  function handleTitleChange(value: string) {
    setTitle(value);
    if (!slugTouched) {
      setSlug(slugify(value));
    }
  }

  async function handleSubmit() {
    if (!valid) {
      toast.error('Title, slug, and content are required');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        title,
        slug,
        excerpt: excerpt || undefined,
        content,
        status,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save blog post');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">{heading}</h1>

      <section className="space-y-4 rounded-lg border border-border bg-card p-4">
        <Field label="Title" required>
          <Input value={title} onChange={(e) => handleTitleChange(e.target.value)} placeholder="Why your payout should never come from the postback" />
        </Field>

        <Field label="Slug" required hint="Used in the public URL: /blog/your-slug. Lowercase letters, numbers and hyphens only.">
          <Input
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
            placeholder="why-your-payout-should-never-come-from-the-postback"
          />
        </Field>

        <Field label="Excerpt" hint="Short summary shown on the blog index and in link previews.">
          <textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            className="h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </Field>

        <Field label="Content" required hint="Separate paragraphs with a blank line — each one renders as its own paragraph on the public site.">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="h-64 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </Field>

        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value as BlogStatus)} className={selectClass}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">Only Published posts appear on the public site's /blog.</p>
        </Field>
      </section>

      <div className="flex justify-end">
        <button type="button" disabled={!valid || submitting} onClick={handleSubmit} className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {submitting ? submittingLabel : submitLabel}
        </button>
      </div>
    </div>
  );
}
