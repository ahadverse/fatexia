// Dev helper: proves /sl/:slug actually resolves — the link the portals hand out was
// a 404 until the resolver existed. Creates a throwaway unrestricted smart-link,
// clicks it, checks the redirect and the click row, then deletes it.
require('dotenv').config();
const { Client } = require('pg');

const API = process.env.API_URL || 'http://localhost:4000';
const TRACKER = process.env.TRACKER_URL || 'http://localhost:4001';
const SLUG = 'zz-verify-smartlink';

function line(label, value) {
  console.log(`  ${label.padEnd(40)} ${value}`);
}

async function main() {
  const db = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : false,
  });
  await db.connect();

  const login = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@fatexia.dev', password: 'ChangeMe123!' }),
  });
  const { accessToken } = await login.json();
  const auth = { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' };

  const affiliate = (await (await fetch(`${API}/affiliates?status=ACTIVE`, { headers: auth })).json())[0];
  const advertiserId = (await (await fetch(`${API}/advertisers`, { headers: auth })).json())[0].id;

  // Purpose-built members rather than seeded ones: every seeded offer's payout rule is
  // geo-targeted, and a request from localhost has no country, so none of them can
  // match — correct behaviour, but it tests the fallback rather than the rotation.
  // These carry untargeted rules at three different payouts so TOP_PAYOUT has an
  // unambiguous right answer.
  const members = [];
  for (const [i, amount] of [40, 90, 65].entries()) {
    const res = await fetch(`${API}/offers`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        advertiserId,
        name: `zz-verify-offer-${i}`,
        currency: 'USD',
        defaultPayoutAmount: amount,
        trackingPlatform: 'DIRECT',
        isPublic: true,
        trafficTypes: [],
        featured: false,
        autoApproveConversions: false,
        allowDeepLinking: false,
        destinationUrl: `https://verify-${i}.example.com/lp`,
        postbackSecret: `sk_verify_${i}`,
        allowedPostbackIps: '127.0.0.1',
        payoutRules: [
          {
            payoutMode: 'CPA',
            payoutType: 'FLAT',
            amount,
            revenueModel: 'NONE',
            revenueAmount: 0,
            targeting: { countries: [], devices: [], os: [], affiliateIds: [], affiliateGroupIds: [] },
            managerCommissionPercent: 0,
            referAffiliateCommissionPercent: 0,
            holdSchedule: { enabled: false, days: 0 },
            commissionPercent: 0,
          },
        ],
        caps: [],
      }),
    });
    if (!res.ok) throw new Error(`create offer -> ${res.status} ${await res.text()}`);
    const offer = await res.json();
    await fetch(`${API}/offers/${offer.id}/status`, { method: 'PATCH', headers: auth, body: JSON.stringify({ status: 'APPROVED' }) });
    members.push({ ...offer, displayPayoutAmount: amount });
  }

  // No geo/device restriction, so any visitor qualifies — the seeded links are
  // deliberately narrow, which is why a plain curl hits their fallback.
  const created = await fetch(`${API}/smart-links`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      name: 'Verify smart-link',
      slug: SLUG,
      offerIds: members.map((o) => o.id),
      countries: [],
      devices: [],
      rotation: 'TOP_PAYOUT',
      status: 'ACTIVE',
      fallbackUrl: 'https://fallback.example.com/none',
    }),
  });
  if (!created.ok) throw new Error(`create -> ${created.status} ${await created.text()}`);
  const link = await created.json();

  try {
    console.log('\nsetup');
    line('members in rotation', members.map((o) => `${o.name} ($${o.displayPayoutAmount})`).join(', '));
    line('affiliate', `${affiliate.publicId} ${affiliate.fullName}`);

    console.log('\nresolution');
    const before = Number((await db.query('SELECT COUNT(*) c FROM clicks')).rows[0].c);
    const res = await fetch(`${TRACKER}/sl/${SLUG}?affiliateId=${affiliate.id}&sub1=verify`, { redirect: 'manual' });
    const location = res.headers.get('location');
    line('status', res.status);
    line('redirected to', location);
    line('not the fallback', location?.includes('fallback.example.com') ? 'NO — nothing matched' : 'yes');
    line('click_id substituted', location && !location.includes('{click_id}') ? 'yes' : 'NO');

    // The click row is written fire-and-forget, so give it a moment to land.
    await new Promise((r) => setTimeout(r, 700));
    const after = Number((await db.query('SELECT COUNT(*) c FROM clicks')).rows[0].c);
    line('click row written', after === before + 1 ? 'yes' : `NO (${before} -> ${after})`);

    const row = (await db.query('SELECT * FROM clicks ORDER BY "createdAt" DESC LIMIT 1')).rows[0];
    line('attributed to the affiliate', row.affiliateId === affiliate.id ? 'yes' : `NO (${row.affiliateId})`);
    line('offer is a rotation member', members.some((o) => o.id === row.offerId) ? 'yes' : 'NO');
    line('sub1 captured', row.subId1 === 'verify' ? 'yes' : `NO (${row.subId1})`);
    line('click id appears in the redirect', location?.includes(row.id) ? 'yes' : 'NO');

    const topPayout = Math.max(...members.map((o) => Number(o.displayPayoutAmount)));
    const chosen = members.find((o) => o.id === row.offerId);
    line('TOP_PAYOUT picked the best', Number(chosen.displayPayoutAmount) === topPayout ? 'yes' : `NO (${chosen.displayPayoutAmount} vs ${topPayout})`);

    console.log('\nrotation strategies');
    for (const rotation of ['ROUND_ROBIN', 'BEST_CR']) {
      await fetch(`${API}/smart-links/${link.id}`, { method: 'PATCH', headers: auth, body: JSON.stringify({ rotation }) });
      const hits = new Map();
      for (let i = 0; i < 9; i += 1) {
        const r = await fetch(`${TRACKER}/sl/${SLUG}?affiliateId=${affiliate.id}&sub1=verify`, { redirect: 'manual' });
        const host = new URL(r.headers.get('location')).host;
        hits.set(host, (hits.get(host) ?? 0) + 1);
      }
      const spread = [...hits.entries()].map(([host, n]) => `${host.split('.')[0]}=${n}`).join(' ');
      const allThree = hits.size === members.length;
      line(rotation, `${spread}   ${rotation === 'ROUND_ROBIN' ? (allThree && [...hits.values()].every((n) => n === 3) ? '(even — correct)' : '(NOT even)') : allThree ? '(all members reachable)' : '(some member starved)'}`);
    }
    await fetch(`${API}/smart-links/${link.id}`, { method: 'PATCH', headers: auth, body: JSON.stringify({ rotation: 'TOP_PAYOUT' }) });

    console.log('\nunresolvable link falls back');
    await fetch(`${API}/smart-links/${link.id}`, {
      method: 'PATCH',
      headers: auth,
      body: JSON.stringify({ countries: ['AQ'] }),
    });
    const missed = await fetch(`${TRACKER}/sl/${SLUG}`, { redirect: 'manual' });
    line('geo-excluded visitor', `${missed.status} -> ${missed.headers.get('location')}`);

    console.log('\naffiliate link carries their own id');
    const affLogin = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'affiliate@fatexia.dev', password: 'ChangeMe123!' }),
    });
    const affToken = (await affLogin.json()).accessToken;
    const affLinks = await (await fetch(`${API}/smart-links`, { headers: { authorization: `Bearer ${affToken}` } })).json();
    const affUrl = affLinks[0]?.smartLinkUrl ?? '';
    line('affiliate sees', affUrl);
    line('macro substituted', affUrl.includes('{affiliate_id}') ? 'NO — still a macro' : 'yes');
    const adminLinks = await (await fetch(`${API}/smart-links`, { headers: auth })).json();
    line('admin still sees the macro', adminLinks[0]?.smartLinkUrl.includes('{affiliate_id}') ? 'yes' : 'NO');
  } finally {
    await fetch(`${API}/smart-links/${link.id}`, { method: 'DELETE', headers: auth });
    // Offers have no DELETE route (status DELETED is the soft delete), so the rows the
    // click points at are removed directly — this is a dev database and leaving three
    // "zz-verify" offers behind on every run would litter the offers list.
    await db.query('DELETE FROM clicks WHERE "subId1" = $1', ['verify']);
    await db.query(`DELETE FROM payout_rules WHERE "offerId" IN (SELECT id FROM offers WHERE name LIKE 'zz-verify-offer-%')`);
    await db.query(`DELETE FROM offer_caps WHERE "offerId" IN (SELECT id FROM offers WHERE name LIKE 'zz-verify-offer-%')`);
    await db.query(`DELETE FROM clicks WHERE "offerId" IN (SELECT id FROM offers WHERE name LIKE 'zz-verify-offer-%')`);
    await db.query(`DELETE FROM offers WHERE name LIKE 'zz-verify-offer-%'`);
    await db.end();
    console.log('\ncleaned up\n');
  }
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
