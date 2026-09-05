import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Advertiser } from '../advertisers/advertiser.entity';
import { PayoutRule } from './payout-rule.entity';
import { OfferCap } from './offer-cap.entity';

export enum OfferStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PAUSED = 'PAUSED',
  DELETED = 'DELETED',
}

export enum TrackingPlatform {
  DIRECT = 'DIRECT',
  AFFISE = 'AFFISE',
  HASOFFERS = 'HASOFFERS',
  CAKE = 'CAKE',
  OTHER = 'OTHER',
}

@Entity('offers')
export class Offer {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Advertiser, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'advertiserId' })
  advertiser!: Advertiser;

  @Index()
  @Column({ type: 'uuid' })
  advertiserId!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', nullable: true })
  previewLink!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', nullable: true })
  kpi!: string | null;

  @Column({ type: 'varchar', nullable: true })
  category!: string | null;

  @Column({ type: 'varchar', nullable: true })
  iconUrl!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  startDate!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  endDate!: Date | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  defaultPayoutAmount!: string;

  @Column({ type: 'varchar', default: 'USD' })
  currency!: string;

  @Column({ type: 'enum', enum: OfferStatus, default: OfferStatus.PENDING })
  status!: OfferStatus;

  // True (default): any affiliate can see and run this offer once it's APPROVED.
  // False: it's gated — an affiliate must have an APPROVED row in
  // offer_access_requests for this offer before it appears in their Browse/available
  // list (see offerRepository.findAvailableForAffiliate).
  @Column({ type: 'boolean', default: true })
  isPublic!: boolean;

  @Column({ type: 'enum', enum: TrackingPlatform, default: TrackingPlatform.DIRECT })
  trackingPlatform!: TrackingPlatform;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  trafficTypes!: string[];

  @Column({ type: 'boolean', default: false })
  featured!: boolean;

  @Column({ type: 'varchar', nullable: true })
  networkOfferId!: string | null;

  @Column({ type: 'boolean', default: false })
  autoApproveConversions!: boolean;

  @Column({ type: 'boolean', default: false })
  allowDeepLinking!: boolean;

  @Column({ type: 'text', nullable: true })
  remarksForAdmin!: string | null;

  @Column({ type: 'text', nullable: true })
  remarksForAffiliateManager!: string | null;

  // Nullable: an offer can exist in PENDING/draft before its destination is
  // configured. The activation gate requires it (containing {click_id}) before the
  // offer can move to APPROVED — see offer.service.ts assertActivationGate.
  @Column({ type: 'varchar', nullable: true })
  destinationUrl!: string | null;

  // Where a click goes when it matches none of the offer's payout-rule targeting
  // (issue #15 — geo/device/OS gating). Null falls back to destinationUrl itself, so
  // an offer with no targeting configured behaves exactly as before this existed.
  @Column({ type: 'varchar', nullable: true })
  fallbackUrl!: string | null;

  @Column({ type: 'varchar', nullable: true })
  postbackSecret!: string | null;

  @Column({ type: 'varchar', nullable: true })
  allowedPostbackIps!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  postbackVerifiedAt!: Date | null;

  // Per-offer override for where BLOCKED traffic goes. Null uses the network-wide
  // setting. Exists because some advertisers require rejected traffic to land on
  // their own "offer unavailable" page rather than anywhere the network chooses.
  @Column({ type: 'varchar', nullable: true })
  blockedRedirectUrl!: string | null;

  // No DDL impact on this table — the FK column lives on PayoutRule.
  @OneToMany(() => PayoutRule, (rule) => rule.offer)
  payoutRules!: PayoutRule[];

  // No DDL impact on this table — the FK column lives on OfferCap.
  @OneToMany(() => OfferCap, (cap) => cap.offer)
  caps!: OfferCap[];

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
