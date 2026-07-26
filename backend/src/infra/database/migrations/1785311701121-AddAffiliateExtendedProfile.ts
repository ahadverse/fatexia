import { MigrationInterface, QueryRunner } from 'typeorm';

// Second batch of self-registration profile columns (company, phone, verticals,
// monthly volume, referral source, notes). All nullable — safe on existing rows and
// all optional at the register step.
export class AddAffiliateExtendedProfile1785311701121 implements MigrationInterface {
  name = 'AddAffiliateExtendedProfile1785311701121';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "affiliates" ADD "companyName" character varying(120)`);
    await queryRunner.query(`ALTER TABLE "affiliates" ADD "phone" character varying(40)`);
    await queryRunner.query(`ALTER TABLE "affiliates" ADD "verticals" text`);
    await queryRunner.query(`ALTER TABLE "affiliates" ADD "monthlyVolume" character varying(40)`);
    await queryRunner.query(`ALTER TABLE "affiliates" ADD "referralSource" character varying(60)`);
    await queryRunner.query(`ALTER TABLE "affiliates" ADD "notes" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "affiliates" DROP COLUMN "notes"`);
    await queryRunner.query(`ALTER TABLE "affiliates" DROP COLUMN "referralSource"`);
    await queryRunner.query(`ALTER TABLE "affiliates" DROP COLUMN "monthlyVolume"`);
    await queryRunner.query(`ALTER TABLE "affiliates" DROP COLUMN "verticals"`);
    await queryRunner.query(`ALTER TABLE "affiliates" DROP COLUMN "phone"`);
    await queryRunner.query(`ALTER TABLE "affiliates" DROP COLUMN "companyName"`);
  }
}
