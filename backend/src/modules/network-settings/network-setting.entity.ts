import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

// Singleton row. The primary key is a fixed literal rather than a generated uuid so
// there is structurally only ever one settings record to read or update — no
// "which row is current?" ambiguity and no ordering dependency.
export const NETWORK_SETTINGS_ID = 'default';

@Entity('network_settings')
export class NetworkSetting {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ type: 'varchar', default: 'Fatexia' })
  networkName!: string;

  @Column({ type: 'varchar', nullable: true })
  supportEmail!: string | null;

  @Column({ type: 'varchar', default: 'USD' })
  defaultCurrency!: string;

  @Column({ type: 'varchar', default: 'UTC' })
  timezone!: string;

  // Days an APPROVED conversion is held before it becomes payout-eligible.
  @Column({ type: 'int', default: 30 })
  defaultHoldDays!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 50 })
  minimumPayoutThreshold!: string;

  @Column({ type: 'int', default: 30 })
  payoutCycleDays!: number;

  @Column({ type: 'boolean', default: false })
  autoApproveAffiliates!: boolean;

  @Column({ type: 'boolean', default: false })
  autoApproveConversions!: boolean;

  // Points awarded per APPROVED conversion (informational ledger, not currency).
  @Column({ type: 'int', default: 10 })
  pointsPerConversion!: number;

  // Fraud score bands — seed values from PLAN-backend.md, tunable here rather than
  // hardcoded in the scoring code.
  @Column({ type: 'int', default: 30 })
  fraudSuspectThreshold!: number;

  @Column({ type: 'int', default: 70 })
  fraudBlockThreshold!: number;

  // Where a BLOCKED click is sent instead of the advertiser's landing page. Null
  // falls back to DEFAULT_BLOCKED_REDIRECT_URL in the tracker. Deliberately a
  // plausible destination rather than a 403: an error response is a signature a bot
  // operator can detect and route around, which turns the block into a hint.
  @Column({ type: 'varchar', nullable: true })
  blockedRedirectUrl!: string | null;

  @Column({ type: 'int', default: 10 })
  loginRateLimitPerMinute!: number;

  @Column({ type: 'int', default: 600 })
  clickRateLimitPerMinute!: number;

  // Sender identity for every transactional email. Delivery runs through Brevo's HTTP
  // API (see infra/email/brevo-mailer.ts), not an SMTP relay, so host/port/username
  // are not part of the setup — the API key is the only credential, and it lives on
  // the Emails → Settings page alongside these two fields.
  //
  // senderEmail must be a sender/domain Brevo has verified, or the send is rejected.
  @Column({ type: 'varchar', nullable: true })
  senderEmail!: string | null;

  @Column({ type: 'varchar', nullable: true })
  senderName!: string | null;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
