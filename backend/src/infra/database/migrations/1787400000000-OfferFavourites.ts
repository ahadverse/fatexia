import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `offer_favourites` — an affiliate's own shortlist of offers.
 *
 * The browse list now shows the whole catalogue, gated offers included, so it is long
 * enough that an affiliate needs a way to mark the handful they actually work. This
 * grants nothing: it is a bookmark, not access, and no admin surface reads it.
 *
 * The unique pair is the point — bookmarking is a toggle, and a duplicate row would
 * make "is this bookmarked?" ambiguous. Un-bookmarking deletes the row rather than
 * flipping a flag, so there is no dead state to filter out of every query.
 */
export class OfferFavourites1787400000000 implements MigrationInterface {
  name = 'OfferFavourites1787400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "offer_favourites" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "offerId" uuid NOT NULL,
        "affiliateId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_offer_favourites" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_offer_favourites_offer_affiliate" UNIQUE ("offerId", "affiliateId")
      )
    `);
    // Every read is "this affiliate's bookmarks" — the browse list resolves the whole
    // set in one query rather than asking per row.
    await queryRunner.query(`CREATE INDEX "IDX_offer_favourites_affiliate" ON "offer_favourites" ("affiliateId")`);
    await queryRunner.query(`CREATE INDEX "IDX_offer_favourites_offer" ON "offer_favourites" ("offerId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_offer_favourites_offer"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_offer_favourites_affiliate"`);
    await queryRunner.query(`DROP TABLE "offer_favourites"`);
  }
}
