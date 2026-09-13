import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * A GeoLite2 database, kept in Postgres so it survives a restart.
 *
 * The Tracker reads geo data from `.mmdb` files on its own filesystem, and on the free
 * plan that filesystem is ephemeral: the service sleeps after ~15 minutes idle and
 * wakes as a fresh container with the files gone. The old answer was for an admin to
 * press "fetch" again, which meant re-downloading ~80MB from MaxMind several times a
 * day and eventually being rate-limited (HTTP 429) — leaving geo lookups degraded for
 * the rest of the day.
 *
 * So the download is stored here as well as on disk, and the Tracker restores the files
 * from this table at boot. MaxMind is then contacted only when someone actually wants
 * fresher data, not every time Render recycles the container.
 *
 * The bytes are gzipped: the City database is around 70MB raw and roughly half that
 * compressed, which matters on a database plan measured in hundreds of megabytes.
 *
 * This row is metadata only. The bytes themselves are in `GeoipDatabaseChunk`, for the
 * storage reason documented there.
 */
@Entity('geoip_databases')
export class GeoipDatabase {
  /** The MaxMind edition id, e.g. `GeoLite2-City`. One row per edition. */
  @PrimaryColumn({ type: 'varchar', length: 64 })
  edition!: string;

  /** Size of the .mmdb once decompressed — what the admin panel reports. */
  @Column({ type: 'integer' })
  byteSize!: number;

  /**
   * How many chunk rows make up this edition, written only once they are all in.
   *
   * So it doubles as the "did the upload finish" flag: zero means an upload started and
   * stopped, and the restore treats that the same as never having fetched — better than
   * reassembling whatever fraction landed.
   */
  @Column({ type: 'integer', default: 0 })
  chunkCount!: number;

  /**
   * SHA-256 of the uncompressed .mmdb, checked after every restore.
   *
   * The blob moves in chunks in both directions, and either loop can stop half-way. A
   * truncated database that still parses is the dangerous outcome — it answers lookups,
   * wrongly, until someone notices. Null only for rows stored before this existed.
   */
  @Column({ type: 'varchar', length: 64, nullable: true })
  checksum!: string | null;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}

/**
 * One megabyte of a gzipped GeoLite2 database.
 *
 * Split into rows rather than kept as a single `bytea` for a storage reason, not a
 * memory one. The writer has always moved the file a chunk at a time — node-postgres
 * decodes `bytea` from the wire as hex, so handling a 29MB blob whole costs well over a
 * hundred megabytes of peak allocation on a 512MB instance — but the first version did
 * it with `UPDATE ... SET data = data || $chunk`. Postgres rewrites the whole row on
 * every UPDATE and TOAST comes with it, so 29 appends left ~435MB of dead tuples from
 * one fetch; with autovacuum never having run, the table reached 490MB for 29MB of live
 * data and filled the plan.
 *
 * Inserting a row per chunk and deleting the previous set costs one dead copy per
 * refresh instead of thirty. See `infra/geoip/geoip-store.ts`.
 */
@Entity('geoip_database_chunks')
export class GeoipDatabaseChunk {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  edition!: string;

  /** Zero-based position in the gzip stream. Only the whole ordered run is valid gzip. */
  @PrimaryColumn({ type: 'integer' })
  chunkIndex!: number;

  @Column({ type: 'bytea' })
  data!: Buffer;
}
