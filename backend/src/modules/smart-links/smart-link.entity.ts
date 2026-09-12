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

  /**
   * Overrides where a matched click lands. The member offer is still chosen, logged
   * and paid against — only the address changes — so a network that routes rotator
   * traffic through its own page keeps correct attribution.
   *
   * Null (the normal case) sends the click to the chosen offer's own destination,
   * which is what a smart-link does by default.
   */
  @Column({ type: 'varchar', nullable: true })
  destinationUrl!: string | null;

  /**
   * Revenue share. When set, a conversion that came through this link pays the
   * affiliate `revSharePercent` of what the advertiser pays, instead of the flat
   * payout on the member offer's own rule.
   *
   * Both columns are nullable and move together — a link with no share configured
   * falls back to the offer's rule, which is what every existing link does.
   *
   * `revShareMode` records which conversion type the share is meant for (CPA or CPS).
   * It is descriptive rather than a filter: the percentage applies to whatever the
   * link sends, and one link carries one rate (see the admin form's note).
   */
  @Column({ type: 'varchar', length: 10, nullable: true })
  revShareMode!: string | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  revSharePercent!: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
