import { NotFoundError, ValidationError } from '../../common/errors';
import { blogRepository } from './blog.repository';
import { BlogStatus } from './blog-post.entity';
import {
  toBlogPostDto,
  toPublicBlogPostDto,
  type BlogFiltersDto,
  type BlogPostDto,
  type CreateBlogDto,
  type PublicBlogPostDto,
  type UpdateBlogDto,
} from './blog.dto';

export const blogService = {
  async getPosts(filters: BlogFiltersDto): Promise<BlogPostDto[]> {
    const posts = await blogRepository.findAll(filters);
    return posts.map(toBlogPostDto);
  },

  async getPublished(): Promise<PublicBlogPostDto[]> {
    const posts = await blogRepository.findPublished();
    return posts.map(toPublicBlogPostDto);
  },

  async getPublishedBySlug(slug: string): Promise<PublicBlogPostDto> {
    const post = await blogRepository.findPublishedBySlug(slug);
    if (!post) {
      throw new NotFoundError('Blog post not found');
    }
    return toPublicBlogPostDto(post);
  },

  async getPost(id: string): Promise<BlogPostDto> {
    const post = await blogRepository.findById(id);
    if (!post) {
      throw new NotFoundError('Blog post not found');
    }
    return toBlogPostDto(post);
  },

  async createPost(dto: CreateBlogDto, authorUserId: string): Promise<BlogPostDto> {
    if (await blogRepository.findBySlug(dto.slug)) {
      throw new ValidationError('A blog post with this slug already exists');
    }
    const created = await blogRepository.create({
      title: dto.title,
      slug: dto.slug,
      excerpt: dto.excerpt ?? null,
      content: dto.content,
      status: dto.status,
      authorUserId,
      // publishedAt is stamped on the transition into PUBLISHED, so a draft that is
      // published later carries its real publication date, not its creation date.
      publishedAt: dto.status === BlogStatus.PUBLISHED ? new Date() : null,
    });
    return toBlogPostDto(created);
  },

  async updatePost(id: string, dto: UpdateBlogDto): Promise<BlogPostDto> {
    const post = await blogRepository.findById(id);
    if (!post) {
      throw new NotFoundError('Blog post not found');
    }
    if (dto.slug && dto.slug !== post.slug && (await blogRepository.findBySlug(dto.slug))) {
      throw new ValidationError('A blog post with this slug already exists');
    }

    const becomingPublished = dto.status === BlogStatus.PUBLISHED && post.status !== BlogStatus.PUBLISHED;

    await blogRepository.update(id, {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.slug !== undefined && { slug: dto.slug }),
      ...(dto.excerpt !== undefined && { excerpt: dto.excerpt ?? null }),
      ...(dto.content !== undefined && { content: dto.content }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(becomingPublished && { publishedAt: new Date() }),
    });
    return this.getPost(id);
  },

  async deletePost(id: string): Promise<void> {
    const post = await blogRepository.findById(id);
    if (!post) {
      throw new NotFoundError('Blog post not found');
    }
    await blogRepository.delete(id);
  },
};
