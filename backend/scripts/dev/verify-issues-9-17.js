// Asserts the behaviour added for issues 9-17: city-level geo, per-row unique clicks,
// sub-IDs 4-8, click-log sorting/summary, notification audience isolation and the
// markRead ownership fix.
const BASE = process.env.API_URL || 'http://localhost:4000';

let pass = 0;
let fail = 0;

function check(label, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(60)} got ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`);
  ok ? pass++ : fail++;
}

function assert(label, condition, detail = '') {
  console.log(`${condition ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
  condition ? pass++ : fail++;
}

async function login(email) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'ChangeMe123!' }),
  });
  return (await res.json()).accessToken;
}

const call = (token, path, init = {}) =>
  fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });

const json = async (token, path, init) => (await call(token, path, init)).json();

(async () => {
  const admin = await login('admin@fatexia.dev');
  const affiliate = await login('affiliate@fatexia.dev');

  // ------------------------------------------------------------------ geo (17)
  const logs = await json(admin, '/click-logs?pageSize=200');
  const withCity = logs.rows.filter((row) => row.city);
  assert('admin click rows carry a city', withCity.length > 0, `${withCity.length}/${logs.rows.length}`);

  const sample = withCity[0];
  assert('city row also has region + regionCode', Boolean(sample.region && sample.regionCode), `${sample.city}, ${sample.regionCode}`);
  check('geoLabel composes city, region, country', sample.geoLabel, `${sample.city}, ${sample.regionCode}, ${sample.countryCode}`);

  // The whole point of issue 17: an unresolvable address must read as information,
  // never as a bare dash.
  const unresolved = logs.rows.filter((row) => !row.countryCode);
  if (unresolved.length > 0) {
    assert(
      'unresolved rows get a labelled geo, not a blank',
      unresolved.every((row) => row.geoLabel === 'Local network' || row.geoLabel === 'Unknown'),
      unresolved[0].geoLabel,
    );
  } else {
    console.log('note  no unresolved rows in this sample — skipping the local/unknown label check');
  }

  assert('device detail captured', Boolean(sample.browserVersion && sample.osVersion), `${sample.browser} ${sample.browserVersion} / ${sample.os} ${sample.osVersion}`);

  // --------------------------------------------------------- unique clicks (13/15)
  assert('summary travels with the page', typeof logs.summary?.clicks === 'number' && typeof logs.summary?.uniqueClicks === 'number', JSON.stringify(logs.summary));
  assert('unique count is a strict subset of clicks', logs.summary.uniqueClicks > 0 && logs.summary.uniqueClicks < logs.summary.clicks, `${logs.summary.uniqueClicks}/${logs.summary.clicks}`);

  // The aggregate the report shows must be the same number the badges add up to.
  const report = await json(admin, '/reports/grouped?groupBy=date&limit=500');
  check('report totals expose uniqueClicks', typeof report.totals.uniqueClicks, 'number');
  const summedUnique = report.rows.reduce((sum, row) => sum + row.uniqueClicks, 0);
  check('totals.uniqueClicks equals the sum of its rows', report.totals.uniqueClicks, summedUnique);
  check('report totals expose blocked/suspect', [typeof report.totals.blockedClicks, typeof report.totals.suspectClicks], ['number', 'number']);

  // ------------------------------------------------------------- sorting (13/15)
  const byIp = await json(admin, '/click-logs?pageSize=5&sortBy=ip&sortDir=ASC');
  const ips = byIp.rows.map((row) => row.ip);
  check('click log sorts by IP ascending', ips, [...ips].sort());
  const rejected = await call(admin, '/click-logs?sortBy=id%3B%20DROP%20TABLE');
  check('an unknown sort key is rejected, not interpolated', rejected.status, 400);

  // ------------------------------------------------------------ sub-IDs 4-8 (14)
  assert('click rows carry subId4..subId8', ['subId4', 'subId5', 'subId6', 'subId7', 'subId8'].every((key) => key in sample), '');
  const subReport = await call(admin, '/reports/grouped?groupBy=subId8');
  check('subId8 is a valid report dimension', subReport.status, 200);
  const cityReport = await call(admin, '/reports/grouped?groupBy=city');
  check('city is a valid report dimension', cityReport.status, 200);

  // ------------------------------------------------------ affiliate click row (13)
  const own = await json(affiliate, '/click-logs/mine?pageSize=5');
  const ownRow = own.rows[0];
  assert('affiliate sees their own IP and user agent', 'ip' in ownRow && 'userAgent' in ownRow, '');
  assert('affiliate sees city + geoLabel', 'city' in ownRow && 'geoLabel' in ownRow, ownRow.geoLabel);
  assert('affiliate row still hides fraud reasoning', !('asn' in ownRow) && !('riskScore' in ownRow) && !('isProxyOrVpn' in ownRow), '');
  assert('affiliate page carries its own summary', typeof own.summary?.uniqueClicks === 'number', JSON.stringify(own.summary));

  const countries = await json(affiliate, '/click-logs/mine/countries');
  assert('affiliate country list is scoped and non-empty', Array.isArray(countries) && countries.length > 0, countries.join(','));

  // ------------------------------------------------- affiliate filter is ACTIVE (16)
  const activeOnly = await json(admin, '/affiliates?status=ACTIVE');
  assert('ACTIVE filter excludes pending applications', activeOnly.every((row) => row.status === 'ACTIVE'), `${activeOnly.length} affiliates`);
  const all = await json(admin, '/affiliates');
  assert('and the unfiltered list really does contain other statuses', all.length > activeOnly.length, `${all.length} total vs ${activeOnly.length} active`);

  // ------------------------------------------------------------ notifications (9)
  const adminNotifications = await json(admin, '/notifications?pageSize=50');
  assert('admin has notifications', adminNotifications.rows.length > 0, `${adminNotifications.total}`);
  assert('every notification is addressed to a user', adminNotifications.rows.every((row) => row.userId), '');

  const affiliateNotifications = await json(affiliate, '/notifications?pageSize=50');
  // The bug this replaced: an affiliate received every admin broadcast.
  assert(
    'affiliate does NOT see the network\'s notifications',
    affiliateNotifications.rows.every((row) => !adminNotifications.rows.some((a) => a.id === row.id)),
    `${affiliateNotifications.total} affiliate rows`,
  );

  const recent = await json(admin, '/notifications/recent');
  assert('bell preview returns at most 5', Array.isArray(recent) && recent.length <= 5, `${recent.length}`);

  // The IDOR: marking someone else's notification read must not work.
  const someoneElses = adminNotifications.rows[0];
  const stolen = await call(affiliate, `/notifications/${someoneElses.id}/read`, { method: 'PATCH' });
  check("cannot mark another user's notification read", stolen.status, 404);

  // ------------------------------------------- notifications are actually generated
  const before = (await json(affiliate, '/notifications/unread-count')).unread;
  const me = await json(affiliate, '/affiliates/me');
  await call(admin, `/affiliates/${me.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'ACTIVE' }) });
  // safeNotify is fire-and-forget, so give the insert a moment to land.
  await new Promise((resolve) => setTimeout(resolve, 600));
  const after = (await json(affiliate, '/notifications/unread-count')).unread;
  assert('approving an affiliate notifies them', after === before + 1, `${before} -> ${after}`);

  console.log(`\n${fail === 0 ? 'All checks passed' : `${fail} FAILED`} (${pass} passed)`);
  process.exit(fail === 0 ? 0 : 1);
})();
