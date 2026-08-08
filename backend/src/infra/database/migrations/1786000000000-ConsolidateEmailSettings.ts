import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Collapses the email setup to the two fields that are actually used.
 *
 * Transactional mail goes out through Brevo's HTTP API (infra/email/brevo-mailer.ts),
 * not an SMTP relay, so `smtpHost`/`smtpPort`/`smtpUser` were never read by anything —
 * they rendered as editable inputs on the Settings page that silently did nothing.
 * `smtpFromEmail` was the one live field and is renamed to match how it's used;
 * `senderName` is new (the sender's display name previously borrowed `networkName`,
 * which meant it couldn't be set independently).
 */
export class ConsolidateEmailSettings1786000000000 implements MigrationInterface {
  name = 'ConsolidateEmailSettings1786000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "network_settings" RENAME COLUMN "smtpFromEmail" TO "senderEmail"`);
    await queryRunner.query(`ALTER TABLE "network_settings" ADD "senderName" character varying`);
    await queryRunner.query(`ALTER TABLE "network_settings" DROP COLUMN "smtpHost"`);
    await queryRunner.query(`ALTER TABLE "network_settings" DROP COLUMN "smtpPort"`);
    await queryRunner.query(`ALTER TABLE "network_settings" DROP COLUMN "smtpUser"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "network_settings" ADD "smtpUser" character varying`);
    await queryRunner.query(`ALTER TABLE "network_settings" ADD "smtpPort" integer`);
    await queryRunner.query(`ALTER TABLE "network_settings" ADD "smtpHost" character varying`);
    await queryRunner.query(`ALTER TABLE "network_settings" DROP COLUMN "senderName"`);
    await queryRunner.query(`ALTER TABLE "network_settings" RENAME COLUMN "senderEmail" TO "smtpFromEmail"`);
  }
}
