import { NotFoundError, ValidationError } from '../../common/errors';
import { newsRepository } from './news.repository';
import { NewsStatus } from './news-post.entity';
import { toNewsPostDto, type CreateNewsDto, type NewsFiltersDto, type NewsPostDto, type UpdateNewsDto } from './news.dto';

export const newsService = {
  async getPosts(filters: NewsFiltersDto): Promise<NewsPostDto[]> {
    const posts = await newsRepository.findAll(filters);
    return posts.map(toNewsPostDto);
  },

  async getPublishedForAffiliates(): Promise<NewsPostDto[]> {
    const posts = await newsRepository.findPublishedForAffiliates();
    return posts.map(toNewsPostDto);
  },

  async getPost(id: string): Promise<NewsPostDto> {
    const post = await newsRepository.findById(id);
    if (!post) {
      throw new NotFoundError('News post not found');
    }
    return toNewsPostDto(post);
  },

  async createPost(dto: CreateNewsDto, authorUserId: string): Promise<NewsPostDto> {
    if (await newsRepository.findBySlug(dto.slug)) {
      throw new ValidationError('A post with this slug already exists');
    }
    const created = await newsRepository.create({
      title: dto.title,
      slug: dto.slug,
      excerpt: dto.excerpt ?? null,
      imageUrl: dto.imageUrl || null,
      body: dto.body,
      status: dto.status,
      audience: dto.audience,
      pinned: dto.pinned,
      authorUserId,
      // publishedAt is stamped on the transition into PUBLISHED, so a draft that is
      // published later carries its real publication date, not its creation date.
      publishedAt: dto.status === NewsStatus.PUBLISHED ? new Date() : null,
    });
    return toNewsPostDto(created);
  },

  async updatePost(id: string, dto: UpdateNewsDto): Promise<NewsPostDto> {
    const post = await newsRepository.findById(id);
    if (!post) {
      throw new NotFoundError('News post not found');
    }
    if (dto.slug && dto.slug !== post.slug && (await newsRepository.findBySlug(dto.slug))) {
      throw new ValidationError('A post with this slug already exists');
    }

    const becomingPublished = dto.status === NewsStatus.PUBLISHED && post.status !== NewsStatus.PUBLISHED;

    await newsRepository.update(id, {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.slug !== undefined && { slug: dto.slug }),
      ...(dto.excerpt !== undefined && { excerpt: dto.excerpt ?? null }),
      // Empty string is how the form clears a cover, so it maps to null rather than
      // being written back as an empty URL.
      ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl || null }),
      ...(dto.body !== undefined && { body: dto.body }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.audience !== undefined && { audience: dto.audience }),
      ...(dto.pinned !== undefined && { pinned: dto.pinned }),
      ...(becomingPublished && { publishedAt: new Date() }),
    });
    return this.getPost(id);
  },

  async deletePost(id: string): Promise<void> {
    const post = await newsRepository.findById(id);
    if (!post) {
      throw new NotFoundError('News post not found');
    }
    await newsRepository.delete(id);
  },
};
