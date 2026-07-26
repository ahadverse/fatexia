import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Offer } from './offer.entity';

export enum PayoutMode {
  CPA = 'CPA',
  CPC = 'CPC',
  CPL = 'CPL',
  CPI = 'CPI',
  CPS = 'CPS',
}

export enum PayoutType {
  FLAT = 'FLAT',
  PERCENTAGE = 'PERCENTAGE',
}

export enum RevenueModel {
  RPA = 'RPA',
  RPC = 'RPC',
  NONE = 'NONE',
}

// Empty array on any dimension means "ALL" (unrestricted) for that dimension — the
// Tracker's targeting-match logic (built alongside clicks) treats it that way.
export interface PayoutRuleTargeting {
  countries: string[];
  devices: string[];
  affiliateIds: string[];
  affiliateGroupIds: string[];
}

@Entity('payout_rules')
export class PayoutRule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Offer, (offer) => offer.payoutRules, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'offerId' })
  offer!: Offer;

  @Index()
  @Column({ type: 'uuid' })
  offerId!: string;

  @Column({ type: 'enum', enum: PayoutMode })
  payoutMode!: PayoutMode;

  @Column({ type: 'enum', enum: PayoutType })
  payoutType!: PayoutType;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: string;

  // Stored for display/reporting only — never used to compute conversion.revenue.
  // Revenue always comes from the postback (money integrity rule, PLAN-backend.md);
  // overriding it from here would conflict with that.
  @Column({ type: 'enum', enum: RevenueModel, default: RevenueModel.NONE })
  revenueModel!: RevenueModel;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: '0.00' })
  revenueAmount!: string;

  @Column({ type: 'jsonb' })
  targeting!: PayoutRuleTargeting;

  @Column({ type: 'smallint', default: 0 })
  managerCommissionPercent!: number;

  @Column({ type: 'smallint', default: 0 })
  referAffiliateCommissionPercent!: number;

  // Forces PENDING at conversion time when true (see the future conversions module).
  @Column({ type: 'boolean', default: false })
  holdEnabled!: boolean;

  @Column({ type: 'smallint', default: 0 })
  holdDays!: number;

  @Column({ type: 'smallint', default: 0 })
  commissionPercent!: number;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
