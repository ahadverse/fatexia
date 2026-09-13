import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Splits the stored GeoLite2 blobs into one row per chunk, because the single-row
 * version was quietly eating the whole database plan.
 *
 * `geoip_databases` held the gzipped .mmdb in one `bytea`, written a megabyte at a time
 * with `UPDATE ... SET data = data || $chunk`. Chunking there was for *memory* — a 29MB
 * blob arrives from node-postgres as ~58MB of hex text before it is a Buffer — and it
 * worked. But Postgres rewrites an entire row on every UPDATE and TOAST carries the blob
 * along with it, so appending in a loop is quadratic in storage: 29 one-megabyte
 * appends leave 1+2+…+29 ≈ 435MB of dead tuples from a single fetch. Autovacuum had
 * never run on the table, so nothing reclaimed them. On 2026-09-13 `geoip_databases`
 * was 490MB for 29MB of live data and filled the plan; `VACUUM FULL` brought it back to
 * 40MB.
 *
 * Chunking for memory and chunking for storage are opposite designs if the second one
 * is done by appending. So the blob now lives in `geoip_database_chunks`, keyed
 * `(edition, chunkIndex)`: a fetch INSERTs its chunks and DELETEs the previous set, and
 * the dead weight from one fetch is one copy of the file rather than thirty.
 *
 * The existing blobs are carried across rather than dropped — losing them would cost an
 * admin a fresh 74MB download from MaxMind, which is the exact thing this table exists
 * to avoid. `geoip_databases` is then rebuilt as metadata only. Rebuilt, not
 * `DROP COLUMN`: dropping a column is a catalogue edit, so the old TOAST data would sit
 * on disk until someone ran another `VACUUM FULL`. Dropping the table unlinks it at
 * commit, which is the whole point of this migration.
 */
export class GeoipChunkedStorage1787900000000 implements MigrationInterface {
  name = 'GeoipChunkedStorage1787900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "geoip_database_chunks" (
        "edition" character varying(64) NOT NULL,
        "chunkIndex" integer NOT NULL,
        "data" bytea NOT NULL,
        CONSTRAINT "PK_geoip_database_chunks" PRIMARY KEY ("edition", "chunkIndex")
      )
    `);

    // Split at the same 1MB boundary the writer used, so a carried-over blob is
    // indistinguishable from a freshly stored one.
    await queryRunner.query(`
      INSERT INTO "geoip_database_chunks" ("edition", "chunkIndex", "data")
      SELECT d."edition", s.i, substring(d."data" from s.i * 1048576 + 1 for 1048576)
      FROM "geoip_databases" d,
           generate_series(0, (octet_length(d."data") - 1) / 1048576) AS s(i)
      WHERE octet_length(d."data") > 0
    `);

    // The PK index shares a namespace with the old table's, so it is created under a
    // temporary name and renamed once the original is gone.
    await queryRunner.query(`
      CREATE TABLE "geoip_databases_next" (
        "edition" character varying(64) NOT NULL,
        "byteSize" integer NOT NULL,
        "chunkCount" integer NOT NULL DEFAULT 0,
        "checksum" character varying(64),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_geoip_databases_next" PRIMARY KEY ("edition")
      )
    `);

    await queryRunner.query(`
      INSERT INTO "geoip_databases_next" ("edition", "byteSize", "chunkCount", "checksum", "updatedAt")
      SELECT d."edition",
             d."byteSize",
             CASE WHEN octet_length(d."data") = 0 THEN 0 ELSE (octet_length(d."data") - 1) / 1048576 + 1 END,
             d."checksum",
             d."updatedAt"
      FROM "geoip_databases" d
    `);

    await queryRunner.query(`DROP TABLE "geoip_databases"`);
    await queryRunner.query(`ALTER TABLE "geoip_databases_next" RENAME TO "geoip_databases"`);
    await queryRunner.query(`ALTER INDEX "PK_geoip_databases_next" RENAME TO "PK_geoip_databases"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "geoip_databases_prev" (
        "edition" character varying(64) NOT NULL,
        "data" bytea NOT NULL,
        "byteSize" integer NOT NULL,
        "checksum" character varying(64),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_geoip_databases_prev" PRIMARY KEY ("edition")
      )
    `);

    await queryRunner.query(`
      INSERT INTO "geoip_databases_prev" ("edition", "data", "byteSize", "checksum", "updatedAt")
      SELECT d."edition",
             COALESCE(
               (SELECT string_agg(c."data", ''::bytea ORDER BY c."chunkIndex")
                FROM "geoip_database_chunks" c
                WHERE c."edition" = d."edition"),
               ''::bytea
             ),
             d."byteSize",
             d."checksum",
             d."updatedAt"
      FROM "geoip_databases" d
    `);

    await queryRunner.query(`DROP TABLE "geoip_databases"`);
    await queryRunner.query(`ALTER TABLE "geoip_databases_prev" RENAME TO "geoip_databases"`);
    await queryRunner.query(`ALTER INDEX "PK_geoip_databases_prev" RENAME TO "PK_geoip_databases"`);
    await queryRunner.query(`DROP TABLE "geoip_database_chunks"`);
  }
}
