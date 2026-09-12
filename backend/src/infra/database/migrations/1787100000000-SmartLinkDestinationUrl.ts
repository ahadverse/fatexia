import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `smart_links.destinationUrl` — an optional override for where a matched click lands.
 *
 * A smart-link normally has no destination of its own: the rotation picks a member
 * offer and the click goes to that offer's `destinationUrl`. This lets a network send
 * rotator traffic somewhere of its own instead, while the member offer is still chosen,
 * logged and paid against — so attribution is unchanged and only the address differs.
 *
 * Nullable, and null is the default behaviour every existing link already has.
 */
export class SmartLinkDestinationUrl1787100000000 implements MigrationInterface {
  name = 'SmartLinkDestinationUrl1787100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "smart_links" ADD "destinationUrl" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "smart_links" DROP COLUMN "destinationUrl"`);
  }
}
