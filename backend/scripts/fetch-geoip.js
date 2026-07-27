#!/usr/bin/env node
/**
 * Downloads the MaxMind GeoLite2 databases at build time.
 *
 * These are not in the repository on purpose: the GeoLite2 licence forbids
 * redistribution, and GeoLite2-City.mmdb is ~57 MB and replaced monthly, so
 * committing it would both breach the licence and bloat history permanently.
 *
 * Requires MAXMIND_LICENSE_KEY (free account at maxmind.com). Without it this exits
 * 0 rather than failing the build — the geo layer degrades gracefully, leaving
 * country/ASN unknown, and a deploy should not be blocked by a missing optional
 * signal. The click path itself never depends on this.
 */
const { execFileSync } = require('node:child_process');
const { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');

const EDITIONS = ['GeoLite2-City', 'GeoLite2-ASN'];
const targetDir = process.env.GEOIP_DB_DIR || 'data/geoip';
const licenseKey = process.env.MAXMIND_LICENSE_KEY;

if (!licenseKey) {
  console.warn(
    '[geoip] MAXMIND_LICENSE_KEY not set — skipping download.\n' +
      '[geoip] Geo and ASN lookups will return unknown, which disables the\n' +
      '[geoip] datacenter/hosting fraud filter. Everything else works normally.',
  );
  process.exit(0);
}

mkdirSync(targetDir, { recursive: true });

for (const edition of EDITIONS) {
  const url =
    `https://download.maxmind.com/app/geoip_download` +
    `?edition_id=${edition}&license_key=${licenseKey}&suffix=tar.gz`;

  // Extracted into a scratch directory first: the archive nests the .mmdb inside a
  // date-stamped folder, and a failed download must not leave a truncated file
  // where the app expects a valid database.
  const scratch = join(tmpdir(), `geoip-${edition}-${Date.now()}`);
  mkdirSync(scratch, { recursive: true });

  try {
    console.log(`[geoip] downloading ${edition}…`);
    // curl and tar are present on Render's build image and every CI Linux runner.
    execFileSync('bash', ['-c', `curl -fsSL "${url}" | tar -xz -C "${scratch}"`], { stdio: 'inherit' });

    const extractedDir = readdirSync(scratch).find((entry) => entry.startsWith(edition));
    if (!extractedDir) throw new Error('archive did not contain the expected directory');

    const source = join(scratch, extractedDir, `${edition}.mmdb`);
    if (!existsSync(source)) throw new Error(`${edition}.mmdb missing from archive`);

    // copyFileSync (not renameSync): scratch lives on os.tmpdir(), which on Render
    // is a different filesystem than the target dir, so a rename hits EXDEV.
    copyFileSync(source, join(targetDir, `${edition}.mmdb`));
    console.log(`[geoip] installed ${edition}.mmdb`);
  } catch (err) {
    // A failed fetch is a downgrade, not an outage — same rationale as a missing
    // key above. Loud enough to notice in build logs, not fatal.
    console.warn(`[geoip] could not fetch ${edition}: ${err.message}`);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}
