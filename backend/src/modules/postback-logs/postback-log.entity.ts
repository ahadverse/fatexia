import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum PostbackDirection {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND',
}

// INBOUND = advertiser tracking platform → Fatexia. OUTBOUND = Fatexia → the
// affiliate's own postback URL. Every attempt lands a row regardless of retry outcome.
@Entity('postback_logs')
export class PostbackLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Nullable for inbound logs that never resolved to a conversion.
  @Index()
  @Column({ type: 'uuid', nullable: true })
  conversionId!: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  offerId!: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  affiliateId!: string | null;

  @Index()
  @Column({ type: 'enum', enum: PostbackDirection })
  direction!: PostbackDirection;

  @Column({ type: 'varchar', nullable: true })
  url!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  payload!: Record<string, unknown>;

  @Column({ type: 'int', nullable: true })
  responseStatus!: number | null;

  @Column({ type: 'boolean', default: false })
  success!: boolean;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'int', default: 1 })
  attemptCount!: number;

  @Column({ type: 'varchar', nullable: true })
  sourceIp!: string | null;

  @Index()
  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
