import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `offers.disallowedTrafficTypes` — the sources an affiliate may NOT send.
 *
 * The offer already carried `trafficTypes`, a flat list the details page labelled
 * "Traffic Allowed". There was no way to state the opposite, so an offer that forbids
 * incentivised or email traffic had to say so in free-text remarks the portal does not
 * surface — which is how an affiliate sends traffic that gets their conversions voided.
 *
 * A second list rather than a flag per entry: "allowed" and "forbidden" are different
 * statements, and a source in neither list means the offer has not said either way.
 */
export class OfferDisallowedTrafficTypes1787200000000 implements MigrationInterface {
  name = 'OfferDisallowedTrafficTypes1787200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "offers" ADD "disallowedTrafficTypes" jsonb NOT NULL DEFAULT '[]'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "offers" DROP COLUMN "disallowedTrafficTypes"`);
  }
}
