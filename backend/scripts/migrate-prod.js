/**
 * Runs pending migrations, safely, from more than one service at once.
 *
 * Both the API and the Tracker start with this. That is deliberate: they deploy in
 * parallel from one blueprint, and whichever boots first must not find a schema the
 * other has not finished changing yet. The Tracker in particular reads and writes
 * columns the migrations add (`clicks.refId`, `offers.refId`), so booting it against an
 * un-migrated database does not degrade a feature — it fails every click redirect.
 *
 * Running the same migrations from two processes at the same moment is the obvious
 * hazard that creates, so this takes a Postgres advisory lock first. The lock is held
 * on its own connection while the TypeORM CLI works on another; the second service
 * blocks here, then finds nothing left to apply and starts. Advisory locks are released
 * automatically if the process dies, so a crashed deploy cannot wedge the next one.
 */
const { spawnSync } = require('node:child_process');
const { Client } = require('pg');

// Render injects the real environment, so this is a no-op there. It is here so the
// script can be run and checked locally against a .env the same way the app is —
// dotenv never overwrites a variable the environment already set.
require('dotenv').config();

// Any constant works — it only has to be the same in both services and unlikely to
// collide with another advisory lock. This one spells out "fatexia migrations".
const LOCK_KEY = 4718241;

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('[migrate] DATABASE_URL is not set');
    process.exit(1);
  }

  // Matches data-source.ts: Neon terminates every connection with TLS, and its
  // certificate chain is not one Node ships with.
  const ssl = process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined;
  const client = new Client({ connectionString, ssl });

  await client.connect();
  console.log('[migrate] waiting for the migration lock…');
  await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
  console.log('[migrate] lock acquired, running migrations');

  // The CLI is run through node with a resolved path rather than through `npx` in a
  // shell: no shell means the arguments cannot be re-interpreted, and no `npx` means
  // this cannot go looking on the network for a package that is already installed.
  const cli = require.resolve('typeorm/cli.js');
  const result = spawnSync(process.execPath, [cli, 'migration:run', '-d', 'dist/infra/database/data-source.js'], {
    stdio: 'inherit',
  });

  // Released explicitly rather than left to disconnect, so the next service starts
  // moving the moment this one is done rather than waiting on a socket timeout.
  await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]);
  await client.end();

  process.exit(result.status ?? 1);
}

main().catch((err) => {
  console.error('[migrate] failed:', err);
  process.exit(1);
});
