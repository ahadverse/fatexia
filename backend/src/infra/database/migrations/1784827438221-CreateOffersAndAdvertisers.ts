import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateOffersAndAdvertisers1784827438221 implements MigrationInterface {
    name = 'CreateOffersAndAdvertisers1784827438221'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "advertisers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a0618516584bd6609576d6a9ff5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "offer_categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_39aa831b9f7ccd805ad0d08860d" UNIQUE ("name"), CONSTRAINT "PK_322eecf6e1305ba79864e86e28c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."payout_rules_payoutmode_enum" AS ENUM('CPA', 'CPC', 'CPL', 'CPI', 'CPS')`);
        await queryRunner.query(`CREATE TYPE "public"."payout_rules_payouttype_enum" AS ENUM('FLAT', 'PERCENTAGE')`);
        await queryRunner.query(`CREATE TYPE "public"."payout_rules_revenuemodel_enum" AS ENUM('RPA', 'RPC', 'NONE')`);
        await queryRunner.query(`CREATE TABLE "payout_rules" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "offerId" uuid NOT NULL, "payoutMode" "public"."payout_rules_payoutmode_enum" NOT NULL, "payoutType" "public"."payout_rules_payouttype_enum" NOT NULL, "amount" numeric(12,2) NOT NULL, "revenueModel" "public"."payout_rules_revenuemodel_enum" NOT NULL DEFAULT 'NONE', "revenueAmount" numeric(12,2) NOT NULL DEFAULT '0.00', "targeting" jsonb NOT NULL, "managerCommissionPercent" smallint NOT NULL DEFAULT '0', "referAffiliateCommissionPercent" smallint NOT NULL DEFAULT '0', "holdEnabled" boolean NOT NULL DEFAULT false, "holdDays" smallint NOT NULL DEFAULT '0', "commissionPercent" smallint NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_46bd4ecfe51a0586ca02cc9dd34" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_5b40c009490807c8a3c11446cf" ON "payout_rules" ("offerId") `);
        await queryRunner.query(`CREATE TYPE "public"."offer_caps_period_enum" AS ENUM('DAILY', 'WEEKLY', 'MONTHLY', 'OVERALL')`);
        await queryRunner.query(`CREATE TYPE "public"."offer_caps_metric_enum" AS ENUM('CLICKS', 'CONVERSIONS', 'PAYOUT')`);
        await queryRunner.query(`CREATE TABLE "offer_caps" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "offerId" uuid NOT NULL, "period" "public"."offer_caps_period_enum" NOT NULL, "metric" "public"."offer_caps_metric_enum" NOT NULL, "limit" numeric(12,2) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_98385ba02307e431b7dd642b50e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c6b91ea096e885fe5c4cb267c8" ON "offer_caps" ("offerId") `);
        await queryRunner.query(`CREATE TYPE "public"."offers_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DELETED')`);
        await queryRunner.query(`CREATE TYPE "public"."offers_trackingplatform_enum" AS ENUM('DIRECT', 'AFFISE', 'HASOFFERS', 'CAKE', 'OTHER')`);
        await queryRunner.query(`CREATE TABLE "offers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "advertiserId" uuid NOT NULL, "name" character varying NOT NULL, "previewLink" character varying, "description" text, "kpi" character varying, "category" character varying, "iconUrl" character varying, "startDate" TIMESTAMP, "endDate" TIMESTAMP, "defaultPayoutAmount" numeric(12,2) NOT NULL, "currency" character varying NOT NULL DEFAULT 'USD', "status" "public"."offers_status_enum" NOT NULL DEFAULT 'PENDING', "trackingPlatform" "public"."offers_trackingplatform_enum" NOT NULL DEFAULT 'DIRECT', "trafficTypes" jsonb NOT NULL DEFAULT '[]', "featured" boolean NOT NULL DEFAULT false, "networkOfferId" character varying, "autoApproveConversions" boolean NOT NULL DEFAULT false, "allowDeepLinking" boolean NOT NULL DEFAULT false, "remarksForAdmin" text, "remarksForAffiliateManager" text, "destinationUrl" character varying, "postbackSecret" character varying, "allowedPostbackIps" character varying, "postbackVerifiedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4c88e956195bba85977da21b8f4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c0a4e54a7e16e648b466ffa1fa" ON "offers" ("advertiserId") `);
        await queryRunner.query(`ALTER TABLE "payout_rules" ADD CONSTRAINT "FK_5b40c009490807c8a3c11446cf6" FOREIGN KEY ("offerId") REFERENCES "offers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "offer_caps" ADD CONSTRAINT "FK_c6b91ea096e885fe5c4cb267c81" FOREIGN KEY ("offerId") REFERENCES "offers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "offers" ADD CONSTRAINT "FK_c0a4e54a7e16e648b466ffa1fa2" FOREIGN KEY ("advertiserId") REFERENCES "advertisers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "offers" DROP CONSTRAINT "FK_c0a4e54a7e16e648b466ffa1fa2"`);
        await queryRunner.query(`ALTER TABLE "offer_caps" DROP CONSTRAINT "FK_c6b91ea096e885fe5c4cb267c81"`);
        await queryRunner.query(`ALTER TABLE "payout_rules" DROP CONSTRAINT "FK_5b40c009490807c8a3c11446cf6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c0a4e54a7e16e648b466ffa1fa"`);
        await queryRunner.query(`DROP TABLE "offers"`);
        await queryRunner.query(`DROP TYPE "public"."offers_trackingplatform_enum"`);
        await queryRunner.query(`DROP TYPE "public"."offers_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c6b91ea096e885fe5c4cb267c8"`);
        await queryRunner.query(`DROP TABLE "offer_caps"`);
        await queryRunner.query(`DROP TYPE "public"."offer_caps_metric_enum"`);
        await queryRunner.query(`DROP TYPE "public"."offer_caps_period_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5b40c009490807c8a3c11446cf"`);
        await queryRunner.query(`DROP TABLE "payout_rules"`);
        await queryRunner.query(`DROP TYPE "public"."payout_rules_revenuemodel_enum"`);
        await queryRunner.query(`DROP TYPE "public"."payout_rules_payouttype_enum"`);
        await queryRunner.query(`DROP TYPE "public"."payout_rules_payoutmode_enum"`);
        await queryRunner.query(`DROP TABLE "offer_categories"`);
        await queryRunner.query(`DROP TABLE "advertisers"`);
    }

}
