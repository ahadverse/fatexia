import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// Informational/leaderboard ledger only — points are not a currency and have no
// redemption path (PLAN-backend.md). Deliberately append-only: a correction is a new
// negative row with a reason, never an edit, so the ledger stays auditable.
@Entity('affiliate_points')
export class AffiliatePoint {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  affiliateId!: string;

  // Null for manual admin adjustments; set when earned from a conversion.
  @Column({ type: 'uuid', nullable: true })
  conversionId!: string | null;

  @Column({ type: 'int' })
  points!: number;

  @Column({ type: 'varchar' })
  reason!: string;

  @Column({ type: 'uuid', nullable: true })
  createdByUserId!: string | null;

  @Index()
  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
