import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Three related widenings of the traffic tables.
 *
 * 1. **City-level geo.** `GeoLite2-City.mmdb` was already open and already being read;
 *    the code just discarded everything except the country code, so no screen could
 *    show a city. These columns give it somewhere to land.
 * 2. **`isUnique`.** Decided at click-write time (clicks/unique-click.ts) rather than
 *    derived at read time, so the per-row Yes/No badge and the aggregate `uniqueClicks`
 *    report metric share one definition instead of two that can disagree.
 * 3. **Sub-IDs 4–8**, on both clicks and conversions.
 *
 * Every new column is nullable or defaulted, so this is safe against the existing rows.
 */
export class AddClickGeoUniqueAndSubIds1785600000000 implements MigrationInterface {
  name = 'AddClickGeoUniqueAndSubIds1785600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- geo + device detail
    await queryRunner.query(`ALTER TABLE "clicks" ADD "city" character varying`);
    await queryRunner.query(`ALTER TABLE "clicks" ADD "region" character varying`);
    await queryRunner.query(`ALTER TABLE "clicks" ADD "regionCode" character varying`);
    await queryRunner.query(`ALTER TABLE "clicks" ADD "deviceBrand" character varying`);
    await queryRunner.query(`ALTER TABLE "clicks" ADD "osVersion" character varying`);
    await queryRunner.query(`ALTER TABLE "clicks" ADD "browserVersion" character varying`);

    // --- unique flag
    await queryRunner.query(`ALTER TABLE "clicks" ADD "isUnique" boolean NOT NULL DEFAULT false`);

    // --- sub-ids 4..8 on both traffic tables
    for (const n of [4, 5, 6, 7, 8]) {
      await queryRunner.query(`ALTER TABLE "clicks" ADD "subId${n}" character varying`);
      await queryRunner.query(`ALTER TABLE "conversions" ADD "subId${n}" character varying`);
    }

    // Supports the unique-click fallback lookup (offer + ip within a window) when Redis
    // is unavailable, and the click log's country filter.
    await queryRunner.query(`CREATE INDEX "IDX_clicks_offer_ip_created" ON "clicks" ("offerId", "ip", "createdAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_clicks_country" ON "clicks" ("countryCode")`);

    // Backfill: mark the earliest click per (offer, ip) as unique. This ignores the 24h
    // window the runtime rule uses — over historical data that would need a per-row
    // window function, and "first ever" is the right approximation for rows that will
    // never be recomputed.
    await queryRunner.query(`
      UPDATE "clicks" c SET "isUnique" = true
      FROM (
        SELECT DISTINCT ON ("offerId", "ip") id
        FROM "clicks"
        ORDER BY "offerId", "ip", "createdAt"
      ) first_clicks
      WHERE c.id = first_clicks.id
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_clicks_country"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_clicks_offer_ip_created"`);

    for (const n of [8, 7, 6, 5, 4]) {
      await queryRunner.query(`ALTER TABLE "conversions" DROP COLUMN "subId${n}"`);
      await queryRunner.query(`ALTER TABLE "clicks" DROP COLUMN "subId${n}"`);
    }

    await queryRunner.query(`ALTER TABLE "clicks" DROP COLUMN "isUnique"`);
    await queryRunner.query(`ALTER TABLE "clicks" DROP COLUMN "browserVersion"`);
    await queryRunner.query(`ALTER TABLE "clicks" DROP COLUMN "osVersion"`);
    await queryRunner.query(`ALTER TABLE "clicks" DROP COLUMN "deviceBrand"`);
    await queryRunner.query(`ALTER TABLE "clicks" DROP COLUMN "regionCode"`);
    await queryRunner.query(`ALTER TABLE "clicks" DROP COLUMN "region"`);
    await queryRunner.query(`ALTER TABLE "clicks" DROP COLUMN "city"`);
  }
}
