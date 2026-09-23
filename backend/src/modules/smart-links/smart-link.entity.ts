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

  /**
   * Thumbnail, the same kind an offer carries and shown the same way.
   *
   * A URL rather than the image: uploaded through `/uploads/smart-link-thumbnail`,
   * which stores the file and hands back an address. Nullable, and the lists that
   * render it fall back to the link's initials so a missing image does not shift
   * every name in the column.
   */
  @Column({ type: 'varchar', nullable: true })
  iconUrl!: string | null;

  /**
   * The landing page as an affiliate should see it, without tracking.
   *
   * Purely informational — nothing redirects here. A click still goes to
   * `destinationUrl`; this is the address someone opens to look at what they would be
   * sending traffic to before they decide to.
   */
  @Column({ type: 'varchar', nullable: true })
  previewLink!: string | null;

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
   * affiliate this percentage of what the advertiser pays for the sale, instead of the
   * payout on the member offer's own rule.
   *
   * Nullable — a link with no share falls back to the offer's rule.
   *
   * There is no companion "mode" column any more. It held CPA or CPS, was required by
   * the form before a percentage could be typed, and was read by nothing: the rate was
   * applied to whatever the link sent regardless. A share of a sale is CPS by
   * definition, so the choice was never real, and the offer-level schema already refuses
   * a PERCENTAGE payout outside CPS mode.
   */
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  revSharePercent!: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
