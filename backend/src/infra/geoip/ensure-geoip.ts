import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { env } from '../../common/env';
import { logger } from '../../common/logger';
import { redis } from '../redis/redis-client';
import { reloadGeoipReaders } from '../../modules/geo-source/geo-source';
import { diskStatus, restoreGeoipDatabases, saveGeoipDatabase, storedGeoipDates } from './geoip-store';

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
  /** On the Tracker's own disk right now — what the readers actually use. */
  present: boolean;
  updatedAt: string | null;
  /**
   * When this edition was last downloaded from MaxMind, per the copy kept in Postgres.
   *
   * Worth showing separately from `updatedAt`: the file's mtime is the moment it was
   * last written to this container's disk, which after a restart is when it was
   * restored from the database, not when the data was fetched. An admin deciding
   * whether to spend a download wants the second date, not the first.
   */
  storedAt: string | null;
}

/** What the last (or current) download run is doing. */
export interface GeoipFetchState {
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  /** Per-edition outcome of the last completed run; null before the first one. */
  editions: Record<Edition, EditionFetchStatus> | null;
  error: string | null;
}

export interface GeoipStatus {
  editions: Record<Edition, GeoipEditionStatus>;
  fetch: GeoipFetchState;
}

/**
 * State of the current or last download run.
 *
 * In-process and deliberately not persisted: it describes what this Tracker is doing
 * right now, and a restart means nothing is running any more, which is exactly what a
 * fresh value says. What survives a restart is the outcome — the files, and the copy in
 * Postgres — and that is read from disk and the database, not from here.
 */
let fetchState: GeoipFetchState = {
  running: false,
  startedAt: null,
  finishedAt: null,
  editions: null,
  error: null,
};

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
      // Kept in Postgres too, so the next restart restores it from there instead of
      // spending another download — see geoip-store.ts. Awaited rather than fired off,
      // so a failure is logged against this fetch rather than surfacing later with no
      // obvious cause; it never throws.
      await saveGeoipDatabase(edition);
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

/**
 * The download, started and not waited for.
 *
 * Fetching both editions means pulling ~74MB, extracting it, writing it to disk and
 * storing a compressed copy in Postgres — comfortably over a minute. Held open as one
 * HTTP request (admin → API → Tracker), that outlives the platform's request timeout,
 * so the admin saw a 502 while the Tracker quietly finished the job. A failure that
 * reports as a failure is fine; success that reports as a failure is worse than either,
 * because the natural response is to press the button again and spend more of
 * MaxMind's daily allowance.
 *
 * So this returns as soon as the work is under way, and the status endpoint reports
 * how it went. A run already in progress is reported, never duplicated — that is also
 * what makes a double-click free instead of a second 74MB download.
 */
export function startGeoipFetch(): GeoipFetchState {
  if (fetchState.running) return { ...fetchState };

  fetchState = { running: true, startedAt: new Date().toISOString(), finishedAt: null, editions: null, error: null };

  void ensureGeoipDatabases()
    .then((result) => {
      fetchState = {
        running: false,
        startedAt: fetchState.startedAt,
        finishedAt: new Date().toISOString(),
        editions: result.editions,
        error: null,
      };
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : 'GeoIP fetch failed';
      logger.error({ err }, '[geoip] fetch run failed');
      fetchState = {
        running: false,
        startedAt: fetchState.startedAt,
        finishedAt: new Date().toISOString(),
        editions: null,
        error: message,
      };
    });

  return { ...fetchState };
}

/** What the admin panel shows: what is on disk, when it was fetched, and any run in flight. */
export async function getGeoipStatus(): Promise<GeoipStatus> {
  const stored = await storedGeoipDates(EDITIONS);
  const editions = {} as Record<Edition, GeoipEditionStatus>;
  for (const edition of EDITIONS) {
    editions[edition] = { ...diskStatus(edition), storedAt: stored.get(edition) ?? null };
  }
  return { editions, fetch: { ...fetchState } };
}

/**
 * Puts the stored databases back on disk. Called once at Tracker boot.
 *
 * This is the whole point of the Postgres copy: the container's filesystem is wiped
 * every time the free plan recycles it, and without this an admin would have to notice
 * and press "fetch" again — which is what was burning through MaxMind's rate limit.
 */
export function restoreGeoipFromStore(): Promise<void> {
  return restoreGeoipDatabases(EDITIONS);
}

// Still runnable directly for local/manual use: `npm run geoip:fetch`.
if (require.main === module) {
  void ensureGeoipDatabases();
}
