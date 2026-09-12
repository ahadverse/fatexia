import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `network_settings.supportTeams` — the network's Microsoft Teams address.
 *
 * Completes the support-desk contact set alongside `supportEmail` and
 * `supportTelegram`. The affiliate portal's contact card already renders a Teams button
 * for an assigned manager who has one; affiliates with no manager fall back to the
 * support desk, which had no Teams field to render from.
 *
 * Nullable: a network that doesn't use Teams leaves it unset and the card omits the
 * button, exactly as it does for an unset telegram or phone.
 */
export class NetworkSupportTeams1787000000000 implements MigrationInterface {
  name = 'NetworkSupportTeams1787000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "network_settings" ADD "supportTeams" character varying(255)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "network_settings" DROP COLUMN "supportTeams"`);
  }
}
