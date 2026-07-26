// Dev helper: resolves a Postgres index name back to its table and columns, so a
// unique-constraint violation message can be traced to the code that caused it.
require('dotenv').config();
const { Client } = require('pg');

const name = process.argv[2];
if (!name) {
  console.error('Usage: node scripts/dev/find-index.js <index_name>');
  process.exit(1);
}

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const result = await client.query(
    `SELECT t.relname AS "table", i.relname AS "index", pg_get_indexdef(i.oid) AS "definition"
       FROM pg_class i
       JOIN pg_index ix ON ix.indexrelid = i.oid
       JOIN pg_class t ON t.oid = ix.indrelid
      WHERE i.relname = $1`,
    [name],
  );
  console.log(result.rows);
  await client.end();
})();
