import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum AdvertiserStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}

// The advertiser portal/self-registration is deferred (see PLAN-admin.md) — there is
// still no userId/login here. Admin manages these as company records with contact
// details and a lifecycle status, which is what the Advertisers pages operate on.
@Entity('advertisers')
export class Advertiser {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Index()
  @Column({ type: 'enum', enum: AdvertiserStatus, default: AdvertiserStatus.ACTIVE })
  status!: AdvertiserStatus;

  @Column({ type: 'varchar', nullable: true })
  contactName!: string | null;

  @Column({ type: 'varchar', nullable: true })
  contactEmail!: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', nullable: true })
  country!: string | null;

  @Column({ type: 'varchar', nullable: true })
  websiteUrl!: string | null;

  // The account manager who owns this relationship (managers.id).
  @Column({ type: 'uuid', nullable: true })
  accountManagerId!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
