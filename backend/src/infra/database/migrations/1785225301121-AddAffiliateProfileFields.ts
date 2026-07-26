import { MigrationInterface, QueryRunner } from 'typeorm';

// Adds the self-registration profile columns to the affiliates table. All nullable so
// the change is safe against rows created before this migration (e.g. the dev seed);
// the register flow always populates the required ones, enforced by the Zod schema.
export class AddAffiliateProfileFields1785225301121 implements MigrationInterface {
  name = 'AddAffiliateProfileFields1785225301121';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "affiliates" ADD "fullName" character varying(120)`);
    await queryRunner.query(`ALTER TABLE "affiliates" ADD "country" character varying(80)`);
    await queryRunner.query(`ALTER TABLE "affiliates" ADD "messengerType" character varying(20)`);
    await queryRunner.query(`ALTER TABLE "affiliates" ADD "messengerHandle" character varying(120)`);
    await queryRunner.query(`ALTER TABLE "affiliates" ADD "trafficSources" text`);
    await queryRunner.query(`ALTER TABLE "affiliates" ADD "websiteUrl" character varying(255)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "affiliates" DROP COLUMN "websiteUrl"`);
    await queryRunner.query(`ALTER TABLE "affiliates" DROP COLUMN "trafficSources"`);
    await queryRunner.query(`ALTER TABLE "affiliates" DROP COLUMN "messengerHandle"`);
    await queryRunner.query(`ALTER TABLE "affiliates" DROP COLUMN "messengerType"`);
    await queryRunner.query(`ALTER TABLE "affiliates" DROP COLUMN "country"`);
    await queryRunner.query(`ALTER TABLE "affiliates" DROP COLUMN "fullName"`);
  }
}
