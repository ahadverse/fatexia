import { AppDataSource } from '../../infra/database/data-source';
import { User, UserStatus } from './user.entity';

const repository = AppDataSource.getRepository(User);

export const userRepository = {
  findByEmail(email: string): Promise<User | null> {
    return repository.findOne({ where: { email } });
  },

  findById(id: string): Promise<User | null> {
    return repository.findOne({ where: { id } });
  },

  create(data: Pick<User, 'email' | 'passwordHash' | 'role' | 'status'>): Promise<User> {
    return repository.save(repository.create(data));
  },

  updateLastLogin(id: string): Promise<void> {
    return repository.update({ id }, { lastLogin: new Date() }).then(() => undefined);
  },

  updateStatus(id: string, status: UserStatus): Promise<void> {
    return repository.update({ id }, { status }).then(() => undefined);
  },

  updatePassword(id: string, passwordHash: string): Promise<void> {
    return repository.update({ id }, { passwordHash }).then(() => undefined);
  },

  /**
   * Looks a user up by the *hash* of their reset token — the raw token never reaches
   * the database, and the reset link carries no email to look up instead.
   */
  findByPasswordResetTokenHash(passwordResetTokenHash: string): Promise<User | null> {
    return repository.findOne({ where: { passwordResetTokenHash } });
  },

  updatePasswordReset(
    id: string,
    fields: Pick<User, 'passwordResetTokenHash' | 'passwordResetExpiresAt'>,
  ): Promise<void> {
    return repository.update({ id }, fields).then(() => undefined);
  },

  updateVerification(
    id: string,
    fields: Partial<Pick<User, 'emailVerifiedAt' | 'emailVerificationCode' | 'emailVerificationExpiresAt' | 'emailVerificationAttempts'>>,
  ): Promise<void> {
    return repository.update({ id }, fields).then(() => undefined);
  },
};
