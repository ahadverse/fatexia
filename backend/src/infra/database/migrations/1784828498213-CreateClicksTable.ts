import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateClicksTable1784828498213 implements MigrationInterface {
    name = 'CreateClicksTable1784828498213'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."clicks_qualitystatus_enum" AS ENUM('GOOD', 'SUSPECT', 'BLOCKED', 'UNSCORED')`);
        await queryRunner.query(`CREATE TABLE "clicks" ("id" uuid NOT NULL, "offerId" uuid NOT NULL, "affiliateId" uuid, "ip" character varying NOT NULL, "userAgent" character varying, "countryCode" character varying, "deviceType" character varying, "os" character varying, "browser" character varying, "asn" character varying, "isDatacenter" boolean NOT NULL DEFAULT false, "isProxyOrVpn" boolean, "riskScore" smallint NOT NULL DEFAULT '0', "qualityStatus" "public"."clicks_qualitystatus_enum" NOT NULL DEFAULT 'UNSCORED', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7765d7ffdeb0ed2675651020814" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_460f7b27b64b092a273c6f5753" ON "clicks" ("offerId") `);
        await queryRunner.query(`CREATE INDEX "IDX_365c00add665898183d069a312" ON "clicks" ("affiliateId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6f944344e22b36f7f0a5a1d2de" ON "clicks" ("createdAt") `);
        await queryRunner.query(`ALTER TABLE "payout_rules" ALTER COLUMN "revenueAmount" SET DEFAULT '0.00'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payout_rules" ALTER COLUMN "revenueAmount" SET DEFAULT 0.00`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6f944344e22b36f7f0a5a1d2de"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_365c00add665898183d069a312"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_460f7b27b64b092a273c6f5753"`);
        await queryRunner.query(`DROP TABLE "clicks"`);
        await queryRunner.query(`DROP TYPE "public"."clicks_qualitystatus_enum"`);
    }

}
