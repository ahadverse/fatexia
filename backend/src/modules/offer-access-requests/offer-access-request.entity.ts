import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';

export enum AccessRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

// An affiliate asking for access to a gated offer. One live request per
// offer/affiliate pair — a re-request reuses the row rather than stacking duplicates.
@Entity('offer_access_requests')
@Unique(['offerId', 'affiliateId'])
export class OfferAccessRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  offerId!: string;

  @Index()
  @Column({ type: 'uuid' })
  affiliateId!: string;

  @Index()
  @Column({ type: 'enum', enum: AccessRequestStatus, default: AccessRequestStatus.PENDING })
  status!: AccessRequestStatus;

  @Column({ type: 'text', nullable: true })
  affiliateNote!: string | null;

  @Column({ type: 'text', nullable: true })
  decisionNote!: string | null;

  @Column({ type: 'uuid', nullable: true })
  decidedByUserId!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  decidedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
