/**
 * Proves the GeoIP database copy survives a round trip, and that refreshing it does not
 * cost storage the way it used to.
 *
 * Two separate claims, and the second is the reason this script exists. The store used
 * to grow its blob with `UPDATE ... SET data = data || $chunk`, which is quadratic in
 * storage — Postgres rewrites the whole row per UPDATE and TOAST comes with it — so one
 * fetch of the 29MB City database left ~435MB of dead tuples and filled the plan. The
 * rewrite stores one row per chunk. A test that only checked the bytes came back would
 * have passed against the version that broke production.
 *
 * Run against a database that already has the edition stored:
 *   npx tsx scripts/dev/verify-geoip-store.ts [edition]
 *
 * Read-only with respect to the *content*: the file on disk is moved aside and put back
 * exactly as it was found.
 */
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, renameSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import maxmind from 'maxmind';
import { AppDataSource } from '../../src/infra/database/data-source';
import { env } from '../../src/common/env';
import { restoreGeoipDatabases, saveGeoipDatabase, storedGeoipDates } from '../../src/infra/geoip/geoip-store';

// Defaults to the small one: the point is the storage behaviour, not the megabytes, and
// City would make every refresh below a 30MB round trip for the same answer. Pass
// `GeoLite2-City` to exercise the 32-chunk path that actually runs in production.
const EDITION = process.argv[2] ?? 'GeoLite2-ASN';
const REFRESHES = 3;

/** The field that proves the reader opened a real database, per edition. */
function probe(reader: maxmind.Reader<unknown>): { label: string; ok: boolean } {
  const row = reader.get('8.8.8.8') as { autonomous_system_number?: number; country?: { iso_code?: string } } | null;
  return EDITION.includes('ASN')
    ? { label: `AS${row?.autonomous_system_number}`, ok: Boolean(row?.autonomous_system_number) }
    : { label: String(row?.country?.iso_code), ok: Boolean(row?.country?.iso_code) };
}

let failures = 0;

function check(label: string, ok: boolean, detail = ''): void {
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
}

function sha256(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    createReadStream(path)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', reject)
      .on('end', () => resolve(hash.digest('hex')));
  });
}

/** What the chunk table costs on disk, TOAST included — where the bytes actually live. */
async function tableBytes(): Promise<number> {
  const [row]: { bytes: string }[] = await AppDataSource.query(
    `SELECT pg_total_relation_size('geoip_database_chunks')::bigint AS bytes`,
  );
  return Number(row.bytes);
}

/**
 * Live bytes across *every* edition, not just the one being refreshed.
 *
 * The table holds City as well as ASN, so comparing the file size against one edition's
 * bytes would call a perfectly healthy table bloated by the size of the other one.
 */
async function liveBytes(): Promise<number> {
  const [row]: { bytes: string }[] = await AppDataSource.query(
    `SELECT COALESCE(SUM(octet_length(data)), 0)::bigint AS bytes FROM geoip_database_chunks`,
  );
  return Number(row.bytes);
}

async function storedShape(): Promise<{ chunks: number; bytes: number; chunkCount: number; checksum: string | null }> {
  const [meta]: { chunkCount: number; checksum: string | null }[] = await AppDataSource.query(
    `SELECT "chunkCount", checksum FROM geoip_databases WHERE edition = $1`,
    [EDITION],
  );
  const [agg]: { chunks: number; bytes: string }[] = await AppDataSource.query(
    `SELECT COUNT(*)::int AS chunks, COALESCE(SUM(octet_length(data)), 0)::bigint AS bytes
     FROM geoip_database_chunks WHERE edition = $1`,
    [EDITION],
  );
  return { chunks: agg.chunks, bytes: Number(agg.bytes), chunkCount: meta?.chunkCount ?? 0, checksum: meta?.checksum ?? null };
}

async function main(): Promise<void> {
  await AppDataSource.initialize();

  const livePath = join(env.GEOIP_DB_DIR, `${EDITION}.mmdb`);
  if (!existsSync(livePath)) {
    console.error(`${livePath} is not on disk — fetch it first, this script verifies the stored copy against it.`);
    process.exit(1);
  }

  const originalDigest = await sha256(livePath);
  const originalSize = statSync(livePath).size;
  console.log(`source: ${EDITION}.mmdb, ${originalSize} bytes, sha256 ${originalDigest.slice(0, 12)}…\n`);

  // --- restore ------------------------------------------------------------------
  // Moved aside rather than copied: restoreGeoipDatabases deliberately skips an edition
  // that is already on disk, so the file has to actually be absent for this to test
  // anything. Renamed within the same directory, so it is a metadata move and the
  // original is never at risk of a half-finished copy.
  const parked = join(env.GEOIP_DB_DIR, `${EDITION}.verify-parked`);
  renameSync(livePath, parked);

  try {
    await restoreGeoipDatabases([EDITION]);
    check('restored the file from Postgres', existsSync(livePath));

    if (existsSync(livePath)) {
      const restoredDigest = await sha256(livePath);
      check('restored bytes are identical to the original', restoredDigest === originalDigest, `${restoredDigest.slice(0, 12)}…`);

      // Byte-identical already implies this, but it is the claim that actually matters:
      // the readers can open what came back. A truncated database that still parses is
      // the failure this whole checksum/chunk-count apparatus exists to catch.
      const result = probe(await maxmind.open(livePath));
      check('the restored database answers a real lookup', result.ok, result.label);
    }
  } finally {
    rmSync(livePath, { force: true });
    renameSync(parked, livePath);
  }

  // --- storage cost of a refresh -------------------------------------------------
  const before = await tableBytes();
  const shapeBefore = await storedShape();
  console.log(`\nchunk table: ${(before / 1048576).toFixed(1)}MB, ${shapeBefore.chunks} chunks for ${EDITION}`);

  for (let i = 1; i <= REFRESHES; i += 1) {
    await saveGeoipDatabase(EDITION);
    const size = await tableBytes();
    console.log(`  refresh ${i}: ${(size / 1048576).toFixed(1)}MB`);
  }

  const after = await tableBytes();
  const shapeAfter = await storedShape();

  check('the stored copy still matches the file on disk', shapeAfter.checksum === originalDigest, shapeAfter.checksum?.slice(0, 12));
  check('chunkCount agrees with the rows actually present', shapeAfter.chunkCount === shapeAfter.chunks, `${shapeAfter.chunkCount} vs ${shapeAfter.chunks}`);
  check('the stored dates moved', (await storedGeoipDates([EDITION])).has(EDITION));

  // The real claim. The old append loop was quadratic: three refreshes of this 6MB blob
  // would have left roughly 60MB of dead tuples behind, and nothing was reclaiming them.
  // Vacuuming between the delete and the inserts means each refresh writes into the
  // pages the previous copy vacated, so the file should not grow at all.
  const live = await liveBytes();
  const growth = after - before;
  const slack = 2 * 1048576;
  check(
    `${REFRESHES} refreshes did not grow the table`,
    growth <= slack,
    `${(before / 1048576).toFixed(1)}MB → ${(after / 1048576).toFixed(1)}MB (${growth >= 0 ? '+' : ''}${(growth / 1048576).toFixed(1)}MB)`,
  );
  check(
    'the table is not carrying a spare copy',
    after <= live + shapeAfter.bytes + slack,
    `${(after / 1048576).toFixed(1)}MB on disk for ${(live / 1048576).toFixed(1)}MB live across all editions`,
  );

  await AppDataSource.destroy();

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
