// Proves where BLOCKED traffic goes: offer override -> network setting -> built-in
// default, and that the fraud bands on the Settings page actually drive the scoring
// (they were editable and read by nothing before).
//
// Requires the tracker running with TRUST_PROXY=1, because the block is triggered the
// honest way — an X-Forwarded-For carrying a real AWS address, which the datacenter
// filter scores 70. That also makes this a live check that TRUST_PROXY is wired.
//
//   TRUST_PROXY=1 npm run dev:tracking
//   node scripts/dev/verify-blocked-redirect.js
const path = require('node:path');
const { Client } = require(path.join(__dirname, '../../node_modules/pg'));
require(path.join(__dirname, '../../node_modules/dotenv')).config({ path: path.join(__dirname, '../../.env') });

const TRACKER = process.env.TRACKER_URL || 'http://localhost:4001';
const API = process.env.API_URL || 'http://localhost:4000';

// AWS. `isLikelyDatacenter` matches the ASN organisation, scoring +70 — at or above
// the default block threshold, so this click is BLOCKED without touching any setting.
const DATACENTER_IP = '3.5.140.2';
const CLEAN_IP = '24.60.1.25';

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) fail++;
};

(async () => {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  const { rows: offers } = await db.query(
    `SELECT id, "destinationUrl" FROM offers WHERE status = 'APPROVED' AND "destinationUrl" IS NOT NULL LIMIT 1`,
  );
  const offer = offers[0];

  const token = (
    await (
      await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@fatexia.dev', password: 'ChangeMe123!' }),
      })
    ).json()
  ).accessToken;

  const getSettings = () => fetch(`${API}/network-settings`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
  const saveSettings = (body) =>
    fetch(`${API}/network-settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });

  const original = await getSettings();

  async function clickFrom(ip, tag) {
    const res = await fetch(`${TRACKER}/click?offerId=${offer.id}&sub1=${tag}`, {
      redirect: 'manual',
      headers: { 'X-Forwarded-For': ip, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/131.0' },
    });
    return res.headers.get('location');
  }

  // The tracker is a separate process with a 60s settings cache, so a change made
  // through the API has to age out there. Waiting is the honest test of the
  // documented behaviour rather than reaching into its memory.
  const waitForCache = () => {
    console.log('note  waiting 62s for the tracker settings cache to expire…');
    return new Promise((r) => setTimeout(r, 62_000));
  };

  try {
    // --- clean traffic must still reach the advertiser
    const clean = await clickFrom(CLEAN_IP, 'br_clean');
    check('clean click reaches the offer destination', clean?.includes('click_id='), clean);

    // --- datacenter traffic is blocked and diverted to the built-in default
    await saveSettings({ blockedRedirectUrl: null });
    await waitForCache();
    const viaDefault = await clickFrom(DATACENTER_IP, 'br_default');
    check('blocked click falls back to the built-in default', viaDefault === 'https://www.google.com', viaDefault);

    await new Promise((r) => setTimeout(r, 800));
    const { rows: logged } = await db.query(
      `SELECT "qualityStatus", "riskScore", "isDatacenter", "countryCode" FROM clicks WHERE "subId1" = 'br_default' ORDER BY "createdAt" DESC LIMIT 1`,
    );
    check('it was scored BLOCKED, not silently passed', logged[0]?.qualityStatus === 'BLOCKED', JSON.stringify(logged[0]));
    check('TRUST_PROXY is honoured (real client IP resolved)', logged[0]?.countryCode === 'KR', `countryCode=${logged[0]?.countryCode}`);

    // --- network-wide override
    await saveSettings({ blockedRedirectUrl: 'https://network-fallback.example.com/rejected' });
    await waitForCache();
    const viaNetwork = await clickFrom(DATACENTER_IP, 'br_network');
    check('network setting overrides the built-in default', viaNetwork === 'https://network-fallback.example.com/rejected', viaNetwork);

    // --- per-offer override wins (read from the offer row, so no cache wait)
    await db.query(`UPDATE offers SET "blockedRedirectUrl" = $1 WHERE id = $2`, [
      'https://advertiser-own.example.com/unavailable',
      offer.id,
    ]);
    const viaOffer = await clickFrom(DATACENTER_IP, 'br_offer');
    check('offer override beats the network setting', viaOffer === 'https://advertiser-own.example.com/unavailable', viaOffer);

    // --- and the Settings fraud bands genuinely drive scoring.
    //
    // Demonstrated on the clean IP, not the datacenter one: a datacenter+proxy click
    // scores 120 and the schema caps thresholds at 100, so it can never be tuned
    // below the block band. The clean IP scores 0, so dropping the suspect band to 0
    // must reclassify it — it would be GOOD under the old hardcoded 30.
    await saveSettings({ fraudSuspectThreshold: 0, fraudBlockThreshold: 1 });
    await waitForCache();
    await clickFrom(CLEAN_IP, 'br_band');
    await new Promise((r) => setTimeout(r, 800));
    const { rows: reband } = await db.query(
      `SELECT "qualityStatus", "riskScore" FROM clicks WHERE "subId1" = 'br_band' ORDER BY "createdAt" DESC LIMIT 1`,
    );
    check(
      'lowering the suspect band reclassifies a zero-risk click',
      reband[0]?.qualityStatus === 'SUSPECT' && reband[0]?.riskScore === 0,
      JSON.stringify(reband[0]),
    );
  } finally {
    await db.query(`UPDATE offers SET "blockedRedirectUrl" = NULL WHERE id = $1`, [offer.id]);
    await db.query(`DELETE FROM clicks WHERE "subId1" LIKE 'br\\_%'`);
    await saveSettings({
      fraudSuspectThreshold: original.fraudSuspectThreshold,
      fraudBlockThreshold: original.fraudBlockThreshold,
      blockedRedirectUrl: original.blockedRedirectUrl,
    });
    await db.end();
  }

  console.log(`\n${fail === 0 ? 'Blocked-redirect resolution verified' : `${fail} FAILED`}`);
  process.exit(fail === 0 ? 0 : 1);
})();
