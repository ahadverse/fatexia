// How much of the clicks table actually resolved to a location, and whether the
// stored city/region agree with the stored country. Run after a seed or a traffic
// replay: a drop in `withCity` means the geo pipeline regressed, which used to be
// invisible because the seed hardcoded a country instead of looking one up.
const path = require('node:path');
const { Client } = require(path.join(__dirname, '../../node_modules/pg'));
require(path.join(__dirname, '../../node_modules/dotenv')).config({
  path: path.join(__dirname, '../../.env'),
});

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const { rows: coverage } = await client.query(`
    SELECT count(*)::int AS total,
           count("countryCode")::int AS with_country,
           count("city")::int AS with_city,
           count("region")::int AS with_region,
           count(*) FILTER (WHERE "isUnique")::int AS unique_clicks
    FROM clicks
  `);
  console.log('coverage:', coverage[0]);

  const { rows: sample } = await client.query(`
    SELECT ip, "countryCode", city, region, "regionCode", "deviceBrand", "browserVersion", "osVersion", "isUnique"
    FROM clicks WHERE city IS NOT NULL ORDER BY "createdAt" DESC LIMIT 6
  `);
  console.table(sample);

  const { rows: countries } = await client.query(`
    SELECT "countryCode", count(*)::int AS n FROM clicks GROUP BY 1 ORDER BY 2 DESC
  `);
  console.log('countries:', countries.map((r) => `${r.countryCode ?? 'NULL'}=${r.n}`).join('  '));

  // The runtime rule is one unique per (offer, ip) within a window; the seed applies
  // "first ever" over its own generated set, so these must match exactly.
  const { rows: check } = await client.query(`
    SELECT (SELECT count(*) FROM clicks WHERE "isUnique")::int AS flagged,
           (SELECT count(*) FROM (SELECT DISTINCT "offerId", ip FROM clicks) t)::int AS distinct_pairs
  `);
  const { flagged, distinct_pairs: pairs } = check[0];
  console.log(`unique flag: ${flagged} flagged vs ${pairs} distinct (offer,ip) pairs — ${flagged === pairs ? 'OK' : 'MISMATCH'}`);

  await client.end();
  process.exit(flagged === pairs && coverage[0].with_city > 0 ? 0 : 1);
})();
