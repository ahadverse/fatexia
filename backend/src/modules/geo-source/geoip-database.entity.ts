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
 */
@Entity('geoip_databases')
export class GeoipDatabase {
  /** The MaxMind edition id, e.g. `GeoLite2-City`. One row per edition. */
  @PrimaryColumn({ type: 'varchar', length: 64 })
  edition!: string;

  @Column({ type: 'bytea' })
  data!: Buffer;

  /** Size of the .mmdb once decompressed — what the admin panel reports. */
  @Column({ type: 'integer' })
  byteSize!: number;

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
