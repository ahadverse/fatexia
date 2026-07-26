// Dev helper: prints a row count per table so a seed run can be verified at a glance.
require('dotenv').config();
const { Client } = require('pg');

const TABLES = ['users','managers','affiliates','affiliate_groups','affiliate_points','advertisers','offer_categories','offers','payout_rules','offer_caps','offer_access_requests','smart_links','clicks','conversions','postback_logs','invoices','subscriptions','messages','notifications','news_posts','email_templates','network_settings','integrations'];

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  for (const table of TABLES) {
    const result = await client.query(`SELECT COUNT(*)::int AS n FROM "${table}"`);
    console.log(table.padEnd(24), result.rows[0].n);
  }
  const byStatus = await client.query(`SELECT status, COUNT(*)::int n FROM conversions GROUP BY status ORDER BY n DESC`);
  console.log('\nconversions:', byStatus.rows.map((r) => `${r.status}=${r.n}`).join(' '));
  const byQuality = await client.query(`SELECT "qualityStatus", COUNT(*)::int n FROM clicks GROUP BY "qualityStatus" ORDER BY n DESC`);
  console.log('clicks:     ', byQuality.rows.map((r) => `${r.qualityStatus}=${r.n}`).join(' '));
  await client.end();
})();
