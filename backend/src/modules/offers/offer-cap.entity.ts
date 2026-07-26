import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Offer } from './offer.entity';

export enum CapPeriod {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  OVERALL = 'OVERALL',
}

export enum CapMetric {
  CLICKS = 'CLICKS',
  CONVERSIONS = 'CONVERSIONS',
  PAYOUT = 'PAYOUT',
}

// Data model only — enforcement happens once the clicks/conversions modules exist.
@Entity('offer_caps')
export class OfferCap {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Offer, (offer) => offer.caps, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'offerId' })
  offer!: Offer;

  @Index()
  @Column({ type: 'uuid' })
  offerId!: string;

  @Column({ type: 'enum', enum: CapPeriod })
  period!: CapPeriod;

  @Column({ type: 'enum', enum: CapMetric })
  metric!: CapMetric;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  limit!: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
