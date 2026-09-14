import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `PAYOUT_REJECTED` to the template-key enum.
 *
 * Separate from the migration that inserts the row, for the same reason as
 * `AffiliateVerifiedTemplateKey`: Postgres will not let a new enum value be used in
 * the transaction that added it.
 */
export class PayoutRejectedTemplateKey1788500000000 implements MigrationInterface {
  name = 'PayoutRejectedTemplateKey1788500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "email_templates_templatekey_enum" ADD VALUE IF NOT EXISTS 'PAYOUT_REJECTED'`,
    );
  }

  public async down(): Promise<void> {
    // Postgres cannot remove an enum value without rebuilding the type. No-op.
  }
}
