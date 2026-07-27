import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { BlogPost } from '@fatexia/types';
import { toast } from '@fatexia/ui';
import { getBlog, updateBlog } from '../../lib/blogs-api';
import { BlogForm, blogToFormInput } from './BlogForm';

export function EditBlog() {
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
    <BlogForm
      heading={`Edit Blog Post — ${post.title}`}
      submitLabel="Save Changes"
      submittingLabel="Saving…"
      initial={blogToFormInput(post)}
      onSubmit={async (input) => {
        await updateBlog(id, input);
        toast.success('Blog post updated');
        navigate(`/blogs/${id}`);
      }}
    />
  );
}
