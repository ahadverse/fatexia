import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum NewsStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

export enum NewsAudience {
  ALL = 'ALL',
  AFFILIATES = 'AFFILIATES',
  ADVERTISERS = 'ADVERTISERS',
}

// Network announcements shown in the affiliate portal's News section.
@Entity('news_posts')
export class NewsPost {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  title!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar' })
  slug!: string;

  @Column({ type: 'varchar', nullable: true })
  excerpt!: string | null;

  @Column({ type: 'text' })
  body!: string;

  @Column({ type: 'enum', enum: NewsStatus, default: NewsStatus.DRAFT })
  status!: NewsStatus;

  @Column({ type: 'enum', enum: NewsAudience, default: NewsAudience.ALL })
  audience!: NewsAudience;

  @Column({ type: 'boolean', default: false })
  pinned!: boolean;

  @Column({ type: 'uuid', nullable: true })
  authorUserId!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  publishedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
