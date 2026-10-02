import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Admin-managed advertiser platforms and the click-id / payout tokens their postbacks
 * use, plus the offer's optional pointer at one. SET NULL on delete: removing a network
 * must not take its offers' postback setup with it, they just fall back to the generic
 * macros.
 */
export class AdvertiserNetworks1789700000000 implements MigrationInterface {
  name = 'AdvertiserNetworks1789700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "advertiser_networks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "clickIdToken" character varying NOT NULL, "payoutToken" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_advertiser_networks_name" UNIQUE ("name"), CONSTRAINT "PK_advertiser_networks_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`ALTER TABLE "offers" ADD "advertiserNetworkId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "offers" ADD CONSTRAINT "FK_offers_advertiserNetworkId" FOREIGN KEY ("advertiserNetworkId") REFERENCES "advertiser_networks"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "offers" DROP CONSTRAINT "FK_offers_advertiserNetworkId"`);
    await queryRunner.query(`ALTER TABLE "offers" DROP COLUMN "advertiserNetworkId"`);
    await queryRunner.query(`DROP TABLE "advertiser_networks"`);
  }
}
