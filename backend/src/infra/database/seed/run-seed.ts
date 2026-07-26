import { AppDataSource } from '../data-source';
import { env } from '../../../common/env';
import { seedCore } from './seed-core';
import { seedTraffic } from './seed-traffic';
import { seedContent } from './seed-content';
import { ADMIN_EMAIL, AFFILIATE_EMAIL, MANAGER_EMAIL, SEED_PASSWORD } from './fixtures';

/**
 * Dev/demo seed.
 *
 * Populates every surface the Admin portal renders — accounts, offers, generated click
 * and conversion history, billing, messaging and platform config — so no page has to
 * fall back to a placeholder for want of data. Idempotent (stable ids via seedUuid) and
 * dev/test-gated. Run against a migrated database: `npm run seed`.
 */
async function main(): Promise<void> {
  if (env.NODE_ENV === 'production') {
    throw new Error(
      'Refusing to run the dev seed in production. Use `npm run seed:prod` for the minimal prod bootstrap (first admin only).',
    );
  }

  await AppDataSource.initialize();
  try {
    // Order matters: traffic references offer/affiliate ids, and content references
    // the advertiser and affiliate ids that seedCore returns.
    const core = await seedCore(AppDataSource);
    await seedTraffic(AppDataSource, core);
    await seedContent(AppDataSource, core);
  } finally {
    await AppDataSource.destroy();
  }

  // eslint-disable-next-line no-console
  console.log(`
✅ Seed complete.

Login credentials (all users share the same password):
  password:   ${SEED_PASSWORD}

  admin:      ${ADMIN_EMAIL}
  manager:    ${MANAGER_EMAIL}
  affiliate:  ${AFFILIATE_EMAIL}
`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Seed failed:', err);
  process.exit(1);
});
