import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Every kind of money event the billing side can record against an affiliate.
 *
 * Invoice lifecycle events are written by the invoice service inside the same database
 * transaction that moves the invoice, so the ledger and the invoice can never disagree
 * about what happened. `MANUAL_ADJUSTMENT` is the one an admin writes directly.
 */
export enum TransactionType {
  /** A payout batch (or a manual invoice) raised this amount for the affiliate. */
  INVOICE_GENERATED = 'INVOICE_GENERATED',
  /** Money actually left the network. */
  PAYOUT_SENT = 'PAYOUT_SENT',
  /** The payout failed or was refused — the invoice stands, the money did not move. */
  PAYOUT_REJECTED = 'PAYOUT_REJECTED',
  /** The invoice was cancelled and its conversions went back into the payable pool. */
  INVOICE_RELEASED = 'INVOICE_RELEASED',
  /** A bonus, a penalty, or a correction. The only signed amount here. */
  MANUAL_ADJUSTMENT = 'MANUAL_ADJUSTMENT',
}

/**
 * Append-only ledger of affiliate money events.
 *
 * Deliberately never updated or deleted: a correction is a new row, the same rule the
 * points ledger follows. Nothing on the billing side derives a balance from this table
 * — balances are still recomputed from conversions (money integrity rule) — so the
 * ledger's job is to answer "what happened to this affiliate's money, and when".
 *
 * `invoiceNumber` is stored rather than joined on purpose. An invoice number is fixed
 * the moment it is assigned, and a ledger row is a historical record: it should still
 * read correctly next to an invoice that has since been released.
 */
@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  affiliateId!: string;

  // Null for a manual adjustment, which is not tied to any invoice.
  @Index()
  @Column({ type: 'uuid', nullable: true })
  invoiceId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  invoiceNumber!: string | null;

  @Index()
  @Column({ type: 'enum', enum: TransactionType })
  type!: TransactionType;

  // Signed. Only MANUAL_ADJUSTMENT is ever negative; the invoice events carry the
  // invoice's own amount, so summing one type answers a real question ("paid out this
  // month") while summing across types deliberately does not.
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  amount!: string;

  @Column({ type: 'varchar', default: 'USD' })
  currency!: string;

  // Wire reference, PayPal batch id, or whatever the admin quoted on the payment.
  @Column({ type: 'varchar', nullable: true })
  reference!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  // Null when the row came from an automated path rather than an admin action.
  @Column({ type: 'uuid', nullable: true })
  createdByUserId!: string | null;

  @Index()
  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
