import { Column, CreateDateColumn, Entity, Index, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';

// Contact/traffic messengers an affiliate can reach us on.
export enum AffiliateMessenger {
  TELEGRAM = 'TELEGRAM',
  SKYPE = 'SKYPE',
  WHATSAPP = 'WHATSAPP',
}

// One CRYPTO value rather than one per coin: which coin and which chain live in
// `payoutDetails` (see CRYPTO_CURRENCIES in affiliate.dto.ts). Adding a coin is then
// a data change, not an enum migration — and the payout rail is the same either way.
export enum AffiliatePayoutMethod {
  BANK_TRANSFER = 'BANK_TRANSFER',
  PAYPAL = 'PAYPAL',
  CRYPTO = 'CRYPTO',
}

// Profile captured at self-registration. The columns are nullable at the DB level so
// the migration is safe against affiliate rows that predate them (e.g. the dev seed);
// presence of the required ones is enforced by the Zod register schema, not the DB.
// Fuller fields (postback URL, referredBy, assigned manager — see PLAN-backend.md)
// still land in a later pass.
@Entity('affiliates')
export class Affiliate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'uuid', unique: true })
  userId!: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  fullName!: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  country!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  messengerType!: AffiliateMessenger | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  messengerHandle!: string | null;

  // Stored as a comma-joined text column (TypeORM 'simple-array').
  @Column({ type: 'simple-array', nullable: true })
  trafficSources!: string[] | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  websiteUrl!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  companyName!: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  phone!: string | null;

  // Verticals/niches the applicant wants to run (comma-joined text via simple-array).
  @Column({ type: 'simple-array', nullable: true })
  verticals!: string[] | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  monthlyVolume!: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  referralSource!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  // Where outbound conversion postbacks are delivered. Supports the same macro style
  // as an offer's destination URL ({click_id}, {payout}, {status}).
  @Column({ type: 'varchar', length: 500, nullable: true })
  postbackUrl!: string | null;

  // The affiliate who referred this one — drives the Referral Program report and the
  // referAffiliateCommissionPercent split on payout rules.
  @Index()
  @Column({ type: 'uuid', nullable: true })
  referredByAffiliateId!: string | null;

  // Their own referral code, shared to recruit new affiliates.
  @Column({ type: 'varchar', length: 40, nullable: true })
  referralCode!: string | null;

  // Assigned affiliate manager (managers.id). Manager-role staff are scoped to the
  // affiliates pointing at them (see PLAN-backend.md's permission matrix).
  @Index()
  @Column({ type: 'uuid', nullable: true })
  assignedManagerId!: string | null;

  @Column({ type: 'enum', enum: AffiliatePayoutMethod, nullable: true })
  payoutMethod!: AffiliatePayoutMethod | null;

  // Non-secret payout routing details (PayPal email, bank name/last-4). Real bank
  // credentials are never stored here — see PLAN-backend.md's payout policy.
  @Column({ type: 'jsonb', default: () => "'{}'" })
  payoutDetails!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
