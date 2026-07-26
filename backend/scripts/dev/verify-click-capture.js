// Fires real clicks at the running tracker and asserts the row it wrote captured
// everything the click log and drawer now render: geo, device detail, sub-IDs 1-8 and
// the unique flag (including that a second click from the same IP is NOT unique).
const path = require('node:path');
const { Client } = require(path.join(__dirname, '../../node_modules/pg'));
require(path.join(__dirname, '../../node_modules/dotenv')).config({ path: path.join(__dirname, '../../.env') });

const TRACKER = process.env.TRACKER_URL || 'http://localhost:4001';
const API = process.env.API_URL || 'http://localhost:4000';

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) fail++;
};

// A real, public, non-datacenter address so MaxMind resolves it — the whole point is
// to prove the live path produces a city, not just the seed.
const TEST_IP = '24.60.1.25';
const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const { rows: offers } = await client.query(
    `SELECT id FROM offers WHERE status = 'APPROVED' AND "destinationUrl" IS NOT NULL LIMIT 1`,
  );
  const { rows: affiliates } = await client.query(`SELECT id FROM affiliates LIMIT 1`);
  const offerId = offers[0].id;
  const affiliateId = affiliates[0].id;

  const subs = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `sub${n}=probe_${n}`).join('&');
  const url = `${TRACKER}/click?offerId=${offerId}&affiliateId=${affiliateId}&${subs}`;

  // The unique window is 24h, so a re-run within a day would see its own previous
  // clicks and report the first one as non-unique. Clear this offer's dedup keys so
  // the script is repeatable — the TTL is the product behaviour, not a test fixture.
  const Redis = require(path.join(__dirname, '../../node_modules/ioredis'));
  const redis = new Redis(process.env.REDIS_URL);
  const stale = await redis.keys(`uniq:${offerId}:*`);
  if (stale.length > 0) await redis.del(...stale);
  await redis.quit();

  async function fire() {
    const res = await fetch(url, {
      redirect: 'manual',
      // X-Forwarded-For only counts if TRUST_PROXY is set; when it isn't the row gets
      // ::1 and the private-IP path is what's exercised instead. Both are asserted below.
      headers: { 'User-Agent': UA, 'X-Forwarded-For': TEST_IP },
    });
    return res.status;
  }

  check('tracker redirects the first click', (await fire()) === 302);
  check('tracker redirects the second click', (await fire()) === 302);

  // The write is fire-and-forget, so give it a moment.
  await new Promise((resolve) => setTimeout(resolve, 900));

  const { rows } = await client.query(
    `SELECT * FROM clicks WHERE "offerId" = $1 AND "subId8" = 'probe_8' ORDER BY "createdAt" DESC LIMIT 2`,
    [offerId],
  );
  check('both clicks were logged', rows.length === 2, `${rows.length} rows`);

  const newest = rows[0];
  check('all 8 sub-IDs captured', [1, 2, 3, 4, 5, 6, 7, 8].every((n) => newest[`subId${n}`] === `probe_${n}`), '');
  check('device parsed from the user agent', newest.deviceType === 'mobile', `${newest.deviceType}`);
  check('device brand captured', newest.deviceBrand === 'Apple', `${newest.deviceBrand}`);
  check('browser + version captured', Boolean(newest.browser && newest.browserVersion), `${newest.browser} ${newest.browserVersion}`);
  check('os + version captured', Boolean(newest.os && newest.osVersion), `${newest.os} ${newest.osVersion}`);

  // Geo depends on whether the proxy header was honoured; both outcomes must be sane.
  if (newest.ip === TEST_IP) {
    check('public IP resolved to a city', Boolean(newest.city && newest.countryCode), `${newest.city}, ${newest.regionCode}, ${newest.countryCode}`);
  } else {
    check(
      'loopback IP degrades cleanly instead of throwing',
      newest.countryCode === null && newest.city === null,
      `ip=${newest.ip} (TRUST_PROXY not set — the header was correctly ignored)`,
    );
  }

  // The rule the badge and the aggregate both depend on.
  const oldest = rows[1];
  check('first click of the pair is unique', oldest.isUnique === true, '');
  check('second click from the same IP is NOT unique', newest.isUnique === false, '');

  // And the read side renders a label rather than a blank.
  const login = await (
    await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@fatexia.dev', password: 'ChangeMe123!' }),
    })
  ).json();
  // Filtered by sub-id rather than taking the newest page: the seed assigns each click
  // a random hour of its day, so some seeded rows carry a timestamp later today and
  // would sort above a click that genuinely just happened.
  const logs = await (
    await fetch(`${API}/click-logs?pageSize=200&subId1=probe_1`, {
      headers: { Authorization: `Bearer ${login.accessToken}` },
    })
  ).json();
  const row = logs.rows.find((r) => r.subId8 === 'probe_8');
  check('the API returns the click it just logged', Boolean(row), `${logs.rows.length} rows matched`);
  check('geoLabel is a label, never a blank', Boolean(row?.geoLabel), row?.geoLabel);
  check(
    'and it names the reason the lookup found nothing',
    row?.countryCode ? true : row?.geoLabel === 'Local network' || row?.geoLabel === 'Unknown',
    row?.geoLabel,
  );

  await client.query(`DELETE FROM clicks WHERE "subId8" = 'probe_8'`);
  await client.end();

  console.log(`\n${fail === 0 ? 'Click capture verified' : `${fail} FAILED`}`);
  process.exit(fail === 0 ? 0 : 1);
})();
