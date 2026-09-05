import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Issue #15 — click-time geo/device/OS targeting + a fallback destination — and
 * issue #12's RPS revenue model, landing together since both are the same payout/
 * targeting redesign pass.
 *
 * `offers.fallbackUrl`: where a click goes when it matches none of the offer's payout
 * rules (nullable — null means "use destinationUrl", so an offer with no targeting
 * configured keeps behaving exactly as it did before).
 *
 * `payout_rules.targeting` (jsonb) backfilled with an `os: []` key on every existing
 * row. Not strictly required — every reader treats a missing key as `os ?? []` — but
 * doing it once here means the column's shape is consistent for anyone querying the
 * jsonb directly, rather than only correct through the application layer.
 *
 * `payout_rules.revenueModel` gains RPS (Revenue Per Sale) alongside RPA/RPC — same
 * recreate-the-type dance as CryptoPayoutsAndDropMessageSubject1785500000000, since
 * Postgres refuses ALTER TYPE ... ADD VALUE inside a transaction.
 */
export class OfferFallbackUrlAndTargetingOs1786300000000 implements MigrationInterface {
  name = 'OfferFallbackUrlAndTargetingOs1786300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "offers" ADD "fallbackUrl" character varying`);
    await queryRunner.query(`UPDATE "payout_rules" SET "targeting" = jsonb_set("targeting", '{os}', '[]'::jsonb) WHERE NOT ("targeting" ? 'os')`);

    await queryRunner.query(`ALTER TABLE "payout_rules" ALTER COLUMN "revenueModel" DROP DEFAULT`);
    await queryRunner.query(`ALTER TYPE "public"."payout_rules_revenuemodel_enum" RENAME TO "payout_rules_revenuemodel_enum_old"`);
    await queryRunner.query(`CREATE TYPE "public"."payout_rules_revenuemodel_enum" AS ENUM('RPA', 'RPC', 'RPS', 'NONE')`);
    await queryRunner.query(
      `ALTER TABLE "payout_rules" ALTER COLUMN "revenueModel" TYPE "public"."payout_rules_revenuemodel_enum" USING "revenueModel"::text::"public"."payout_rules_revenuemodel_enum"`,
    );
    await queryRunner.query(`ALTER TABLE "payout_rules" ALTER COLUMN "revenueModel" SET DEFAULT 'NONE'`);
    await queryRunner.query(`DROP TYPE "public"."payout_rules_revenuemodel_enum_old"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "payout_rules" SET "revenueModel" = 'NONE' WHERE "revenueModel" = 'RPS'`);
    await queryRunner.query(`ALTER TABLE "payout_rules" ALTER COLUMN "revenueModel" DROP DEFAULT`);
    await queryRunner.query(`ALTER TYPE "public"."payout_rules_revenuemodel_enum" RENAME TO "payout_rules_revenuemodel_enum_new"`);
    await queryRunner.query(`CREATE TYPE "public"."payout_rules_revenuemodel_enum" AS ENUM('RPA', 'RPC', 'NONE')`);
    await queryRunner.query(
      `ALTER TABLE "payout_rules" ALTER COLUMN "revenueModel" TYPE "public"."payout_rules_revenuemodel_enum" USING "revenueModel"::text::"public"."payout_rules_revenuemodel_enum"`,
    );
    await queryRunner.query(`ALTER TABLE "payout_rules" ALTER COLUMN "revenueModel" SET DEFAULT 'NONE'`);
    await queryRunner.query(`DROP TYPE "public"."payout_rules_revenuemodel_enum_new"`);

    await queryRunner.query(`UPDATE "payout_rules" SET "targeting" = "targeting" - 'os'`);
    await queryRunner.query(`ALTER TABLE "offers" DROP COLUMN "fallbackUrl"`);
  }
}
