import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';

export enum ManagerRole {
  GENERAL = 'GENERAL',
  ACCOUNT = 'ACCOUNT',
  AFFILIATE = 'AFFILIATE',
}

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

  @Column({ type: 'enum', enum: ManagerRole })
  managerRole!: ManagerRole;

  @Column({ type: 'varchar', length: 120, nullable: true })
  fullName!: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  skype!: string | null;

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
