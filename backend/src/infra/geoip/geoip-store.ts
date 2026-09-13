import { gunzipSync, gzipSync } from 'node:zlib';
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { AppDataSource } from '../database/data-source';
import { GeoipDatabase } from '../../modules/geo-source/geoip-database.entity';
import { env } from '../../common/env';
import { logger } from '../../common/logger';

/**
 * The database copy of the GeoLite2 files — what makes a restart survivable.
 *
 * The Tracker's filesystem does not persist (free plan, sleeps when idle, wakes as a
 * fresh container). Keeping a copy in Postgres means a wake-up restores geo data from
 * our own database in a second or two, instead of an admin noticing hours later and
 * triggering another 80MB download that MaxMind may well refuse with a 429.
 *
 * Disk stays the read path: `maxmind.open()` wants a file, and the click hot path
 * should never touch Postgres. This module only moves bytes between the two.
 */

function pathFor(edition: string): string {
  return join(env.GEOIP_DB_DIR, `${edition}.mmdb`);
}

/**
 * Copies a freshly downloaded .mmdb into Postgres.
 *
 * Failure is logged, not thrown: the file is already on disk and working at this point,
 * so a database hiccup should cost the next restart's convenience, not the download the
 * admin just waited for.
 */
export async function saveGeoipDatabase(edition: string): Promise<void> {
  const source = pathFor(edition);
  if (!existsSync(source)) return;

  try {
    const raw = readFileSync(source);
    const repository = AppDataSource.getRepository(GeoipDatabase);
    await repository.save({ edition, data: gzipSync(raw), byteSize: raw.byteLength });
    logger.info(`[geoip] stored ${edition} in the database (${Math.round(raw.byteLength / 1024 / 1024)}MB)`);
  } catch (err) {
    logger.warn({ err, edition }, '[geoip] could not store the database copy — a restart will need a fresh download');
  }
}

/**
 * Puts the .mmdb files back on disk from Postgres, for editions that are missing.
 *
 * Called at Tracker boot, before the readers open. An edition already on disk is left
 * alone — the file is the newer of the two whenever an admin has just fetched, and
 * rewriting it would be pure work.
 *
 * Never throws. Geo data is enrichment: click.service.ts records a click and redirects
 * with or without it, so a database that is slow or unreachable at boot must not stop
 * the Tracker from serving traffic.
 */
export async function restoreGeoipDatabases(editions: readonly string[]): Promise<void> {
  const missing = editions.filter((edition) => !existsSync(pathFor(edition)));
  if (missing.length === 0) return;

  try {
    const repository = AppDataSource.getRepository(GeoipDatabase);
    mkdirSync(env.GEOIP_DB_DIR, { recursive: true });

    for (const edition of missing) {
      const row = await repository.findOne({ where: { edition } });
      if (!row) {
        logger.info(`[geoip] ${edition} is not on disk and has never been fetched — lookups degrade until an admin fetches it`);
        continue;
      }
      writeFileSync(pathFor(edition), gunzipSync(row.data));
      logger.info(`[geoip] restored ${edition} from the database (stored ${row.updatedAt.toISOString()})`);
    }
  } catch (err) {
    logger.warn({ err }, '[geoip] could not restore databases — geo/ASN degrade to unknown, click path unaffected');
  }
}

/** When each edition was last downloaded from MaxMind, per the stored copy. */
export async function storedGeoipDates(editions: readonly string[]): Promise<Map<string, string>> {
  try {
    const rows = await AppDataSource.getRepository(GeoipDatabase).find();
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
