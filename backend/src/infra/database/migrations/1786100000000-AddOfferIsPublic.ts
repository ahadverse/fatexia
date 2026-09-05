import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Public vs. gated offers (issue #19).
 *
 * Until now every offer behaved as effectively public — findAvailableForAffiliate
 * returned all APPROVED offers regardless of the offer_access_requests table, which
 * only ever drove the UI's "Request Access" affordance, not real visibility. This adds
 * a real gate: isPublic defaults true (existing offers keep behaving exactly as
 * before), and an admin can flip an offer to gated so it only appears for an affiliate
 * once they have an APPROVED access request for it.
 */
export class AddOfferIsPublic1786100000000 implements MigrationInterface {
  name = 'AddOfferIsPublic1786100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "offers" ADD "isPublic" boolean NOT NULL DEFAULT true`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "offers" DROP COLUMN "isPublic"`);
  }
}
