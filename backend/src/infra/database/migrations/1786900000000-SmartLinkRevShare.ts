import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Revenue share on smart-links.
 *
 * `smart_links.revShareMode` / `revSharePercent` — when set, a conversion that came
 * through the link pays the affiliate that percentage of what the advertiser pays,
 * instead of the flat payout on the member offer's own rule.
 *
 * `clicks.smartLinkId` — the part that makes the above possible at all. The rotation
 * resolves a smart-link click to one member offer and, until now, threw the link away;
 * a conversion arriving days later had no way back to it. Indexed because the payout
 * path looks it up per conversion.
 *
 * All three nullable: every existing link and click predates this, and a link with no
 * share configured keeps using the offer's rule.
 */
export class SmartLinkRevShare1786900000000 implements MigrationInterface {
  name = 'SmartLinkRevShare1786900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "smart_links" ADD "revShareMode" character varying(10)`);
    await queryRunner.query(`ALTER TABLE "smart_links" ADD "revSharePercent" numeric(5,2)`);
    await queryRunner.query(`ALTER TABLE "clicks" ADD "smartLinkId" uuid`);
    await queryRunner.query(`CREATE INDEX "IDX_clicks_smartLinkId" ON "clicks" ("smartLinkId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_clicks_smartLinkId"`);
    await queryRunner.query(`ALTER TABLE "clicks" DROP COLUMN "smartLinkId"`);
    await queryRunner.query(`ALTER TABLE "smart_links" DROP COLUMN "revSharePercent"`);
    await queryRunner.query(`ALTER TABLE "smart_links" DROP COLUMN "revShareMode"`);
  }
}
