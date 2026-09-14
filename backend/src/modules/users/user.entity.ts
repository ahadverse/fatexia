import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  AFFILIATE = 'AFFILIATE',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  PENDING = 'PENDING',
  BLOCKED = 'BLOCKED',
  REJECTED = 'REJECTED',
  INACTIVE = 'INACTIVE',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true })
  email!: string;

  @Column({ type: 'varchar' })
  passwordHash!: string;

  @Column({ type: 'enum', enum: UserRole })
  role!: UserRole;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.PENDING })
  status!: UserStatus;

  @Column({ type: 'timestamp', nullable: true })
  lastLogin!: Date | null;

  // Separate from `status` on purpose: verification confirms the affiliate owns the
  // email address, approval is the network's business decision — an admin can approve
  // an unverified applicant, and verifying never auto-approves one (see auth.service.ts
  // register/verifyEmail, affiliate.service.ts markEmailVerified).
  @Column({ type: 'timestamp', nullable: true })
  emailVerifiedAt!: Date | null;

  @Column({ type: 'varchar', nullable: true })
  emailVerificationCode!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  emailVerificationExpiresAt!: Date | null;

  @Column({ type: 'smallint', default: 0 })
  emailVerificationAttempts!: number;

  /**
   * SHA-256 of the password-reset token, never the token itself.
   *
   * Unlike the verification code above — six digits, useless without also controlling
   * the inbox it was sent to — this one *is* the credential: whoever holds it can take
   * the account. Stored hashed so a database leak alone cannot be used to reset
   * anybody's password, the same reasoning as `passwordHash`.
   */
  @Index()
  @Column({ type: 'varchar', nullable: true })
  passwordResetTokenHash!: string | null;

  /** Cleared on use as well as on expiry, which is what makes the token single-use. */
  @Column({ type: 'timestamp', nullable: true })
  passwordResetExpiresAt!: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
