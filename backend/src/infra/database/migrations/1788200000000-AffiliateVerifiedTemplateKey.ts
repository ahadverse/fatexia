import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the `AFFILIATE_VERIFIED` value to the template-key enum.
 *
 * Split from the migration that inserts the row on purpose. Postgres will not let a
 * new enum value be *used* in the transaction that added it, and this project runs
 * each migration in its own transaction (`migrationsTransactionMode: 'each'`, see
 * data-source.ts) — so the value is committed here and the row that references it is
 * inserted by the next migration.
 *
 * `IF NOT EXISTS` because a failed deploy can leave the value added but the migrations
 * row unwritten, and the retry must not die on "already exists".
 */
export class AffiliateVerifiedTemplateKey1788200000000 implements MigrationInterface {
  name = 'AffiliateVerifiedTemplateKey1788200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "email_templates_templatekey_enum" ADD VALUE IF NOT EXISTS 'AFFILIATE_VERIFIED'`,
    );
  }

  public async down(): Promise<void> {
    // Postgres cannot drop a value from an enum type. Reversing this would mean
    // rebuilding the type and rewriting the column, which is far more destructive
    // than the unused value it would remove — so the down is deliberately a no-op.
  }
}
