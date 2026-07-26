import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Two independent changes that happen to land together:
 *
 * 1. CRYPTO joins both payout-method enums. `payoutDetails` (already jsonb) carries
 *    the coin, network and wallet address — no new column, so adding a coin later is
 *    a data change rather than another migration.
 * 2. `messages.subject` is dropped. There is one conversation per affiliate, so a
 *    per-message subject line was never grouping or routing anything.
 *
 * Postgres will not run ALTER TYPE ... ADD VALUE inside a transaction block, and
 * TypeORM wraps migrations in one — hence the recreate-the-type dance rather than
 * the one-liner.
 */
export class CryptoPayoutsAndDropMessageSubject1785500000000 implements MigrationInterface {
  name = 'CryptoPayoutsAndDropMessageSubject1785500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- affiliates.payoutMethod: + CRYPTO
    await queryRunner.query(`ALTER TYPE "public"."affiliates_payoutmethod_enum" RENAME TO "affiliates_payoutmethod_enum_old"`);
    await queryRunner.query(`CREATE TYPE "public"."affiliates_payoutmethod_enum" AS ENUM('BANK_TRANSFER', 'PAYPAL', 'CRYPTO')`);
    await queryRunner.query(
      `ALTER TABLE "affiliates" ALTER COLUMN "payoutMethod" TYPE "public"."affiliates_payoutmethod_enum" USING "payoutMethod"::text::"public"."affiliates_payoutmethod_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."affiliates_payoutmethod_enum_old"`);

    // --- invoices.paymentMethod: + CRYPTO. The column has a default, which has to be
    // dropped before the type change and restored after — a default expression is
    // typed against the old enum and blocks the ALTER otherwise.
    await queryRunner.query(`ALTER TABLE "invoices" ALTER COLUMN "paymentMethod" DROP DEFAULT`);
    await queryRunner.query(`ALTER TYPE "public"."invoices_paymentmethod_enum" RENAME TO "invoices_paymentmethod_enum_old"`);
    await queryRunner.query(`CREATE TYPE "public"."invoices_paymentmethod_enum" AS ENUM('BANK_TRANSFER', 'PAYPAL', 'CRYPTO')`);
    await queryRunner.query(
      `ALTER TABLE "invoices" ALTER COLUMN "paymentMethod" TYPE "public"."invoices_paymentmethod_enum" USING "paymentMethod"::text::"public"."invoices_paymentmethod_enum"`,
    );
    await queryRunner.query(`ALTER TABLE "invoices" ALTER COLUMN "paymentMethod" SET DEFAULT 'BANK_TRANSFER'`);
    await queryRunner.query(`DROP TYPE "public"."invoices_paymentmethod_enum_old"`);

    // --- messages.subject: gone
    await queryRunner.query(`ALTER TABLE "messages" DROP COLUMN "subject"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-added with a default so existing rows satisfy NOT NULL; the original
    // subjects are not recoverable, which is the cost of dropping the column.
    await queryRunner.query(`ALTER TABLE "messages" ADD "subject" character varying NOT NULL DEFAULT 'Message'`);
    await queryRunner.query(`ALTER TABLE "messages" ALTER COLUMN "subject" DROP DEFAULT`);

    // Rows already on CRYPTO have no equivalent in the narrower enum — they are
    // reset rather than allowed to fail the cast.
    await queryRunner.query(`UPDATE "invoices" SET "paymentMethod" = 'BANK_TRANSFER' WHERE "paymentMethod" = 'CRYPTO'`);
    await queryRunner.query(`ALTER TABLE "invoices" ALTER COLUMN "paymentMethod" DROP DEFAULT`);
    await queryRunner.query(`ALTER TYPE "public"."invoices_paymentmethod_enum" RENAME TO "invoices_paymentmethod_enum_new"`);
    await queryRunner.query(`CREATE TYPE "public"."invoices_paymentmethod_enum" AS ENUM('BANK_TRANSFER', 'PAYPAL')`);
    await queryRunner.query(
      `ALTER TABLE "invoices" ALTER COLUMN "paymentMethod" TYPE "public"."invoices_paymentmethod_enum" USING "paymentMethod"::text::"public"."invoices_paymentmethod_enum"`,
    );
    await queryRunner.query(`ALTER TABLE "invoices" ALTER COLUMN "paymentMethod" SET DEFAULT 'BANK_TRANSFER'`);
    await queryRunner.query(`DROP TYPE "public"."invoices_paymentmethod_enum_new"`);

    await queryRunner.query(`UPDATE "affiliates" SET "payoutMethod" = NULL WHERE "payoutMethod" = 'CRYPTO'`);
    await queryRunner.query(`ALTER TYPE "public"."affiliates_payoutmethod_enum" RENAME TO "affiliates_payoutmethod_enum_new"`);
    await queryRunner.query(`CREATE TYPE "public"."affiliates_payoutmethod_enum" AS ENUM('BANK_TRANSFER', 'PAYPAL')`);
    await queryRunner.query(
      `ALTER TABLE "affiliates" ALTER COLUMN "payoutMethod" TYPE "public"."affiliates_payoutmethod_enum" USING "payoutMethod"::text::"public"."affiliates_payoutmethod_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."affiliates_payoutmethod_enum_new"`);
  }
}
