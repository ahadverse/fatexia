import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Teams is the network's single contact channel, addressed at support@fatexia.com for
 * every manager and for the support-desk fallback. Fills the setting only where it is
 * unset so an address an admin already entered is kept.
 */
export class SupportTeamsDefault1789800000000 implements MigrationInterface {
  name = 'SupportTeamsDefault1789800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "network_settings" SET "supportTeams" = 'support@fatexia.com' WHERE "supportTeams" IS NULL OR "supportTeams" = ''`,
    );
  }

  public async down(): Promise<void> {
    // Not reversible: the previous (unset) value is not recorded, and clearing it would
    // also wipe addresses entered by hand.
  }
}
