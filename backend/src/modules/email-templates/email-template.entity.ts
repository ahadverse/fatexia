import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// The transactional triggers listed in PLAN-backend.md. `templateKey` is the stable
// identifier the sending code looks up — renaming a template's subject must never
// break the trigger, so the key is not derived from the name.
export enum EmailTemplateKey {
  AFFILIATE_WELCOME = 'AFFILIATE_WELCOME',
  PASSWORD_RESET = 'PASSWORD_RESET',
  ACCESS_REQUEST_APPROVED = 'ACCESS_REQUEST_APPROVED',
  ACCESS_REQUEST_REJECTED = 'ACCESS_REQUEST_REJECTED',
  AFFILIATE_APPROVED = 'AFFILIATE_APPROVED',
  AFFILIATE_SUSPENDED = 'AFFILIATE_SUSPENDED',
  PAYOUT_SENT = 'PAYOUT_SENT',
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
