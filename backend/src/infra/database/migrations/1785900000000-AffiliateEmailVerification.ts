import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Email verification for self-registered affiliates — a 6-digit code emailed at
 * register, separate from the existing admin-approval status gate (see
 * user.entity.ts's comment on emailVerifiedAt). An admin can still approve an
 * unverified applicant or mark one verified manually, so nothing here blocks login;
 * it is visible/settable state, not a new gate.
 */
export class AffiliateEmailVerification1785900000000 implements MigrationInterface {
  name = 'AffiliateEmailVerification1785900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "emailVerifiedAt" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "users" ADD "emailVerificationCode" character varying`);
    await queryRunner.query(`ALTER TABLE "users" ADD "emailVerificationExpiresAt" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "users" ADD "emailVerificationAttempts" smallint NOT NULL DEFAULT 0`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "emailVerificationAttempts"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "emailVerificationExpiresAt"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "emailVerificationCode"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "emailVerifiedAt"`);
  }
}
