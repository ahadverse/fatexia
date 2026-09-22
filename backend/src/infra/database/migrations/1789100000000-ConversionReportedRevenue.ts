import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Records the sale value an advertiser reports on a postback.
 *
 * `/postback` now accepts `sum` (alias `revenue`): the revenue the advertiser is paying
 * for this particular conversion. It becomes the base that the offer's own percentage —
 * or a smart-link's revenue share — is applied to, replacing `PayoutRule.revenueAmount`,
 * which was one configured number standing in for every sale on the offer. A revenue
 * share paid identically on a 5.00 order and a 500.00 one, which made it unusable on any
 * real CPS offer.
 *
 * This column is the reported figure held verbatim, not the priced one. `revenueAmount`
 * remains what the conversion was actually valued at, and the two diverge whenever the
 * report was ignored — absent, zero, or a duplicate carrying no money. Keeping both is
 * what makes a postback-priced conversion distinguishable from a rule-priced one after
 * the fact; collapsing them would leave no record that an outside number was involved.
 *
 * Nullable with no default, and deliberately not backfilled: every existing row was
 * priced from the rule, and writing 0 would be a claim that an advertiser reported a
 * zero-value sale. Null means "nothing was reported", which is the truth for all of them.
 *
 * No index. It is read on a conversion already fetched by id and shown in the admin
 * drawer; nothing filters or groups a large table by it.
 */
export class ConversionReportedRevenue1789100000000 implements MigrationInterface {
  name = 'ConversionReportedRevenue1789100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "conversions" ADD "reportedRevenue" numeric(12,2)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "conversions" DROP COLUMN "reportedRevenue"`);
  }
}
