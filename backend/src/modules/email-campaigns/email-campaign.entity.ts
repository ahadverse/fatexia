import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

export enum CampaignAudience {
  ALL = 'ALL',
  AFFILIATES = 'AFFILIATES',
  ADVERTISERS = 'ADVERTISERS',
  MANAGERS = 'MANAGERS',
}

export enum CampaignStatus {
  SENDING = 'SENDING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum CampaignRecipientStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
}

/**
 * One admin broadcast. The recipient list is snapshotted into `email_campaign_recipients`
 * when the campaign is created, so the audience is fixed at that moment — an affiliate
 * approved halfway through a send is not added, and a restart resumes the same list.
 */
@Entity('email_campaigns')
export class EmailCampaign {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  subject!: string;

  /** The unsubstituted text — per-recipient macros are resolved at send time. */
  @Column({ type: 'text' })
  body!: string;

  /** Admin-supplied macro values shared by every recipient. */
  @Column({ type: 'jsonb', nullable: true })
  macros!: Record<string, string> | null;

  @Column({ type: 'enum', enum: CampaignAudience })
  audience!: CampaignAudience;

  /** True: only ACTIVE accounts. False: also PENDING/INACTIVE; never BLOCKED or REJECTED. */
  @Column({ type: 'boolean', default: true })
  activeOnly!: boolean;

  @Index()
  @Column({ type: 'enum', enum: CampaignStatus, default: CampaignStatus.SENDING })
  status!: CampaignStatus;

  @Column({ type: 'int', default: 0 })
  totalRecipients!: number;

  @Column({ type: 'int', default: 0 })
  sentCount!: number;

  @Column({ type: 'int', default: 0 })
  failedCount!: number;

  /** users.id of the admin who sent it — the audit trail. */
  @Column({ type: 'uuid', nullable: true })
  createdById!: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  finishedAt!: Date | null;
}

@Entity('email_campaign_recipients')
@Index(['campaignId', 'status'])
@Index(['campaignId', 'email'], { unique: true })
export class EmailCampaignRecipient {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => EmailCampaign, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaignId' })
  campaign!: EmailCampaign;

  @Column({ type: 'uuid' })
  campaignId!: string;

  @Column({ type: 'varchar' })
  email!: string;

  /** Source group of this recipient, shown in the history ("AFFILIATES", …). */
  @Column({ type: 'varchar', length: 20 })
  kind!: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  fullName!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  publicId!: string | null;

  @Column({ type: 'enum', enum: CampaignRecipientStatus, default: CampaignRecipientStatus.PENDING })
  status!: CampaignRecipientStatus;

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  sentAt!: Date | null;
}
