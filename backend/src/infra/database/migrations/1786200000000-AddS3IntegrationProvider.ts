import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds S3 as an integration provider (issue #18 — offer thumbnail upload). Same
 * recreate-the-type dance as CryptoPayoutsAndDropMessageSubject1785500000000: Postgres
 * refuses `ALTER TYPE ... ADD VALUE` inside a transaction, and TypeORM runs every
 * migration in one.
 */
export class AddS3IntegrationProvider1786200000000 implements MigrationInterface {
  name = 'AddS3IntegrationProvider1786200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "public"."integrations_provider_enum" RENAME TO "integrations_provider_enum_old"`);
    await queryRunner.query(
      `CREATE TYPE "public"."integrations_provider_enum" AS ENUM('IPHUB', 'IPAPI_IS', 'IPQS', 'MAXMIND', 'SMTP', 'PAYPAL', 'WISE', 'S3')`,
    );
    await queryRunner.query(
      `ALTER TABLE "integrations" ALTER COLUMN "provider" TYPE "public"."integrations_provider_enum" USING "provider"::text::"public"."integrations_provider_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."integrations_provider_enum_old"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "integrations" WHERE "provider" = 'S3'`);
    await queryRunner.query(`ALTER TYPE "public"."integrations_provider_enum" RENAME TO "integrations_provider_enum_new"`);
    await queryRunner.query(`CREATE TYPE "public"."integrations_provider_enum" AS ENUM('IPHUB', 'IPAPI_IS', 'IPQS', 'MAXMIND', 'SMTP', 'PAYPAL', 'WISE')`);
    await queryRunner.query(
      `ALTER TABLE "integrations" ALTER COLUMN "provider" TYPE "public"."integrations_provider_enum" USING "provider"::text::"public"."integrations_provider_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."integrations_provider_enum_new"`);
  }
}
