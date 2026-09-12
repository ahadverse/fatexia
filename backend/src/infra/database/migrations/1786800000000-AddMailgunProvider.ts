import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `network_settings.emailProvider` — which mail relay `sendEmail` uses.
 *
 * Mailgun's own credentials are env (MAILGUN_*), so there is no integration row and no
 * enum value to add; this column is only the choice between the two relays. The enabled
 * flag on the Brevo row cannot express it: with both relays configured it answers
 * "these credentials are valid", not "send through this one".
 *
 * A plain varchar, not a Postgres enum — adding a third relay later should not need a
 * type-recreate migration. Defaults to BREVO so an existing deployment keeps sending
 * through the relay it is already configured for.
 */
export class AddMailgunProvider1786800000000 implements MigrationInterface {
  name = 'AddMailgunProvider1786800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "network_settings" ADD "emailProvider" character varying(20) NOT NULL DEFAULT 'BREVO'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "network_settings" DROP COLUMN "emailProvider"`);
  }
}
