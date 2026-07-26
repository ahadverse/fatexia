// Proves the two sides of a conversation track read state independently.
//
// `readAt` records that the *recipient* read a message, and which party that is
// depends on direction. This walks a full exchange and asserts that each side's
// acknowledgement moves only its own unread count.
const BASE = process.env.API_URL || 'http://localhost:4000';

async function login(email) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'ChangeMe123!' }),
  });
  if (!res.ok) throw new Error(`login failed for ${email}: ${res.status}`);
  const { accessToken } = await res.json();
  return { Authorization: `Bearer ${accessToken}` };
}

async function call(path, headers, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...headers, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status} ${JSON.stringify(body)}`);
  return body;
}

let failures = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(58)} got ${actual}, expected ${expected}`);
}

(async () => {
  const admin = await login('admin@fatexia.dev');
  const affiliate = await login('affiliate@fatexia.dev');

  // Identify the affiliate under test so the admin can act on the same thread.
  const me = await call('/affiliates/me', affiliate);
  const affiliateId = me.id;
  console.log(`testing thread for ${me.fullName} (${affiliateId})\n`);

  // Start from a clean slate on both sides.
  await call(`/messages/threads/${affiliateId}/read`, admin, { method: 'PATCH' });
  await call('/messages/mine/read', affiliate, { method: 'PATCH' });

  const adminBase = (await call('/messages/unread-count', admin)).unread;
  check('both sides start clear (affiliate)', (await call('/messages/mine/unread-count', affiliate)).unread, 0);

  // 1. The network writes to the affiliate.
  await call('/messages', admin, {
    method: 'POST',
    body: JSON.stringify({ affiliateId, body: 'From the network.' }),
  });
  check('network message raises affiliate unread', (await call('/messages/mine/unread-count', affiliate)).unread, 1);
  check("network message does not raise the network's own unread", (await call('/messages/unread-count', admin)).unread, adminBase);

  // 2. The affiliate writes back.
  await call('/messages/mine', affiliate, {
    method: 'POST',
    body: JSON.stringify({ body: 'From the affiliate.' }),
  });
  check('affiliate reply raises network unread', (await call('/messages/unread-count', admin)).unread, adminBase + 1);
  check('affiliate reply does not change their own unread', (await call('/messages/mine/unread-count', affiliate)).unread, 1);

  // 3. The admin acknowledges — this must not touch the affiliate's side.
  const adminMarked = await call(`/messages/threads/${affiliateId}/read`, admin, { method: 'PATCH' });
  check('admin ack clears the network unread', (await call('/messages/unread-count', admin)).unread, adminBase);
  check("admin ack leaves the affiliate's unread untouched", (await call('/messages/mine/unread-count', affiliate)).unread, 1);
  check('admin ack is a single bulk update', typeof adminMarked.marked, 'number');

  // 4. The affiliate acknowledges — the count that could never move before.
  await call('/messages/mine/read', affiliate, { method: 'PATCH' });
  check('affiliate ack clears their unread', (await call('/messages/mine/unread-count', affiliate)).unread, 0);
  check('affiliate ack leaves the network unread untouched', (await call('/messages/unread-count', admin)).unread, adminBase);

  // 5. Re-acknowledging is a no-op rather than a timestamp rewrite.
  const repeat = await call('/messages/mine/read', affiliate, { method: 'PATCH' });
  check('re-acknowledging marks nothing further', repeat.marked, 0);

  // 6. The thread list agrees with the counts, and is grouped server-side.
  const threads = await call('/messages/threads?pageSize=50', admin);
  const mine = threads.rows.find((row) => row.affiliateId === affiliateId);
  check('thread appears in the grouped list', Boolean(mine), true);
  check('thread unread matches the network count', mine.unreadCount, 0);
  check('thread carries a preview', typeof mine.lastPreview, 'string');

  // 7. The retired per-message route is gone, so neither side can clear the other's
  //    state through it.
  const detail = await call(`/messages/threads/${affiliateId}`, admin);
  const someId = detail.messages.at(-1).id;
  const legacy = await fetch(`${BASE}/messages/${someId}/read`, { method: 'PATCH', headers: admin });
  check('per-message read route no longer exists', legacy.status, 404);

  console.log(failures === 0 ? '\nMessaging read-state is correct on both sides' : `\n${failures} failure(s)`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
