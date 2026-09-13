import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Keeps everything the GeoLite2 lookup returns, instead of five fields of it.
 *
 * The City record carries the continent, the country's name, the country the block is
 * *registered* in, a second subdivision, the postcode, coordinates with an accuracy
 * radius, the IANA timezone and the US metro code — and the lookup reads that whole
 * record whatever we ask of it. Dropping the rest bought nothing: the same record is
 * decoded either way, so this is the difference between storing what we already know
 * and throwing it away.
 *
 * It has been narrowed twice before. The first version kept `country.iso_code` alone,
 * which is why no screen could show a city; the second added city and region and still
 * discarded the postcode and the coordinates.
 *
 * `asn` stays as it is — the datacenter filter keyword-matches that combined string —
 * and is joined by the number and organisation split apart, which is what a report can
 * group on.
 *
 * All nullable: every existing click row predates the wider lookup, and MaxMind itself
 * leaves most of these unset for any address it only resolves to a country.
 */
export class ClickFullGeoDetail1788000000000 implements MigrationInterface {
  name = 'ClickFullGeoDetail1788000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "clicks"
        ADD "countryName" character varying,
        ADD "registeredCountryCode" character varying,
        ADD "continentCode" character varying,
        ADD "continentName" character varying,
        ADD "cityGeonameId" integer,
        ADD "region2" character varying,
        ADD "region2Code" character varying,
        ADD "postalCode" character varying,
        ADD "latitude" numeric(8,4),
        ADD "longitude" numeric(8,4),
        ADD "accuracyRadiusKm" smallint,
        ADD "timeZone" character varying,
        ADD "metroCode" smallint,
        ADD "asnNumber" integer,
        ADD "asnOrganization" character varying,
        ADD "isAnonymousProxy" boolean,
        ADD "isSatelliteProvider" boolean
    `);

    // The city report already groups on the name; the postcode and ASN number are the
    // two new dimensions worth filtering a million-row table by.
    await queryRunner.query(`CREATE INDEX "IDX_clicks_postalCode" ON "clicks" ("postalCode")`);
    await queryRunner.query(`CREATE INDEX "IDX_clicks_asnNumber" ON "clicks" ("asnNumber")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_clicks_asnNumber"`);
    await queryRunner.query(`DROP INDEX "IDX_clicks_postalCode"`);
    await queryRunner.query(`
      ALTER TABLE "clicks"
        DROP COLUMN "isSatelliteProvider",
        DROP COLUMN "isAnonymousProxy",
        DROP COLUMN "asnOrganization",
        DROP COLUMN "asnNumber",
        DROP COLUMN "metroCode",
        DROP COLUMN "timeZone",
        DROP COLUMN "accuracyRadiusKm",
        DROP COLUMN "longitude",
        DROP COLUMN "latitude",
        DROP COLUMN "postalCode",
        DROP COLUMN "region2Code",
        DROP COLUMN "region2",
        DROP COLUMN "cityGeonameId",
        DROP COLUMN "continentName",
        DROP COLUMN "continentCode",
        DROP COLUMN "registeredCountryCode",
        DROP COLUMN "countryName"
    `);
  }
}
