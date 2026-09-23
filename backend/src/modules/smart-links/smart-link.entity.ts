import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Advertiser } from '../advertisers/advertiser.entity';
import { TrackingPlatform } from '../offers/offer.entity';
import { SmartLinkCap } from './smart-link-cap.entity';

export { TrackingPlatform };

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

  /**
   * Who the traffic is ultimately sold to.
   *
   * Nullable, unlike `offers.advertiserId` which is required. An offer is always an
   * advertiser's offer; a smart-link may be built before it is known which advertiser
   * the sale settles against, and every link that existed before this column did has
   * no answer to give. RESTRICT on delete for the same reason offers use it: an
   * advertiser with live links must not vanish out from under them.
   */
  @ManyToOne(() => Advertiser, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'advertiserId' })
  advertiser!: Advertiser | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  advertiserId!: string | null;

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

  @Column({ type: 'varchar', nullable: true })
  kpi!: string | null;

  @Column({ type: 'varchar', nullable: true })
  category!: string | null;

  // No startDate/endDate/currency, deliberately. An offer has all three; a smart-link
  // is not scheduled and prices in the network's currency, so there was nowhere in the
  // form to set them and a stored value nothing can write is worse than no column.
  @Column({ type: 'enum', enum: TrackingPlatform, enumName: 'smart_links_trackingplatform_enum', default: TrackingPlatform.DIRECT })
  trackingPlatform!: TrackingPlatform;

  // Same meaning as on an offer: false gates the link behind an access request rather
  // than hiding it. Default true, matching offers.
  @Column({ type: 'boolean', default: true })
  isPublic!: boolean;

  // Traffic sources the affiliate MAY send; empty means "not specified", not "none".
  @Column({ type: 'jsonb', default: () => "'[]'" })
  trafficTypes!: string[];

  // Traffic sources the affiliate may NOT send. A separate list rather than a flag,
  // because absent from both means the link simply has not said.
  @Column({ type: 'jsonb', default: () => "'[]'" })
  disallowedTrafficTypes!: string[];

  @Column({ type: 'boolean', default: false })
  featured!: boolean;

  // The id this link carries in whatever system the network runs alongside ours.
  @Column({ type: 'varchar', nullable: true })
  networkOfferId!: string | null;

  /**
   * Nullable for the same reason `currency` is: null means "use the network setting".
   *
   * An offer's copy of this is a plain boolean defaulting to false, because an offer
   * always decides for itself. A smart-link's conversions have been approved according
   * to `network_settings.autoApproveConversions` since the offer-less path was written,
   * so a `false` default here would start holding conversions that were auto-approving
   * yesterday — a money-visible change made by adding a column. Null keeps that
   * behaviour and lets a link override it in either direction.
   */
  @Column({ type: 'boolean', nullable: true })
  autoApproveConversions!: boolean | null;

  @Column({ type: 'boolean', default: false })
  allowDeepLinking!: boolean;

  @Column({ type: 'text', nullable: true })
  remarksForAdmin!: string | null;

  @Column({ type: 'text', nullable: true })
  remarksForAffiliateManager!: string | null;

  /**
   * Per-link postback credentials, mirroring an offer's.
   *
   * Until these existed, a conversion on an offer-less link could only be authorised by
   * the network-wide postback entry, because the per-offer gate needs an offer. These
   * give such a link credentials of its own — see `postback.service.ts`, where they are
   * checked exactly as an offer's are, with the global entry still accepted as before.
   */
  @Column({ type: 'varchar', nullable: true })
  postbackSecret!: string | null;

  @Column({ type: 'varchar', nullable: true })
  allowedPostbackIps!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  postbackVerifiedAt!: Date | null;

  // Per-link override for where BLOCKED traffic goes. Null uses the network-wide
  // setting, same as an offer's.
  @Column({ type: 'varchar', nullable: true })
  blockedRedirectUrl!: string | null;

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

  // No DDL impact on this table — the FK column lives on SmartLinkCap.
  @OneToMany(() => SmartLinkCap, (cap) => cap.smartLink)
  caps!: SmartLinkCap[];

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
