import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Keeps the rest of what the proxy-detection provider answered, instead of one bit of it.
 *
 * IPHub returns seven fields per lookup — `block`, `isp`, `hostname`, `asn`,
 * `countryCode`, `countryName`, `ip` — and the click path kept `block === 1` and threw
 * the other six away. Unlike the GeoLite2 narrowing this mirrors, that waste was
 * metered: every one of those calls spends a slot out of a 1000/day free tier, so the
 * data was not merely available, it was already paid for.
 *
 * These are stored as the *provider's* reading, never merged into the MaxMind columns
 * beside them. `proxyAsnNumber` and `asnNumber` are two independent sources for the same
 * address, and holding both is only useful because they can disagree. Nothing here feeds
 * `riskScore`: a disagreement is far more often a local .mmdb that has gone stale than a
 * click worth punishing, and scoring it would turn an operational signal into a payout
 * decision.
 *
 * `proxyBlock` is the one that fixes a real gap rather than adding reach. IPHub's `block`
 * has three states and `isProxyOrVpn` is `block === 1`, so 2 — "non-residential", its
 * hedge — was stored identically to 0. The distinction existed in the provider's answer
 * and nowhere in our database.
 *
 * All nullable: every existing row predates this, and the cascade legitimately resolves
 * to nothing when the providers are unconfigured or spent.
 */
export class ClickProxyProviderDetail1789000000000 implements MigrationInterface {
  name = 'ClickProxyProviderDetail1789000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "clicks"
        ADD "proxyProvider" character varying,
        ADD "proxyBlock" smallint,
        ADD "proxyHostname" character varying,
        ADD "proxyIsp" character varying,
        ADD "proxyAsnNumber" integer,
        ADD "proxyCountryCode" character varying
    `);

    // The two that a fraud review actually filters a large table by: "show me every
    // click IPHub called non-residential", and "show me everything on this hostname"
    // — rDNS is how a single abusive host is found across many addresses.
    await queryRunner.query(`CREATE INDEX "IDX_clicks_proxyBlock" ON "clicks" ("proxyBlock")`);
    await queryRunner.query(`CREATE INDEX "IDX_clicks_proxyHostname" ON "clicks" ("proxyHostname")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_clicks_proxyHostname"`);
    await queryRunner.query(`DROP INDEX "IDX_clicks_proxyBlock"`);
    await queryRunner.query(`
      ALTER TABLE "clicks"
        DROP COLUMN "proxyCountryCode",
        DROP COLUMN "proxyAsnNumber",
        DROP COLUMN "proxyIsp",
        DROP COLUMN "proxyHostname",
        DROP COLUMN "proxyBlock",
        DROP COLUMN "proxyProvider"
    `);
  }
}
