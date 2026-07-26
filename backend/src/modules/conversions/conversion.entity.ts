import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// PENDING → APPROVED → PAID is the happy path. REJECTED/DUPLICATE are terminal
// negatives; CHARGEBACK is a post-PAID reversal. See PLAN-backend.md.
export enum ConversionStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  DUPLICATE = 'DUPLICATE',
  PAID = 'PAID',
  CHARGEBACK = 'CHARGEBACK',
}

@Entity('conversions')
export class Conversion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Nullable because an orphan conversion (postback with no matching click) still
  // gets recorded — flagged via isOrphan rather than dropped.
  @Index()
  @Column({ type: 'uuid', nullable: true })
  clickId!: string | null;

  @Index()
  @Column({ type: 'uuid' })
  offerId!: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  affiliateId!: string | null;

  // Always recomputed from the offer's PayoutRule at write time, never trusted from
  // the postback payload (money integrity rule, PLAN-backend.md).
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  revenueAmount!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  payoutAmount!: string;

  @Column({ type: 'varchar', default: 'USD' })
  currency!: string;

  @Index()
  @Column({ type: 'enum', enum: ConversionStatus, default: ConversionStatus.PENDING })
  status!: ConversionStatus;

  @Column({ type: 'boolean', default: false })
  isDuplicate!: boolean;

  @Column({ type: 'boolean', default: false })
  isOrphan!: boolean;

  @Column({ type: 'int', default: 0 })
  leadRiskScore!: number;

  // Hashed rather than raw so duplicate detection doesn't require storing PII twice.
  @Column({ type: 'varchar', nullable: true })
  emailHash!: string | null;

  @Column({ type: 'varchar', nullable: true })
  phoneHash!: string | null;

  // Click-to-conversion time in ms — feeds the CTIT fraud signal.
  @Column({ type: 'int', nullable: true })
  ctitMs!: number | null;

  // Affiliate-supplied pass-through parameters, surfaced by the Sub-ID report.
  @Column({ type: 'varchar', nullable: true })
  subId1!: string | null;

  @Column({ type: 'varchar', nullable: true })
  subId2!: string | null;

  @Column({ type: 'varchar', nullable: true })
  subId3!: string | null;

  @Column({ type: 'varchar', nullable: true })
  subId4!: string | null;

  @Column({ type: 'varchar', nullable: true })
  subId5!: string | null;

  @Column({ type: 'varchar', nullable: true })
  subId6!: string | null;

  @Column({ type: 'varchar', nullable: true })
  subId7!: string | null;

  @Column({ type: 'varchar', nullable: true })
  subId8!: string | null;

  @Column({ type: 'varchar', length: 2, nullable: true })
  countryCode!: string | null;

  @Column({ type: 'varchar', nullable: true })
  transactionId!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  paidAt!: Date | null;

  // Set when a payout batch includes this conversion — the join back to an Invoice.
  @Index()
  @Column({ type: 'uuid', nullable: true })
  invoiceId!: string | null;

  @Index()
  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
