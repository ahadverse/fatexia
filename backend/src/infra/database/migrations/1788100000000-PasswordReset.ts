import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Password reset, which the product has never had.
 *
 * A `PASSWORD_RESET` email template has been seeded since the beginning and no code
 * path has ever sent it — there was no forgot-password route, no token, no service.
 * An affiliate who lost their password had to ask an admin to change it by hand.
 *
 * Two columns on `users` rather than a `password_reset_tokens` table, matching how
 * email verification is already stored on the row. One live token per account is the
 * correct model anyway: requesting a new reset should invalidate the previous one, and
 * a separate table would let several work at once unless deliberately prevented.
 *
 * The token is stored as a SHA-256 hash. It is a bearer credential — whoever holds it
 * owns the account until it expires — so a leaked database must not be enough to use
 * it, the same argument as for `passwordHash`.
 */
export class PasswordReset1788100000000 implements MigrationInterface {
  name = 'PasswordReset1788100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "passwordResetTokenHash" character varying`);
    await queryRunner.query(`ALTER TABLE "users" ADD "passwordResetExpiresAt" TIMESTAMP`);
    // Lookup is by token hash — the reset link carries no email — so this is the
    // access path for every reset, not an optimisation.
    await queryRunner.query(
      `CREATE INDEX "IDX_users_password_reset_token" ON "users" ("passwordResetTokenHash")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_users_password_reset_token"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "passwordResetExpiresAt"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "passwordResetTokenHash"`);
  }
}
