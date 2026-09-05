import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// Every third-party credential in the system is configured here and nowhere else
// (PLAN-admin.md: "all credentials handled by admin").
export enum IntegrationProvider {
  IPHUB = 'IPHUB',
  IPAPI_IS = 'IPAPI_IS',
  IPQS = 'IPQS',
  MAXMIND = 'MAXMIND',
  SMTP = 'SMTP',
  PAYPAL = 'PAYPAL',
  WISE = 'WISE',
  // Offer thumbnail storage (issue #18). apiKey/apiSecret hold the AWS access key
  // id/secret; bucket/region/cdnBaseUrl live in config — same non-secret-config split
  // every other provider uses.
  S3 = 'S3',
}

export enum IntegrationStatus {
  NOT_CONFIGURED = 'NOT_CONFIGURED',
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
  ERROR = 'ERROR',
}

@Entity('integrations')
export class Integration {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: IntegrationProvider, unique: true })
  provider!: IntegrationProvider;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  // Secret material. Never returned raw by the API — the DTO layer masks it to a
  // last-4 preview, and a blank value on update means "leave unchanged" so the UI
  // can render the masked form without round-tripping the real secret.
  @Column({ type: 'varchar', nullable: true })
  apiKey!: string | null;

  @Column({ type: 'varchar', nullable: true })
  apiSecret!: string | null;

  // Non-secret provider config (endpoint, account id, quota) — safe to return.
  @Column({ type: 'jsonb', default: () => "'{}'" })
  config!: Record<string, unknown>;

  @Column({ type: 'enum', enum: IntegrationStatus, default: IntegrationStatus.NOT_CONFIGURED })
  status!: IntegrationStatus;

  @Column({ type: 'timestamp', nullable: true })
  lastCheckedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  lastError!: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
