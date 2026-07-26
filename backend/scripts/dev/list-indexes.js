// Dev helper: lists the indexes on the hot-path traffic tables so they can be checked
// against the composite indexes PLAN-tracker.md requires.
require('dotenv').config();
const { Client } = require('pg');

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const result = await client.query(
    `SELECT tablename, indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = ANY($1)
      ORDER BY tablename, indexname`,
    [['clicks', 'conversions', 'postback_logs']],
  );
  for (const row of result.rows) console.log(row.tablename.padEnd(16), row.indexdef.replace(/^CREATE (UNIQUE )?INDEX \S+ ON public\.\w+ USING btree /, ''));
  await client.end();
})();
