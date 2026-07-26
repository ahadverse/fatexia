import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Where BLOCKED traffic goes becomes configurable.
 *
 * The tracker hardcoded `https://www.google.com` as the destination for any click
 * scored BLOCKED. Diverting that traffic is right — sending known-bad clicks to the
 * advertiser is how you lose the advertiser — but the address itself is a business
 * decision, not a constant, and some advertisers require rejected traffic to land on
 * their own "offer unavailable" page.
 *
 * Two levels, both nullable so existing rows keep the built-in default:
 *   offers.blockedRedirectUrl   — per-offer override
 *   network_settings.blockedRedirectUrl — network-wide default
 */
export class ConfigurableBlockedRedirect1785800000000 implements MigrationInterface {
  name = 'ConfigurableBlockedRedirect1785800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "network_settings" ADD "blockedRedirectUrl" character varying`);
    await queryRunner.query(`ALTER TABLE "offers" ADD "blockedRedirectUrl" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "offers" DROP COLUMN "blockedRedirectUrl"`);
    await queryRunner.query(`ALTER TABLE "network_settings" DROP COLUMN "blockedRedirectUrl"`);
  }
}
