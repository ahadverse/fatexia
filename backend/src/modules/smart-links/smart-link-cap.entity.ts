import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { CapMetric, CapPeriod } from '../offers/offer-cap.entity';
import { SmartLink } from './smart-link.entity';

export { CapMetric, CapPeriod };

/**
 * A smart-link's cap limits — the same shape as `offer_caps`, against a link.
 *
 * Its own table rather than a nullable `smartLinkId` on `offer_caps`: that table's
 * `offerId` is NOT NULL and every query against it assumes an offer, so widening it
 * would mean auditing each of those for a row that has no offer. The two never join.
 *
 * Like OfferCap, this is data model and UI only — nothing enforces a cap yet, for
 * links or for offers. Stored so the limits an operator sets survive, and so whichever
 * enforcement is written later has both kinds to read from one shape.
 */
@Entity('smart_link_caps')
export class SmartLinkCap {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => SmartLink, (link) => link.caps, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'smartLinkId' })
  smartLink!: SmartLink;

  // CASCADE, unlike OfferCap's RESTRICT: a smart-link is deletable (see
  // smartLinkService.deleteSmartLink) and its caps are meaningless without it, whereas
  // an offer is soft-deleted by status and its caps outlive any single edit.
  @Index()
  @Column({ type: 'uuid' })
  smartLinkId!: string;

  @Column({ type: 'enum', enum: CapPeriod, enumName: 'smart_link_caps_period_enum' })
  period!: CapPeriod;

  @Column({ type: 'enum', enum: CapMetric, enumName: 'smart_link_caps_metric_enum' })
  metric!: CapMetric;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  limit!: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
