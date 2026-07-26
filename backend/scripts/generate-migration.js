const { spawnSync } = require('node:child_process');

const name = process.argv[2];
if (!name) {
  console.error('Usage: npm run migration:generate -- <MigrationName>');
  console.error('Example: npm run migration:generate -- AddOfferStatusColumn');
  process.exit(1);
}

const migrationPath = `src/infra/database/migrations/${name}`;

const result = spawnSync(
  'npx',
  ['typeorm-ts-node-commonjs', 'migration:generate', '-d', 'src/infra/database/data-source.ts', migrationPath],
  { stdio: 'inherit', shell: true },
);

process.exit(result.status ?? 1);
