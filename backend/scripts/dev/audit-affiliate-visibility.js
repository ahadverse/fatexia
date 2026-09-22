// Enforces PLAN-affiliate-portal.md's hard rule: an affiliate must never see revenue
// or profit. Logs in as the seeded affiliate, walks every affiliate-reachable
// endpoint, and fails if a forbidden key appears anywhere in the response — at any
// depth, so a nested payoutRule or report row can't smuggle one through. Also
// confirms the admin-only endpoints still 403.
const BASE = process.env.API_URL || 'http://localhost:4000';

// `revenueAmount` is the one legitimate appearance: the offers projection zeroes it
// server-side and the type keeps the field for shape-compatibility. It is asserted to
// be 0 rather than merely allowed.
const FORBIDDEN_KEYS = [
  // Money the network keeps.
  'revenue',
  'profit',
  'margin',
  'profitAmount',
  'revenueModel',
  // The network's fraud *reasoning*. An affiliate does see their own click's IP, user
  // agent, geo and quality band — that is their traffic and they need it to debug a
  // source. What they must not see is which signal caught them, because that is a
  // recipe for evading it.
  'asn',
  'asnNumber',
  'asnOrganization',
  'isDatacenter',
  'isProxyOrVpn',
  'riskScore',
  'leadRiskScore',
  // Where the address block is *registered*, as opposed to where the click came from.
  // A mismatch against the resolved country is how a VPN shows up, which makes this a
  // signal — the location fields beside it (city, postcode, coordinates, timezone) are
  // the visitor's whereabouts and are deliberately NOT forbidden.
  'registeredCountryCode',
  // MaxMind's own proxy/satellite traits, same reasoning.
  'isAnonymousProxy',
  'isSatelliteProvider',
  // The proxy-detection provider's answer beside its verdict. Same rule as the ASN
  // group: `proxyAsnNumber`/`proxyCountryCode` are a second, independent reading of what
  // `asnNumber`/`countryCode` already say, and the gap between the two is precisely the
  // signal — naming it to the traffic source is handing over the test. `proxyBlock` is
  // IPHub's raw verdict and `proxyProvider` names which vendor we pay for it.
  'proxyProvider',
  'proxyBlock',
  'proxyHostname',
  'proxyIsp',
  'proxyAsnNumber',
  'proxyCountryCode',
];
const ZEROED_KEYS = ['revenueAmount'];
// Forbidden rather than zeroed, unlike `revenueAmount` beside it. Zeroing works there
// because the affiliate row genuinely carries the key and a 0 is a truthful "withheld".
// Here null already means something specific — "the advertiser reported nothing" — so a
// nulled field would read as a fact about the conversion rather than as a redaction. The
// affiliate sees the payout their own rule produced; what the advertiser paid for the
// sale is the network's margin and never theirs to see.
FORBIDDEN_KEYS.push('reportedRevenue');

const AFFILIATE_ENDPOINTS = [
  '/auth/me',
  '/affiliates/me',
  '/affiliates/me/referrals',
  '/offers/available',
  '/offer-access-requests/mine',
  '/smart-links',
  '/dashboard/mine',
  '/reports/mine/grouped?groupBy=date',
  '/reports/mine/grouped?groupBy=offer',
  '/reports/mine/trend',
  '/conversions/mine?pageSize=5',
  '/click-logs/mine?pageSize=5',
  '/invoices/mine?pageSize=5',
  '/invoices/mine/balance',
  '/affiliate-points/mine?pageSize=5',
  '/messages/mine',
  '/messages/mine/unread-count',
  '/news/published',
  '/notifications?pageSize=5',
];

const ADMIN_ONLY = [
  '/dashboard',
  '/reports/grouped?groupBy=date',
  '/conversions',
  '/click-logs',
  '/invoices',
  '/affiliates',
  '/managers',
  '/advertisers',
  '/integrations',
  '/network-settings',
  '/affiliate-points',
  '/email-templates',
];

// Walks the whole response, reporting the JSON path of any offending key.
function findViolations(value, path = '$') {
  const hits = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => hits.push(...findViolations(item, `${path}[${index}]`)));
    return hits;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      const here = `${path}.${key}`;
      if (FORBIDDEN_KEYS.includes(key)) hits.push(`${here} = ${JSON.stringify(child)}`);
      if (ZEROED_KEYS.includes(key) && Number(child) !== 0) hits.push(`${here} = ${JSON.stringify(child)} (must be 0)`);
      hits.push(...findViolations(child, here));
    }
  }
  return hits;
}

(async () => {
  const login = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'affiliate@fatexia.dev', password: 'ChangeMe123!' }),
  });
  if (!login.ok) {
    console.error('LOGIN FAILED', login.status, await login.text());
    process.exit(1);
  }
  const { accessToken } = await login.json();
  const auth = { Authorization: `Bearer ${accessToken}` };
  console.log('affiliate login OK\n=== Affiliate endpoints (must not expose revenue/profit) ===');

  let failures = 0;

  for (const path of AFFILIATE_ENDPOINTS) {
    const res = await fetch(`${BASE}${path}`, { headers: auth });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      failures += 1;
      console.log(`FAIL ${String(res.status).padEnd(4)} ${path.padEnd(42)} ${JSON.stringify(body)}`);
      continue;
    }
    const violations = findViolations(body);
    if (violations.length) failures += 1;
    console.log(
      `${violations.length ? 'LEAK' : 'ok  '} ${String(res.status).padEnd(4)} ${path.padEnd(42)}${
        violations.length ? ` ${violations.slice(0, 3).join(', ')}` : ''
      }`,
    );
  }

  console.log('\n=== Admin-only endpoints (must 403 for an affiliate) ===');
  for (const path of ADMIN_ONLY) {
    const res = await fetch(`${BASE}${path}`, { headers: auth });
    const blocked = res.status === 403 || res.status === 401;
    if (!blocked) failures += 1;
    console.log(`${blocked ? 'ok  ' : 'LEAK'} ${String(res.status).padEnd(4)} ${path}`);
  }

  console.log(failures === 0 ? '\nMoney-visibility rule holds' : `\n${failures} violation(s)`);
  process.exit(failures === 0 ? 0 : 1);
})();
