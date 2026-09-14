import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// The transactional triggers listed in PLAN-backend.md. `templateKey` is the stable
// identifier the sending code looks up — renaming a template's subject must never
// break the trigger, so the key is not derived from the name.
export enum EmailTemplateKey {
  /**
   * The verification email — carries the code, sent the moment someone registers.
   *
   * Badly named, and kept that way because the key is the stable identifier the
   * sending code and every existing database row point at; renaming it would be a
   * data migration for no behavioural gain. `AFFILIATE_VERIFIED` below is the actual
   * welcome.
   */
  AFFILIATE_WELCOME = 'AFFILIATE_WELCOME',
  /** Sent once the code above is accepted — the real "you're in" email. */
  AFFILIATE_VERIFIED = 'AFFILIATE_VERIFIED',
  PASSWORD_RESET = 'PASSWORD_RESET',
  ACCESS_REQUEST_APPROVED = 'ACCESS_REQUEST_APPROVED',
  ACCESS_REQUEST_REJECTED = 'ACCESS_REQUEST_REJECTED',
  AFFILIATE_APPROVED = 'AFFILIATE_APPROVED',
  AFFILIATE_REJECTED = 'AFFILIATE_REJECTED',
  AFFILIATE_SUSPENDED = 'AFFILIATE_SUSPENDED',
  PAYOUT_SENT = 'PAYOUT_SENT',
  /**
   * An invoice moved to REJECTED — the payout was not made.
   *
   * The counterpart to PAYOUT_SENT. Money not arriving is at least as worth an email
   * as money arriving, and until now that status changed in silence: the affiliate's
   * balance simply stopped moving with no explanation anywhere.
   */
  PAYOUT_REJECTED = 'PAYOUT_REJECTED',
  OFFER_LIVE = 'OFFER_LIVE',
}

@Entity('email_templates')
export class EmailTemplate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: EmailTemplateKey, unique: true })
  templateKey!: EmailTemplateKey;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar' })
  subject!: string;

  @Column({ type: 'text' })
  body!: string;

  // Macro names this template accepts, e.g. {affiliate_name} — shown as hints in the
  // admin editor so the author doesn't have to guess.
  @Column({ type: 'jsonb', default: () => "'[]'" })
  availableMacros!: string[];

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
