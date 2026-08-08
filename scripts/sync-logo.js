#!/usr/bin/env node
/**
 * Copies the brand logo to every place that has to serve it.
 *
 * Four copies exist because each app serves its own static root and they deploy
 * independently — the admin and affiliate SPAs from their Vite `public/`, the
 * marketing site from Next's `public/`, and the API from `backend/public/` (mail
 * clients fetch the logo over HTTP, so the backend cannot reach into a frontend
 * folder at runtime). Nothing keeps them in step on its own, and they have already
 * drifted once: three were updated by hand and the backend's was left stale, which
 * meant every outbound email carried the previous logo.
 *
 * Usage:  node scripts/sync-logo.js [source]
 *         Defaults to frontend/apps/admin/public/logo.png as the source of truth.
 */
const { copyFileSync, existsSync, readFileSync } = require('node:fs');
const { join, resolve } = require('node:path');

const ROOT = resolve(__dirname, '..');

const TARGETS = [
  'frontend/apps/admin/public/logo.png',
  'frontend/apps/affiliate/public/logo.png',
  'frontend/apps/public/public/logo.png',
  'backend/public/logo.png',
];

const source = resolve(process.argv[2] ?? join(ROOT, TARGETS[0]));

if (!existsSync(source)) {
  console.error(`Source not found: ${source}`);
  process.exit(1);
}

// Reported so a swapped asset's proportions are visible here rather than discovered
// in an inbox. The email layout derives its height from this ratio.
const header = readFileSync(source).subarray(0, 24);
const width = header.readUInt32BE(16);
const height = header.readUInt32BE(20);
console.log(`source: ${source}`);
console.log(`size:   ${width}x${height} (ratio ${(width / height).toFixed(2)})`);
console.log('Tip: trim surrounding transparent padding, or the mark renders smaller than its box.\n');

for (const target of TARGETS) {
  const dest = join(ROOT, target);
  if (dest === source) continue;
  copyFileSync(source, dest);
  console.log(`  → ${target}`);
}

console.log('\nDone. Restart the API so the email layout re-reads the dimensions.');
