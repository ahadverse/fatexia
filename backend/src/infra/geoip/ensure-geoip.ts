import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { env } from '../../common/env';
import { logger } from '../../common/logger';
import { redis } from '../redis/redis-client';
import { reloadGeoipReaders } from '../../modules/geo-source/geo-source';

/**
 * Fetches the MaxMind GeoLite2 databases. Admin-triggered only (see
 * modules/geoip/geoip-internal.routes.ts) — this used to run automatically (first at
 * build time, then at Tracker startup with a scheduled 6h recheck), but both re-fetch
 * an unbounded amount of data on infrastructure the operator doesn't directly control
 * (every deploy, or every restart on a free plan that sleeps after ~15 minutes idle),
 * and repeatedly hit MaxMind's download rate limit (HTTP 429) during testing. Putting
 * the decision behind an explicit admin action means it only ever runs when someone
 * actually wants fresh data.
 */

const EDITIONS = ['GeoLite2-City', 'GeoLite2-ASN'] as const;
type Edition = (typeof EDITIONS)[number];

const COOLDOWN_SECONDS = 24 * 60 * 60;
const COOLDOWN_KEY_PREFIX = 'geoip:cooldown:';
// A daily budget rather than a single lock. One attempt per day was too tight in
// practice: a restart on an ephemeral filesystem wipes the .mmdb files while the lock
// is still held, leaving geo lookups degraded for the rest of the day with no way to
// recover. Ten still sits far under MaxMind's own limit.
const MAX_ATTEMPTS_PER_DAY = 10;

// A 429 here is MaxMind's download-rate limit, not a bad key — worth a couple of
// spaced-out retries before giving up for this attempt.
const RETRY_DELAYS_MS = [5000, 15000];

export type EditionFetchStatus = 'downloaded' | 'skipped-cooldown' | 'failed';

export interface GeoipFetchResult {
  attempted: boolean;
  editions: Record<Edition, EditionFetchStatus>;
}

export interface GeoipEditionStatus {
  present: boolean;
  updatedAt: string | null;
}

export type GeoipStatus = Record<Edition, GeoipEditionStatus>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Counts the attempt BEFORE downloading (not after success) — so a crash mid-download,
// or an admin double-clicking the refresh button, still spends budget. That is what
// protects against MaxMind's actual rate limit.
//
// The TTL is set only on the first attempt of a window, so the window is a fixed 24h
// from that attempt rather than a rolling one that a burst of clicks could extend
// indefinitely.
async function claimAttempt(edition: string): Promise<boolean> {
  try {
    const key = `${COOLDOWN_KEY_PREFIX}${edition}`;
    const used = await redis.incr(key);
    if (used === 1) {
      await redis.expire(key, COOLDOWN_SECONDS);
    }
    return used <= MAX_ATTEMPTS_PER_DAY;
  } catch (err) {
    // Redis unreachable: fail open on attempting the fetch rather than silently never
    // refreshing geo data — MaxMind's own 429 is still a hard backstop.
    logger.warn({ err, edition }, '[geoip] Redis attempt check failed, attempting fetch anyway');
    return true;
  }
}

async function fetchEdition(edition: Edition, targetDir: string, licenseKey: string): Promise<EditionFetchStatus> {
  const targetPath = join(targetDir, `${edition}.mmdb`);

  if (!(await claimAttempt(edition))) {
    logger.info(
      `[geoip] ${edition} has used all ${MAX_ATTEMPTS_PER_DAY} fetch attempts for today — skipping to respect MaxMind's rate limit`,
    );
    return 'skipped-cooldown';
  }

  const url = `https://download.maxmind.com/app/geoip_download?edition_id=${edition}&license_key=${licenseKey}&suffix=tar.gz`;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    // Extracted into a scratch directory first: the archive nests the .mmdb inside a
    // date-stamped folder, and a failed download must not leave a truncated file
    // where the app expects a valid database.
    const scratch = join(tmpdir(), `geoip-${edition}-${Date.now()}`);
    mkdirSync(scratch, { recursive: true });

    try {
      logger.info(`[geoip] downloading ${edition}…`);
      // curl and tar are present on Render's runtime image and every dev machine
      // this actually runs on.
      execFileSync('bash', ['-c', `curl -fsSL "${url}" | tar -xz -C "${scratch}"`], { stdio: 'pipe' });

      const extractedDir = readdirSync(scratch).find((entry) => entry.startsWith(edition));
      if (!extractedDir) throw new Error('archive did not contain the expected directory');

      const source = join(scratch, extractedDir, `${edition}.mmdb`);
      if (!existsSync(source)) throw new Error(`${edition}.mmdb missing from archive`);

      // copyFileSync (not renameSync): scratch lives on os.tmpdir(), which can be a
      // different filesystem than the target dir, so a rename risks EXDEV.
      copyFileSync(source, targetPath);
      logger.info(`[geoip] installed ${edition}.mmdb`);
      return 'downloaded';
    } catch (err) {
      const isLastAttempt = attempt === RETRY_DELAYS_MS.length;
      if (isLastAttempt) {
        logger.warn({ err }, `[geoip] could not fetch ${edition} — geo/ASN lookups degrade to unknown, click path unaffected`);
        return 'failed';
      }
      const delay = RETRY_DELAYS_MS[attempt]!;
      logger.warn({ err }, `[geoip] fetch ${edition} failed (likely MaxMind rate limit) — retrying in ${delay}ms`);
      await sleep(delay);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }

  // Unreachable — the loop above always returns on its last attempt — but keeps the
  // function's return type honest for TypeScript.
  return 'failed';
}

/**
 * Downloads both GeoLite2 editions right now. Called only from the admin-secret-guarded
 * `/internal/geoip/fetch` route — never automatically. Still gated by the per-edition
 * daily Redis budget (not a "force" bypass) because that budget exists to respect
 * MaxMind's own rate limit, not to throttle how often an admin is allowed to ask.
 */
export async function ensureGeoipDatabases(): Promise<GeoipFetchResult> {
  if (!env.MAXMIND_LICENSE_KEY) {
    logger.warn('[geoip] MAXMIND_LICENSE_KEY not set — cannot fetch GeoLite2 databases');
    return {
      attempted: false,
      editions: { 'GeoLite2-City': 'failed', 'GeoLite2-ASN': 'failed' },
    };
  }

  mkdirSync(env.GEOIP_DB_DIR, { recursive: true });

  const editions = {} as Record<Edition, EditionFetchStatus>;
  for (const edition of EDITIONS) {
    editions[edition] = await fetchEdition(edition, env.GEOIP_DB_DIR, env.MAXMIND_LICENSE_KEY);
  }

  // Cheap even when every edition above was skipped — makes sure a freshly downloaded
  // file takes effect immediately, without waiting on the next click or a restart.
  await reloadGeoipReaders();

  return { attempted: true, editions };
}

/** Read-only view of what's on disk right now, for the admin panel's status display. */
export function getGeoipStatus(): GeoipStatus {
  const status = {} as GeoipStatus;
  for (const edition of EDITIONS) {
    const path = join(env.GEOIP_DB_DIR, `${edition}.mmdb`);
    if (existsSync(path)) {
      status[edition] = { present: true, updatedAt: statSync(path).mtime.toISOString() };
    } else {
      status[edition] = { present: false, updatedAt: null };
    }
  }
  return status;
}

// Still runnable directly for local/manual use: `npm run geoip:fetch`.
if (require.main === module) {
  void ensureGeoipDatabases();
}
