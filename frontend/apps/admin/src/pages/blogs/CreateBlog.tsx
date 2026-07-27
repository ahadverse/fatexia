import { useNavigate } from 'react-router-dom';
import { toast } from '@fatexia/ui';
import { createBlog } from '../../lib/blogs-api';
import { BlogForm } from './BlogForm';

export function CreateBlog() {
  const navigate = useNavigate();

  return (
    <BlogForm
      heading="Create Blog Post"
      submitLabel="Create Post"
      submittingLabel="Creating…"
      onSubmit={async (input) => {
        await createBlog(input);
        toast.success('Blog post created');
        navigate('/blogs/all');
      }}
    />
  );
}
