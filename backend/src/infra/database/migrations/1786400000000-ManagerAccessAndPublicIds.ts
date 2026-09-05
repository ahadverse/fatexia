import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Three issues that all land on the affiliate/manager relationship:
 *
 * #21 — human-readable, sequential account ids (`AFF-1001`, `MAN-1001`). Backed by a
 * real Postgres sequence rather than `MAX(publicId) + 1`: two concurrent registrations
 * reading the same max would mint the same id, and the unique index would then reject
 * one of them at random. `nextval` is atomic and never reuses a number, which is
 * exactly the "very unique and sequential" property asked for. Existing rows are
 * backfilled in signup order so the oldest affiliate is AFF-1001, and the sequence is
 * then set past the backfill so the next signup continues the run.
 *
 * #20 — `managers.permissions` (jsonb). Empty object = "no extra permissions"; admin
 * ticks capabilities on per manager (see manager.entity.ts's MANAGER_PERMISSION_KEYS).
 * Not a separate table: it's a fixed, small key set read on nearly every manager
 * request, so it belongs on the row it describes.
 *
 * #1 — AFFILIATE_REJECTED joins the template enum, so rejecting an application sends
 * an email like approving and suspending already do. Same recreate-the-type dance the
 * earlier enum migrations use, because `ALTER TYPE ... ADD VALUE` cannot be followed by
 * an INSERT using that value inside one transaction.
 */
export class ManagerAccessAndPublicIds1786400000000 implements MigrationInterface {
  name = 'ManagerAccessAndPublicIds1786400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- #21 public ids -----------------------------------------------------
    await queryRunner.query(`CREATE SEQUENCE "affiliate_public_id_seq" START WITH 1001 INCREMENT BY 1`);
    await queryRunner.query(`CREATE SEQUENCE "manager_public_id_seq" START WITH 1001 INCREMENT BY 1`);

    await queryRunner.query(`ALTER TABLE "affiliates" ADD "publicId" character varying(20)`);
    await queryRunner.query(`ALTER TABLE "managers" ADD "publicId" character varying(20)`);

    await queryRunner.query(`
      UPDATE "affiliates" AS a
      SET "publicId" = 'AFF-' || numbered.n
      FROM (SELECT id, 1000 + ROW_NUMBER() OVER (ORDER BY "createdAt", id) AS n FROM "affiliates") AS numbered
      WHERE a.id = numbered.id
    `);
    await queryRunner.query(`
      UPDATE "managers" AS m
      SET "publicId" = 'MAN-' || numbered.n
      FROM (SELECT id, 1000 + ROW_NUMBER() OVER (ORDER BY "createdAt", id) AS n FROM "managers") AS numbered
      WHERE m.id = numbered.id
    `);

    // `true` = "this value has been used", so the next nextval() is one past the
    // backfill rather than colliding with its last row.
    await queryRunner.query(`SELECT setval('affiliate_public_id_seq', 1000 + (SELECT COUNT(*) FROM "affiliates"), true)`);
    await queryRunner.query(`SELECT setval('manager_public_id_seq', 1000 + (SELECT COUNT(*) FROM "managers"), true)`);

    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_affiliates_publicId" ON "affiliates" ("publicId")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_managers_publicId" ON "managers" ("publicId")`);

    // --- #20 per-manager permissions ---------------------------------------
    await queryRunner.query(`ALTER TABLE "managers" ADD "permissions" jsonb NOT NULL DEFAULT '{}'`);

    // Existing managers keep working exactly as before this migration: they had the
    // full ADMIN-shared surface, so granting the same set here is the no-change
    // default. New managers start with nothing ticked.
    await queryRunner.query(`
      UPDATE "managers" SET "permissions" = '{
        "affiliates.view": true, "affiliates.create": true, "affiliates.edit": true,
        "affiliates.approve": true, "affiliates.suspend": true, "affiliates.reject": true,
        "affiliates.payout": true, "affiliates.impersonate": true,
        "offers.view": true, "offers.create": true, "offers.edit": true,
        "advertisers.manage": true, "reports.view": true, "messages.send": true
      }'::jsonb
    `);

    // --- #1 rejection email -------------------------------------------------
    await queryRunner.query(`ALTER TYPE "public"."email_templates_templatekey_enum" RENAME TO "email_templates_templatekey_enum_old"`);
    await queryRunner.query(
      `CREATE TYPE "public"."email_templates_templatekey_enum" AS ENUM('AFFILIATE_WELCOME', 'PASSWORD_RESET', 'ACCESS_REQUEST_APPROVED', 'ACCESS_REQUEST_REJECTED', 'AFFILIATE_APPROVED', 'AFFILIATE_REJECTED', 'AFFILIATE_SUSPENDED', 'PAYOUT_SENT', 'OFFER_LIVE')`,
    );
    await queryRunner.query(
      `ALTER TABLE "email_templates" ALTER COLUMN "templateKey" TYPE "public"."email_templates_templatekey_enum" USING "templateKey"::text::"public"."email_templates_templatekey_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."email_templates_templatekey_enum_old"`);

    // ON CONFLICT so re-running against a database whose seed already inserted it is
    // a no-op rather than a unique-violation failure.
    await queryRunner.query(`
      INSERT INTO "email_templates" ("templateKey", "name", "subject", "body", "availableMacros", "enabled")
      VALUES (
        'AFFILIATE_REJECTED',
        'Application declined',
        'Update on your {network_name} application',
        $$Hi {affiliate_name},

Thanks for your interest in {network_name}. After reviewing your application we are not able to approve an account for you at this time.

This is not always final — traffic sources and volumes change, and you are welcome to apply again later or reply to this email if you would like to talk it through.

— The {network_name} team$$,
        '["{affiliate_name}", "{network_name}", "{support_email}"]'::jsonb,
        true
      )
      ON CONFLICT ("templateKey") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "email_templates" WHERE "templateKey" = 'AFFILIATE_REJECTED'`);
    await queryRunner.query(`ALTER TYPE "public"."email_templates_templatekey_enum" RENAME TO "email_templates_templatekey_enum_new"`);
    await queryRunner.query(
      `CREATE TYPE "public"."email_templates_templatekey_enum" AS ENUM('AFFILIATE_WELCOME', 'PASSWORD_RESET', 'ACCESS_REQUEST_APPROVED', 'ACCESS_REQUEST_REJECTED', 'AFFILIATE_APPROVED', 'AFFILIATE_SUSPENDED', 'PAYOUT_SENT', 'OFFER_LIVE')`,
    );
    await queryRunner.query(
      `ALTER TABLE "email_templates" ALTER COLUMN "templateKey" TYPE "public"."email_templates_templatekey_enum" USING "templateKey"::text::"public"."email_templates_templatekey_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."email_templates_templatekey_enum_new"`);

    await queryRunner.query(`ALTER TABLE "managers" DROP COLUMN "permissions"`);

    await queryRunner.query(`DROP INDEX "public"."UQ_managers_publicId"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_affiliates_publicId"`);
    await queryRunner.query(`ALTER TABLE "managers" DROP COLUMN "publicId"`);
    await queryRunner.query(`ALTER TABLE "affiliates" DROP COLUMN "publicId"`);
    await queryRunner.query(`DROP SEQUENCE "manager_public_id_seq"`);
    await queryRunner.query(`DROP SEQUENCE "affiliate_public_id_seq"`);
  }
}
