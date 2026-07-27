import type { BlogPost, BlogStatus, CreateBlogInput } from '@fatexia/types';
import { apiFetch } from './api';

export function getBlogs(): Promise<BlogPost[]> {
  return apiFetch<BlogPost[]>('/blogs');
}

export function getBlog(id: string): Promise<BlogPost> {
  return apiFetch<BlogPost>(`/blogs/${id}`);
}

export function createBlog(input: CreateBlogInput): Promise<BlogPost> {
  return apiFetch<BlogPost>('/blogs', { method: 'POST', body: JSON.stringify(input) });
}

export function updateBlog(id: string, input: CreateBlogInput): Promise<BlogPost> {
  return apiFetch<BlogPost>(`/blogs/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function updateBlogStatus(id: string, status: BlogStatus): Promise<BlogPost> {
  return apiFetch<BlogPost>(`/blogs/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
}

export function deleteBlog(id: string): Promise<void> {
  return apiFetch<void>(`/blogs/${id}`, { method: 'DELETE' });
}
