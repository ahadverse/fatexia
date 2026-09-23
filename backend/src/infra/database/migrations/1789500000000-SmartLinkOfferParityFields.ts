import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Brings a smart-link up to the same field set as an offer, minus the payout rules.
 *
 * A smart-link with no member offers is now a thing an affiliate is given and sends
 * traffic to on its own terms — so everything an offer says about itself, a link needs
 * to be able to say too: who the advertiser is, what the KPI is, when it runs, what
 * traffic is allowed, its own postback credentials, its caps.
 *
 * Two columns are deliberately nullable where the offer's equivalent is NOT NULL with
 * a default, because a default here would change how existing links already behave:
 *
 *   - `autoApproveConversions` — offer-less conversions are approved according to the
 *     network setting today. Defaulting it to false would start holding conversions
 *     that auto-approved yesterday, which is a money-visible change made by adding a
 *     column. Null means "use the network setting".
 *   - `advertiserId` — an offer always has one; a link may predate knowing it.
 *
 * No `startDate`, `endDate` or `currency`, though an offer has all three: a smart-link
 * is not scheduled, and its conversions are booked in the network currency. There is
 * nowhere in the form to set them, and a column nothing can write is worse than none.
 *
 * Payout is untouched. `revSharePercent` remains the only rate a smart-link has, and
 * no equivalent of `offers.defaultPayoutAmount` or of the payout-rule table is added.
 *
 * `smart_link_caps` is its own table rather than a nullable `smartLinkId` on
 * `offer_caps`, whose `offerId` is NOT NULL and whose every reader assumes an offer.
 * It CASCADEs on delete because a smart-link is genuinely deletable and its caps mean
 * nothing without it.
 */
export class SmartLinkOfferParityFields1789500000000 implements MigrationInterface {
  name = 'SmartLinkOfferParityFields1789500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "smart_links_trackingplatform_enum" AS ENUM('DIRECT', 'AFFISE', 'HASOFFERS', 'CAKE', 'OTHER')`,
    );

    await queryRunner.query(`ALTER TABLE "smart_links" ADD COLUMN "advertiserId" uuid`);
    await queryRunner.query(`ALTER TABLE "smart_links" ADD COLUMN "kpi" character varying`);
    await queryRunner.query(`ALTER TABLE "smart_links" ADD COLUMN "category" character varying`);
    await queryRunner.query(
      `ALTER TABLE "smart_links" ADD COLUMN "trackingPlatform" "smart_links_trackingplatform_enum" NOT NULL DEFAULT 'DIRECT'`,
    );
    await queryRunner.query(`ALTER TABLE "smart_links" ADD COLUMN "isPublic" boolean NOT NULL DEFAULT true`);
    await queryRunner.query(`ALTER TABLE "smart_links" ADD COLUMN "trafficTypes" jsonb NOT NULL DEFAULT '[]'`);
    await queryRunner.query(`ALTER TABLE "smart_links" ADD COLUMN "disallowedTrafficTypes" jsonb NOT NULL DEFAULT '[]'`);
    await queryRunner.query(`ALTER TABLE "smart_links" ADD COLUMN "featured" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "smart_links" ADD COLUMN "networkOfferId" character varying`);
    await queryRunner.query(`ALTER TABLE "smart_links" ADD COLUMN "autoApproveConversions" boolean`);
    await queryRunner.query(`ALTER TABLE "smart_links" ADD COLUMN "allowDeepLinking" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "smart_links" ADD COLUMN "remarksForAdmin" text`);
    await queryRunner.query(`ALTER TABLE "smart_links" ADD COLUMN "remarksForAffiliateManager" text`);
    await queryRunner.query(`ALTER TABLE "smart_links" ADD COLUMN "postbackSecret" character varying`);
    await queryRunner.query(`ALTER TABLE "smart_links" ADD COLUMN "allowedPostbackIps" character varying`);
    await queryRunner.query(`ALTER TABLE "smart_links" ADD COLUMN "postbackVerifiedAt" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "smart_links" ADD COLUMN "blockedRedirectUrl" character varying`);

    await queryRunner.query(`CREATE INDEX "IDX_smart_links_advertiserId" ON "smart_links" ("advertiserId")`);
    await queryRunner.query(
      `ALTER TABLE "smart_links" ADD CONSTRAINT "FK_smart_links_advertiserId" FOREIGN KEY ("advertiserId") REFERENCES "advertisers"("id") ON DELETE RESTRICT`,
    );

    await queryRunner.query(`CREATE TYPE "smart_link_caps_period_enum" AS ENUM('DAILY', 'WEEKLY', 'MONTHLY', 'OVERALL')`);
    await queryRunner.query(`CREATE TYPE "smart_link_caps_metric_enum" AS ENUM('CLICKS', 'CONVERSIONS', 'PAYOUT')`);
    await queryRunner.query(`
      CREATE TABLE "smart_link_caps" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "smartLinkId" uuid NOT NULL,
        "period" "smart_link_caps_period_enum" NOT NULL,
        "metric" "smart_link_caps_metric_enum" NOT NULL,
        "limit" numeric(12,2) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_smart_link_caps" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_smart_link_caps_smartLinkId" ON "smart_link_caps" ("smartLinkId")`);
    await queryRunner.query(
      `ALTER TABLE "smart_link_caps" ADD CONSTRAINT "FK_smart_link_caps_smartLinkId" FOREIGN KEY ("smartLinkId") REFERENCES "smart_links"("id") ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "smart_link_caps" DROP CONSTRAINT "FK_smart_link_caps_smartLinkId"`);
    await queryRunner.query(`DROP INDEX "IDX_smart_link_caps_smartLinkId"`);
    await queryRunner.query(`DROP TABLE "smart_link_caps"`);
    await queryRunner.query(`DROP TYPE "smart_link_caps_metric_enum"`);
    await queryRunner.query(`DROP TYPE "smart_link_caps_period_enum"`);

    await queryRunner.query(`ALTER TABLE "smart_links" DROP CONSTRAINT "FK_smart_links_advertiserId"`);
    await queryRunner.query(`DROP INDEX "IDX_smart_links_advertiserId"`);

    for (const column of [
      'blockedRedirectUrl',
      'postbackVerifiedAt',
      'allowedPostbackIps',
      'postbackSecret',
      'remarksForAffiliateManager',
      'remarksForAdmin',
      'allowDeepLinking',
      'autoApproveConversions',
      'networkOfferId',
      'featured',
      'disallowedTrafficTypes',
      'trafficTypes',
      'isPublic',
      'trackingPlatform',
      'category',
      'kpi',
      'advertiserId',
    ]) {
      await queryRunner.query(`ALTER TABLE "smart_links" DROP COLUMN "${column}"`);
    }

    await queryRunner.query(`DROP TYPE "smart_links_trackingplatform_enum"`);
  }
}
