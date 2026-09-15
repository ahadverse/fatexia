import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  PAID = 'PAID',
  REJECTED = 'REJECTED',
}

// Mirrors AffiliatePayoutMethod — a batch must be recordable on every rail an
// affiliate is allowed to choose, or a crypto-paying affiliate could never be
// invoiced on the method they were actually paid by.
export enum PaymentMethod {
  BANK_TRANSFER = 'BANK_TRANSFER',
  PAYPAL = 'PAYPAL',
  CRYPTO = 'CRYPTO',
}

// An affiliate payout batch. `amount` is a settled figure — the total of the
// conversions this batch actually captured at generation time, not a live balance.
// Live balance is always recomputed from conversions (money integrity rule), so
// nothing here can drift from the source data.
@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar' })
  invoiceNumber!: string;

  @Index()
  @Column({ type: 'uuid' })
  affiliateId!: string;

  @Column({ type: 'timestamp' })
  periodFrom!: Date;

  @Column({ type: 'timestamp' })
  periodTo!: Date;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  amount!: string;

  @Column({ type: 'varchar', default: 'USD' })
  currency!: string;

  @Column({ type: 'int', default: 0 })
  conversionCount!: number;

  @Index()
  @Column({ type: 'enum', enum: InvoiceStatus, default: InvoiceStatus.DRAFT })
  status!: InvoiceStatus;

  @Column({ type: 'enum', enum: PaymentMethod, default: PaymentMethod.BANK_TRANSFER })
  paymentMethod!: PaymentMethod;

  @Column({ type: 'varchar', nullable: true })
  paymentReference!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  paidAt!: Date | null;

  /**
   * When this invoice was cancelled and its conversions handed back to the payable pool.
   *
   * Separate from `status` because releasing is about the conversions, not the decision:
   * a REJECTED invoice whose earnings are still locked to it and one whose earnings are
   * back in the pool are different situations, and only this column tells them apart.
   * Set once and never cleared — a released invoice is terminal.
   */
  @Column({ type: 'timestamp', nullable: true })
  releasedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
