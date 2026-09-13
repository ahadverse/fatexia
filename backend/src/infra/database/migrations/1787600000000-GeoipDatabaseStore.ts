import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `geoip_databases` — the GeoLite2 files, kept somewhere that survives a restart.
 *
 * The Tracker runs on an ephemeral filesystem: it sleeps when idle and wakes as a new
 * container with `GEOIP_DB_DIR` empty. Geo and ASN lookups then degraded to unknown
 * until an admin noticed and pressed "fetch", which re-downloaded ~80MB from MaxMind —
 * several times a day, until MaxMind started answering 429 and the day's remaining
 * attempts were spent.
 *
 * Storing the download here breaks that loop: the Tracker restores the files from this
 * table at boot (see infra/geoip/geoip-store.ts), and MaxMind is contacted only when
 * someone actually wants newer data.
 *
 * One row per edition, keyed by MaxMind's own edition id, holding the gzipped .mmdb.
 * Gzipped because the City database is around 70MB raw — roughly half that compressed,
 * which is the difference between comfortable and careless on a small database plan.
 */
export class GeoipDatabaseStore1787600000000 implements MigrationInterface {
  name = 'GeoipDatabaseStore1787600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "geoip_databases" (
        "edition" character varying(64) NOT NULL,
        "data" bytea NOT NULL,
        "byteSize" integer NOT NULL,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_geoip_databases" PRIMARY KEY ("edition")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "geoip_databases"`);
  }
}
