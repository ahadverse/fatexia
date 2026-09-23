import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lets a click and a conversion exist without an offer.
 *
 * A smart-link with no member offers used to be a dead end: it redirected and nothing
 * else. No click row could be written, because `clicks.offerId` was NOT NULL and there
 * was no offer to name; no conversion could follow, because `/postback` resolves an
 * offer before it does anything and 404s without one.
 *
 * That stopped being the only sensible shape once the postback began carrying the sale's
 * revenue. The two things a payout needs are a rate and an amount: the amount now comes
 * from the advertiser's `sum`, and for these links the rate comes from the smart-link's
 * own `revSharePercent`. Neither has to come from an offer, so requiring one was the
 * schema enforcing an assumption that no longer holds.
 *
 * Nullable, not defaulted. There is no "unknown offer" row to point at, and inventing a
 * placeholder would put a fake offer into every report that groups by one. Null means
 * exactly what it says: this click was not sold against an offer, it was sold against a
 * link. `smartLinkId` on the click is what carries the attribution instead, which is why
 * it is indexed already.
 *
 * Every existing row keeps its offer — nothing is rewritten, and the offer-based path is
 * untouched. What changes is only that a new row is allowed to omit it.
 *
 * Reporting note: the grouped reports inner-join `offers`, so offer-less conversions are
 * absent from offer-grouped views rather than appearing under a blank offer. That is the
 * correct reading of them — they have no offer — but affiliate- and date-grouped totals
 * do include them, so the two will not reconcile against each other for a network using
 * these links. See PROGRESS.md.
 *
 * `down` cannot restore NOT NULL while such rows exist, so it deletes nothing and simply
 * fails if any are present — losing a paid conversion to a schema rollback would be far
 * worse than a failed migration.
 */
export class OfferlessSmartLinkConversions1789300000000 implements MigrationInterface {
  name = 'OfferlessSmartLinkConversions1789300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "clicks" ALTER COLUMN "offerId" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "conversions" ALTER COLUMN "offerId" DROP NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Deliberately unguarded: if an offer-less row exists, this throws rather than
    // deleting it. A rollback is not a reason to lose a conversion someone was paid for.
    await queryRunner.query(`ALTER TABLE "conversions" ALTER COLUMN "offerId" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "clicks" ALTER COLUMN "offerId" SET NOT NULL`);
  }
}
