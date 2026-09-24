import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Extra tokens some advertiser tracking platforms carry on their postback (their own
 * macro picker's token names, lowercased on our side: timestamp, ip, campaign/program/
 * site/network name, device type, etc.) — opaque, display/audit only, one column each
 * like the existing `transactionId`. Never consulted by pricing; see
 * payout-resolution.ts's computeAmounts and PLAN-backend.md's money integrity rule.
 *
 * `reportedCountryCode`/`reportedDeviceType` are kept separate from the existing
 * `countryCode` column, which is Fatexia's own click-time detection — same
 * reported-vs-computed split `reportedRevenue` already uses against `revenueAmount`.
 */
export class ConversionPostbackTokens1789600000000 implements MigrationInterface {
  name = 'ConversionPostbackTokens1789600000000';

  private static readonly COLUMNS: [string, string][] = [
    ['timestamp', 'character varying'],
    ['ip', 'character varying'],
    ['atlasCode', 'character varying'],
    ['customParameters', 'character varying(2000)'],
    ['conversionId', 'character varying'],
    ['conversionType', 'character varying'],
    ['affiliateUsername', 'character varying'],
    ['networkName', 'character varying'],
    ['siteName', 'character varying'],
    ['programName', 'character varying'],
    ['campaignName', 'character varying'],
    ['reportedCountryCode', 'character varying'],
    ['reportedDeviceType', 'character varying'],
    ['commissionAmount', 'character varying'],
    ['userAgent', 'character varying'],
    ['prepaidTransactions', 'character varying'],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [column, type] of ConversionPostbackTokens1789600000000.COLUMNS) {
      await queryRunner.query(`ALTER TABLE "conversions" ADD COLUMN "${column}" ${type}`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [column] of [...ConversionPostbackTokens1789600000000.COLUMNS].reverse()) {
      await queryRunner.query(`ALTER TABLE "conversions" DROP COLUMN "${column}"`);
    }
  }
}
