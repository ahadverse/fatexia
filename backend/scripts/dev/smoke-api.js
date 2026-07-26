// Dev helper: logs in as the seeded admin and GETs every Admin-portal endpoint,
// reporting status and a short shape summary so a broken route is obvious.
const BASE = process.env.API_URL || 'http://localhost:4000';

const ENDPOINTS = [
  '/dashboard',
  '/offers', '/offer-categories', '/offer-access-requests', '/smart-links',
  '/advertisers', '/affiliates', '/affiliate-groups', '/affiliate-points', '/affiliate-points/balances',
  '/managers',
  '/click-logs?pageSize=5', '/conversions?pageSize=5', '/postback-logs?pageSize=5',
  '/invoices?pageSize=5', '/invoices/pending-balances', '/subscriptions',
  '/messages?pageSize=5', '/messages/threads', '/messages/unread-count',
  '/notifications?pageSize=5', '/notifications/unread-count',
  '/news', '/email-templates', '/network-settings', '/integrations',
  '/reports/grouped?groupBy=date', '/reports/grouped?groupBy=offer', '/reports/grouped?groupBy=affiliate',
  '/reports/grouped?groupBy=advertiser', '/reports/grouped?groupBy=country', '/reports/grouped?groupBy=device',
  '/reports/grouped?groupBy=subId1', '/reports/trend',
  '/reports/cr/offers?minClicks=1', '/reports/cr/affiliates?minClicks=1', '/reports/cr/affiliate-offer',
];

function summarize(body) {
  if (Array.isArray(body)) return `array(${body.length})`;
  if (body && Array.isArray(body.rows)) return `rows(${body.rows.length}) total=${body.total ?? '?'}`;
  if (body && typeof body === 'object') return `object{${Object.keys(body).slice(0, 5).join(',')}}`;
  return typeof body;
}

(async () => {
  const login = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@fatexia.dev', password: 'ChangeMe123!' }),
  });
  if (!login.ok) {
    console.error('LOGIN FAILED', login.status, await login.text());
    process.exit(1);
  }
  const { accessToken } = await login.json();
  console.log('login OK\n');

  let failures = 0;
  for (const path of ENDPOINTS) {
    const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const body = await res.json().catch(() => null);
    const ok = res.ok ? 'ok ' : 'FAIL';
    if (!res.ok) failures += 1;
    console.log(`${ok} ${String(res.status).padEnd(4)} ${path.padEnd(46)} ${res.ok ? summarize(body) : JSON.stringify(body)}`);
  }
  console.log(failures === 0 ? '\nAll endpoints OK' : `\n${failures} endpoint(s) failed`);
  process.exit(failures === 0 ? 0 : 1);
})();
