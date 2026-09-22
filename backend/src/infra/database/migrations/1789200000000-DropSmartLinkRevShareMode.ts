import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Drops `smart_links.revShareMode`.
 *
 * It held 'CPA' or 'CPS' and was read by nothing. `computeAmounts` takes only
 * `revSharePercent`; the mode never reached pricing, filtering or reporting. The admin
 * form nonetheless disabled the percentage input until a mode was picked, so every
 * operator made a choice that changed no behaviour — the same shape of trap as a
 * revenue share on a link with no member offers.
 *
 * Removed rather than wired up because the distinction is not real here: a revenue share
 * is a percentage of a sale, which is CPS by definition. The offer-level schema already
 * refuses a PERCENTAGE payout outside CPS mode (`offer.dto.ts`), so giving 'CPA' a
 * meaning at link level would contradict the rule one layer down.
 *
 * Dropping loses whatever was stored. That is the intent: the column's values never
 * affected a payout, so there is nothing to preserve, and leaving it would keep it
 * available to be read by mistake later. `down` restores the column but not its
 * contents — it cannot, and a null mode is what every row would have meant anyway.
 */
export class DropSmartLinkRevShareMode1789200000000 implements MigrationInterface {
  name = 'DropSmartLinkRevShareMode1789200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "smart_links" DROP COLUMN IF EXISTS "revShareMode"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "smart_links" ADD "revShareMode" character varying(10)`);
  }
}
