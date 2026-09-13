import { createHash } from 'node:crypto';
import { createGunzip, createGzip } from 'node:zlib';
import { createReadStream, createWriteStream, existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { AppDataSource } from '../database/data-source';
import { env } from '../../common/env';
import { logger } from '../../common/logger';

/**
 * The database copy of the GeoLite2 files — what makes a restart survivable.
 *
 * The Tracker's filesystem does not persist (free plan, sleeps when idle, wakes as a
 * fresh container). Keeping a copy in Postgres means a wake-up restores geo data from
 * our own database in a second or two, instead of an admin noticing hours later and
 * triggering another 74MB download that MaxMind may well refuse with a 429.
 *
 * Everything here moves bytes in chunks, never whole files.
 *
 * That is not tidiness. The City database is 63MB, and the first version of this
 * buffered it whole: node-postgres decodes `bytea` from the wire as a hex string, so a
 * 31MB compressed blob arrived as ~62MB of text, became a 31MB Buffer, and then
 * `gunzipSync` allocated another 63MB — well over a hundred megabytes of peak
 * allocation, on a 512MB instance, in the boot path before the server was listening. A
 * Tracker that cannot boot serves no clicks at all, which is a far worse failure than
 * the missing geo data this exists to prevent.
 *
 * Reading with `substring` and writing with `||` keeps the peak at roughly one chunk,
 * and needs no schema change: the blob stays one row, it is simply never handled whole.
 *
 * Disk remains the read path — `maxmind.open()` wants a file, and the click hot path
 * should never touch Postgres.
 */

// Deliberately small. node-postgres decodes `bytea` from the wire as hex, so a chunk
// costs roughly twice its size in transient string before it is a Buffer at all — and
// this runs on a 512MB instance that is also holding ~75MB of open databases. A 31MB
// blob is ~31 round trips at this size, which takes about a second once, at boot.
const CHUNK_BYTES = 1024 * 1024;

function pathFor(edition: string): string {
  return join(env.GEOIP_DB_DIR, `${edition}.mmdb`);
}

/** Scratch for the compressed copy on its way to Postgres. Never renamed, so anywhere
 *  writable will do, and the system temp directory keeps it out of the data folder. */
function compressScratch(edition: string): string {
  return join(tmpdir(), `geoip-${edition}-${process.pid}-${Date.now()}.gz`);
}

/**
 * Scratch for a restore, deliberately beside the file it will become.
 *
 * The restore finishes with a rename, which is what makes it atomic — the readers
 * never see a half-written database. A rename only works within one filesystem, and
 * `os.tmpdir()` is routinely on a different one (it is on Windows, and can be in a
 * container), where it fails with EXDEV. Same directory, same filesystem, real rename.
 */
function restoreScratch(edition: string): string {
  return join(env.GEOIP_DB_DIR, `.${edition}.${process.pid}.partial`);
}

/**
 * Copies a freshly downloaded .mmdb into Postgres.
 *
 * Compressed to a scratch file first, then appended a chunk at a time, so neither the
 * 63MB original nor its 31MB compressed form is ever held whole.
 *
 * Failure is logged, not thrown: the file is already on disk and working at this point,
 * so a database hiccup should cost the next restart's convenience, not the download the
 * admin just waited for.
 */
export async function saveGeoipDatabase(edition: string): Promise<void> {
  const source = pathFor(edition);
  if (!existsSync(source)) return;

  const compressed = compressScratch(edition);

  try {
    const byteSize = statSync(source).size;

    // Hashed on the way past, so verifying costs one read of the file rather than two.
    const hash = createHash('sha256');
    await pipeline(
      createReadStream(source),
      async function* (chunks: AsyncIterable<Buffer>) {
        for await (const chunk of chunks) {
          hash.update(chunk);
          yield chunk;
        }
      },
      createGzip(),
      createWriteStream(compressed),
    );
    const checksum = hash.digest('hex');

    // Replaced rather than updated in place: a half-appended blob from a failed run
    // must not be mistaken for a complete one, and starting from empty makes the
    // append loop below the only thing that can produce a valid row.
    //
    // The checksum is written last, once the bytes are all there — so a row that has
    // one is a row that finished, and an interrupted upload is visibly unfinished
    // rather than quietly wrong.
    await AppDataSource.query(`DELETE FROM geoip_databases WHERE edition = $1`, [edition]);
    await AppDataSource.query(
      `INSERT INTO geoip_databases (edition, data, "byteSize", checksum, "updatedAt") VALUES ($1, ''::bytea, $2, NULL, now())`,
      [edition, byteSize],
    );

    const expected = statSync(compressed).size;
    let appended = 0;
    for await (const chunk of createReadStream(compressed, { highWaterMark: CHUNK_BYTES })) {
      await AppDataSource.query(`UPDATE geoip_databases SET data = data || $1 WHERE edition = $2`, [chunk, edition]);
      appended += (chunk as Buffer).byteLength;
    }

    // What Postgres actually holds, not what we believe we sent. A short blob here
    // means a chunk was lost, and the row is dropped rather than left to fail every
    // restore from now on while the admin page reports a successful download.
    const [stored]: { len: string }[] = await AppDataSource.query(
      `SELECT octet_length(data) AS len FROM geoip_databases WHERE edition = $1`,
      [edition],
    );
    if (!stored || Number(stored.len) !== expected || appended !== expected) {
      await AppDataSource.query(`DELETE FROM geoip_databases WHERE edition = $1`, [edition]);
      throw new Error(`stored ${stored?.len ?? 0} of ${expected} bytes — discarded the incomplete copy`);
    }

    await AppDataSource.query(`UPDATE geoip_databases SET checksum = $1 WHERE edition = $2`, [checksum, edition]);

    logger.info(
      `[geoip] stored ${edition} in the database (${Math.round(byteSize / 1048576)}MB raw, ${Math.round(expected / 1048576)}MB compressed, sha256 ${checksum.slice(0, 12)}…)`,
    );
  } catch (err) {
    logger.warn({ err, edition }, '[geoip] could not store the database copy — a restart will need a fresh download');
  } finally {
    rmSync(compressed, { force: true });
  }
}

/**
 * Streams one edition out of Postgres and back onto disk.
 *
 * Written to a scratch file and renamed into place, so a failure part-way through
 * cannot leave a truncated .mmdb where the readers expect a valid database — that
 * would be worse than no file at all, which they already handle.
 */
async function restoreOne(edition: string): Promise<boolean> {
  const rows: { len: string; updatedAt: Date; byteSize: number; checksum: string | null }[] = await AppDataSource.query(
    `SELECT octet_length(data) AS len, "updatedAt", "byteSize", checksum FROM geoip_databases WHERE edition = $1`,
    [edition],
  );
  const row = rows[0];
  if (!row) return false;

  const total = Number(row.len);
  if (total === 0) return false;

  const scratch = restoreScratch(edition);

  // The chunks are slices of one gzip stream, so they are pushed through a single
  // gunzip rather than decompressed individually — only the whole sequence is valid
  // compressed data.
  const source = Readable.from(
    (async function* () {
      for (let offset = 0; offset < total; offset += CHUNK_BYTES) {
        // Postgres substring is 1-indexed.
        const slice: { chunk: Buffer }[] = await AppDataSource.query(
          `SELECT substring(data from $2 for $3) AS chunk FROM geoip_databases WHERE edition = $1`,
          [edition, offset + 1, CHUNK_BYTES],
        );
        const chunk = slice[0]?.chunk;
        if (chunk?.length) yield chunk;
      }
    })(),
  );

  const hash = createHash('sha256');
  let written = 0;

  try {
    // gunzip validates its own CRC and length trailer, so a truncated or damaged blob
    // fails here rather than producing a short file. The hash and byte count below
    // cover what gzip cannot: bytes that decompress cleanly but are not what was
    // uploaded.
    await pipeline(
      source,
      createGunzip(),
      async function* (chunks: AsyncIterable<Buffer>) {
        for await (const chunk of chunks) {
          hash.update(chunk);
          written += chunk.byteLength;
          yield chunk;
        }
      },
      createWriteStream(scratch),
    );

    if (written !== row.byteSize) {
      throw new Error(`decompressed to ${written} bytes, expected ${row.byteSize}`);
    }

    const digest = hash.digest('hex');
    if (row.checksum && digest !== row.checksum) {
      throw new Error(`checksum mismatch (${digest.slice(0, 12)}… vs ${row.checksum.slice(0, 12)}…)`);
    }

    // Renamed only once every check has passed, and only from the same directory, so
    // the readers either see the previous file or a verified one — never a partial.
    renameSync(scratch, pathFor(edition));
    logger.info(
      `[geoip] restored ${edition} from the database (stored ${row.updatedAt.toISOString()}, ${row.checksum ? 'checksum verified' : 'no checksum on record'})`,
    );
    return true;
  } catch (err) {
    rmSync(scratch, { force: true });
    throw err;
  }
}

/**
 * Puts the .mmdb files back on disk from Postgres, for editions that are missing.
 *
 * An edition already on disk is left alone — the file is the newer of the two whenever
 * an admin has just fetched, and rewriting it would be pure work.
 *
 * Never throws, and each edition is attempted independently: ASN is a fifth the size of
 * City, so a failure on the big one should not cost the small one too. Geo data is
 * enrichment — click.service.ts records a click and redirects with or without it — so
 * nothing here may stop the Tracker from serving traffic.
 */
export async function restoreGeoipDatabases(editions: readonly string[]): Promise<void> {
  const missing = editions.filter((edition) => !existsSync(pathFor(edition)));
  if (missing.length === 0) return;

  try {
    mkdirSync(env.GEOIP_DB_DIR, { recursive: true });
  } catch (err) {
    logger.warn({ err }, '[geoip] could not create the database directory — geo/ASN degrade to unknown');
    return;
  }

  for (const edition of missing) {
    try {
      const restored = await restoreOne(edition);
      if (!restored) {
        logger.info(`[geoip] ${edition} is not on disk and has never been fetched — lookups degrade until an admin fetches it`);
      }
    } catch (err) {
      logger.warn({ err, edition }, '[geoip] could not restore this database — its lookups degrade to unknown');
    }
  }
}

/** When each edition was last downloaded from MaxMind, per the stored copy. */
export async function storedGeoipDates(editions: readonly string[]): Promise<Map<string, string>> {
  try {
    // Deliberately never selects `data` — this runs on every status poll, and reading
    // the blob to report a timestamp would pull tens of megabytes through for nothing.
    const rows: { edition: string; updatedAt: Date }[] = await AppDataSource.query(
      `SELECT edition, "updatedAt" FROM geoip_databases`,
    );
    return new Map(rows.filter((row) => editions.includes(row.edition)).map((row) => [row.edition, row.updatedAt.toISOString()]));
  } catch (err) {
    logger.warn({ err }, '[geoip] could not read stored database metadata');
    return new Map();
  }
}

/** Whether the file is on disk right now, and how big it is. */
export function diskStatus(edition: string): { present: boolean; updatedAt: string | null } {
  const path = pathFor(edition);
  if (!existsSync(path)) return { present: false, updatedAt: null };
  return { present: true, updatedAt: statSync(path).mtime.toISOString() };
}
