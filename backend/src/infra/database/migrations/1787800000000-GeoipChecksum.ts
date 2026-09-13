import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A checksum on the stored GeoLite2 copies, so a damaged one is caught rather than used.
 *
 * The blob is written to Postgres a chunk at a time and read back the same way. Both
 * loops can stop half-way — a dropped connection mid-upload, a restart mid-restore —
 * and the failure mode that matters is the quiet one: a truncated database that still
 * parses far enough to answer lookups, wrongly, for weeks.
 *
 * gzip's own CRC already catches most corruption on the way out. This catches the rest,
 * and covers the upload direction too: `checksum` is the SHA-256 of the *uncompressed*
 * .mmdb, so what is verified is the thing the readers will actually open.
 *
 * Nullable because rows written before this column existed have no checksum to compare
 * against. Those are restored as before and re-checksummed on the next fetch — refusing
 * to restore them instead would turn "unverified" into "no geo data at all", which is
 * the worse of the two.
 */
export class GeoipChecksum1787800000000 implements MigrationInterface {
  name = 'GeoipChecksum1787800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "geoip_databases" ADD "checksum" character varying(64)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "geoip_databases" DROP COLUMN "checksum"`);
  }
}
