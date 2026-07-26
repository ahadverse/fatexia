import { AppDataSource } from '../../infra/database/data-source';
import { NewsAudience, NewsPost, NewsStatus } from './news-post.entity';
import type { NewsFiltersDto } from './news.dto';

const repository = AppDataSource.getRepository(NewsPost);

export const newsRepository = {
  findAll(filters: NewsFiltersDto): Promise<NewsPost[]> {
    const qb = repository.createQueryBuilder('post');
    if (filters.status) {
      qb.andWhere('post.status = :status', { status: filters.status });
    }
    if (filters.audience) {
      qb.andWhere('post.audience = :audience', { audience: filters.audience });
    }
    if (filters.search) {
      qb.andWhere('(post.title ILIKE :search OR post.body ILIKE :search)', { search: `%${filters.search}%` });
    }
    // Pinned first, then newest — the same ordering the affiliate portal renders.
    return qb.orderBy('post.pinned', 'DESC').addOrderBy('post."createdAt"', 'DESC').getMany();
  },

  // Affiliate-facing feed: published posts addressed to affiliates or to everyone.
  findPublishedForAffiliates(): Promise<NewsPost[]> {
    return repository
      .createQueryBuilder('post')
      .where('post.status = :status', { status: NewsStatus.PUBLISHED })
      .andWhere('post.audience IN (:...audiences)', { audiences: [NewsAudience.ALL, NewsAudience.AFFILIATES] })
      .orderBy('post.pinned', 'DESC')
      .addOrderBy('post."publishedAt"', 'DESC')
      .getMany();
  },

  findById(id: string): Promise<NewsPost | null> {
    return repository.findOne({ where: { id } });
  },

  findBySlug(slug: string): Promise<NewsPost | null> {
    return repository.findOne({ where: { slug } });
  },

  create(data: Partial<NewsPost>): Promise<NewsPost> {
    return repository.save(repository.create(data));
  },

  async update(id: string, fields: Partial<NewsPost>): Promise<void> {
    await repository.update({ id }, fields);
  },

  async delete(id: string): Promise<void> {
    await repository.delete({ id });
  },
};
