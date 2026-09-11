import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';

export enum ManagerRole {
  GENERAL = 'GENERAL',
  ACCOUNT = 'ACCOUNT',
  AFFILIATE = 'AFFILIATE',
}

/**
 * Issue #20 — the capabilities an admin ticks on per manager.
 *
 * A closed list rather than free-form strings: the checkbox grid, the DTO validation
 * and the route guards all read from this one array, so a permission cannot exist in
 * the UI without a guard behind it (or vice versa).
 *
 * `managerRole` stays what it is — a label describing what a manager *does*
 * (affiliate-facing vs. advertiser-facing). These are what they are *allowed* to do.
 * Keeping them separate means an admin can hand one affiliate manager the ability to
 * suspend accounts without granting it to every affiliate manager.
 */
export const MANAGER_PERMISSION_KEYS = [
  'affiliates.view',
  'affiliates.create',
  'affiliates.edit',
  'affiliates.approve',
  'affiliates.suspend',
  'affiliates.reject',
  'affiliates.delete',
  'affiliates.payout',
  'affiliates.impersonate',
  'offers.view',
  'offers.create',
  'offers.edit',
  'advertisers.manage',
  'reports.view',
  'messages.send',
] as const;

export type ManagerPermission = (typeof MANAGER_PERMISSION_KEYS)[number];

// Absent key = not granted. Stored partial rather than filled-in so adding a new
// permission below defaults every existing manager to "no", which is the safe
// direction for a capability they were never explicitly given.
export type ManagerPermissions = Partial<Record<ManagerPermission, boolean>>;

// Staff who share the Admin portal at a lesser privilege than ADMIN. Assignment
// scoping (a manager sees only their own affiliates/offers) is a service-layer filter
// on top of the existing requireRole guard — see PLAN-backend.md's permission matrix.
@Entity('managers')
export class Manager {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'uuid', unique: true })
  userId!: string;

  // Sequential, human-quotable account id — `MAN-1001` upward (issue #21). Minted from
  // the `manager_public_id_seq` Postgres sequence, never derived from a row count.
  // Nullable only so the column could be added to an existing table; every row written
  // after that migration has one.
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 20, nullable: true })
  publicId!: string | null;

  @Column({ type: 'enum', enum: ManagerRole })
  managerRole!: ManagerRole;

  // Issue #20 — what this specific manager may do (see MANAGER_PERMISSION_KEYS).
  @Column({ type: 'jsonb', default: () => "'{}'" })
  permissions!: ManagerPermissions;

  @Column({ type: 'varchar', length: 120, nullable: true })
  fullName!: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  skype!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  telegram!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  teams!: string | null;

  // A public-facing contact address, separate from the login email on `user` — an
  // affiliate's contact card falls back to the login email when this is unset.
  @Column({ type: 'varchar', length: 255, nullable: true })
  contactEmail!: string | null;

  // CDN URL, not the bytes — uploaded through the same `/uploads` module as offer
  // thumbnails and news images.
  @Column({ type: 'varchar', length: 500, nullable: true })
  avatarUrl!: string | null;

  // Default commission share on conversions from affiliates this manager owns. A
  // payout rule's own managerCommissionPercent overrides it per-offer.
  @Column({ type: 'int', default: 0 })
  defaultCommissionPercent!: number;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @ManyToOne(() => Manager, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reportsToId' })
  reportsTo!: Manager | null;

  @Column({ type: 'uuid', nullable: true })
  reportsToId!: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
