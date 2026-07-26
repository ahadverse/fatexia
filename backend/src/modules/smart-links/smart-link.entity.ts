import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum SmartLinkStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
}

// Rotation strategy for picking which member offer a given click resolves to.
export enum SmartLinkRotation {
  // Highest payout first — maximises affiliate earnings per click.
  TOP_PAYOUT = 'TOP_PAYOUT',
  // Even split across members.
  ROUND_ROBIN = 'ROUND_ROBIN',
  // Weighted by each member's recent conversion rate.
  BEST_CR = 'BEST_CR',
}

// A single link that resolves to a best-matching member offer at click time. Member
// offers live in `offerIds` rather than a join table — the list is small, always read
// as a whole, and never queried by member.
@Entity('smart_links')
export class SmartLink {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar' })
  slug!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  offerIds!: string[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  countries!: string[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  devices!: string[];

  @Column({ type: 'enum', enum: SmartLinkRotation, default: SmartLinkRotation.TOP_PAYOUT })
  rotation!: SmartLinkRotation;

  @Column({ type: 'enum', enum: SmartLinkStatus, default: SmartLinkStatus.ACTIVE })
  status!: SmartLinkStatus;

  // Where a click goes when no member offer matches the visitor's geo/device.
  @Column({ type: 'varchar', nullable: true })
  fallbackUrl!: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
