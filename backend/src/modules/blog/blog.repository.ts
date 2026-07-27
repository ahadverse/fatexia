import { AppDataSource } from '../../infra/database/data-source';
import { BlogPost, BlogStatus } from './blog-post.entity';
import type { BlogFiltersDto } from './blog.dto';

const repository = AppDataSource.getRepository(BlogPost);

export const blogRepository = {
  findAll(filters: BlogFiltersDto): Promise<BlogPost[]> {
    const qb = repository.createQueryBuilder('post');
    if (filters.status) {
      qb.andWhere('post.status = :status', { status: filters.status });
    }
    if (filters.search) {
      qb.andWhere('(post.title ILIKE :search OR post.content ILIKE :search)', { search: `%${filters.search}%` });
    }
    return qb.orderBy('post."createdAt"', 'DESC').getMany();
  },

  findPublished(): Promise<BlogPost[]> {
    return repository.find({ where: { status: BlogStatus.PUBLISHED }, order: { publishedAt: 'DESC' } });
  },

  findPublishedBySlug(slug: string): Promise<BlogPost | null> {
    return repository.findOne({ where: { slug, status: BlogStatus.PUBLISHED } });
  },

  findById(id: string): Promise<BlogPost | null> {
    return repository.findOne({ where: { id } });
  },

  findBySlug(slug: string): Promise<BlogPost | null> {
    return repository.findOne({ where: { slug } });
  },

  create(data: Partial<BlogPost>): Promise<BlogPost> {
    return repository.save(repository.create(data));
  },

  async update(id: string, fields: Partial<BlogPost>): Promise<void> {
    await repository.update({ id }, fields);
  },

  async delete(id: string): Promise<void> {
    await repository.delete({ id });
  },
};
