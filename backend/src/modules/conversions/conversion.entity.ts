import { Column, CreateDateColumn, Entity, Generated, Index, PrimaryGeneratedColumn } from 'typeorm';
import { refIdTransformer } from '../../common/ref-id';

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

  // The conversion number quoted in a dispute — "check conversion 300412". Filled by
  // the database's own sequence; see common/ref-id.ts.
  @Index('UQ_conversions_refId', { unique: true })
  @Generated('increment')
  @Column({ type: 'bigint', transformer: refIdTransformer })
  refId!: number;

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

  // The rate is always ours — taken from the offer's PayoutRule at write time, never
  // from the postback (money integrity rule, PLAN-backend.md). What the advertiser may
  // supply is the base it applies to; see `reportedRevenue` below.
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  revenueAmount!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  payoutAmount!: string;

  /**
   * The sale value the advertiser sent on the postback (`sum`/`revenue`), verbatim.
   *
   * Null on every conversion priced from the rule's configured revenue — which is every
   * row written before this existed, every manually-added conversion, and every postback
   * from an advertiser who does not send an amount.
   *
   * Kept beside `revenueAmount` rather than replacing it so the two questions stay
   * separable: `revenueAmount` is what the conversion was priced at, this is what we
   * were told. When they differ, the pricing ignored the report — because it was zero,
   * absent, or the conversion is a duplicate carrying no money — and that difference is
   * the only record of it.
   *
   * Network-side only. It is the advertiser's revenue, and the affiliate sees their own
   * payout, never this (`audit-affiliate-visibility.js` enforces it).
   */
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  reportedRevenue!: string | null;

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
