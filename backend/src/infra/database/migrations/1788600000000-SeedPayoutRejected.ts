import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seeds the `PAYOUT_REJECTED` template row.
 *
 * `prod-bootstrap` only creates templates that are missing, and it is not part of the
 * deploy command — so a new template reaches an existing database through a migration
 * or not at all.
 *
 * Id computed with seed/ids.ts `emailTemplate('PAYOUT_REJECTED')`, which is a SHA-1
 * formatted as a v5-shaped UUID and not what Postgres' uuid_generate_v5 produces — so
 * it is written literally, and a later `seed:prod` sees this as the same row.
 */
export class SeedPayoutRejected1788600000000 implements MigrationInterface {
  name = 'SeedPayoutRejected1788600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "email_templates" ("id", "templateKey", "name", "subject", "body", "availableMacros", "enabled")
       VALUES (
         '712ed219-c45e-51ff-9b20-86e7b78af282',
         'PAYOUT_REJECTED',
         'Payout rejected',
         'Payment {invoice_number} could not be processed',
         $1,
         $2,
         true
       )
       ON CONFLICT ("templateKey") DO NOTHING`,
      [
        'Hi {affiliate_name},\n\nWe were not able to process this payout.\n\nReason: {decision_note}\n\nNothing has been lost — the conversions on this invoice go back to your balance and will be picked up on the next run once this is sorted.',
        JSON.stringify(['{affiliate_name}', '{invoice_number}', '{amount}', '{period}', '{decision_note}']),
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "email_templates" WHERE "templateKey" = 'PAYOUT_REJECTED'`);
  }
}
