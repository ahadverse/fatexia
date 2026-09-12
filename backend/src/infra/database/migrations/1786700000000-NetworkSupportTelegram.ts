import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `network_settings.supportTelegram` — the network's own Telegram handle.
 *
 * The affiliate portal's contact card (issue #6) already renders a Telegram button when
 * the contact has a handle, but only a *manager* could ever have one. Affiliates with
 * no assigned manager — the majority — fall back to the support desk, which is built
 * from network settings, and those had no Telegram field at all.
 *
 * Nullable: a network that doesn't use Telegram leaves it unset and the card simply
 * omits the button, the same as it already does for an unset skype or phone.
 */
export class NetworkSupportTelegram1786700000000 implements MigrationInterface {
  name = 'NetworkSupportTelegram1786700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "network_settings" ADD "supportTelegram" character varying(120)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "network_settings" DROP COLUMN "supportTelegram"`);
  }
}
