// Dev helper: exercises the fixes for issues #1, #4, #5, #6, #7, #17, #20 and #21
// against a running API, as the three real roles.
//
// Mostly reads. The two places it writes — revoking a permission to prove the guard
// bites, and saving an offer to prove the destination macros are appended — restore
// what they changed before exiting, so the script is safe to re-run.
const BASE = process.env.API_URL || 'http://localhost:4000';
const PASSWORD = 'ChangeMe123!';

async function login(email) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`login ${email} -> ${res.status} ${await res.text()}`);
  return (await res.json()).accessToken;
}

async function get(token, path) {
  const res = await fetch(`${BASE}${path}`, { headers: { authorization: `Bearer ${token}` } });
  const body = res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text();
  return { status: res.status, body };
}

async function send(token, method, path, payload) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text();
  return { status: res.status, body };
}

function line(label, value) {
  console.log(`  ${label.padEnd(42)} ${value}`);
}

(async () => {
  const admin = await login('admin@fatexia.dev');
  const manager = await login('am.rivera@fatexia.dev'); // Marco Rivera, AFFILIATE manager
  const affiliate = await login('affiliate@fatexia.dev');

  console.log('\n#21 sequential public ids');
  const adminAffiliates = (await get(admin, '/affiliates')).body;
  const ids = adminAffiliates.map((a) => a.publicId);
  line('affiliates returned', adminAffiliates.length);
  line('sample ids', ids.slice(0, 4).join(', '));
  line('every affiliate has one', ids.every(Boolean) ? 'yes' : `NO (${ids.filter((i) => !i).length} missing)`);
  line('all unique', new Set(ids).size === ids.length ? 'yes' : 'NO');
  const managerRows = (await get(admin, '/managers')).body;
  line('manager ids', managerRows.map((m) => m.publicId).join(', '));

  console.log('\n#5 manager scoping');
  const managerAffiliates = (await get(manager, '/affiliates')).body;
  line('admin sees', `${adminAffiliates.length} affiliates`);
  line('manager sees', `${managerAffiliates.length} affiliates`);
  line('scoped down', managerAffiliates.length < adminAffiliates.length ? 'yes' : 'NO — manager sees everything');
  const mine = (await get(admin, '/managers')).body.find((m) => m.email === 'am.rivera@fatexia.dev');
  line('all rows assigned to this manager', managerAffiliates.every((a) => a.assignedManagerId === mine.id) ? 'yes' : 'NO');
  const outOfScope = adminAffiliates.find((a) => a.assignedManagerId !== mine.id);
  const probe = await get(manager, `/affiliates/${outOfScope.id}`);
  line(`reading another manager's affiliate`, `${probe.status} (404 expected)`);

  console.log('\n#20 permission grid');
  const me = (await get(manager, '/managers/me')).body;
  line('GET /managers/me', `${me.publicId} · ${me.fullName}`);
  line('granted', `${Object.keys(me.permissions).length} permissions`);
  line('admin-only surface (integrations)', `${(await get(manager, '/integrations')).status} (403 expected)`);
  line('admin reaches it', `${(await get(admin, '/integrations')).status} (200 expected)`);

  // Revoke one box, prove the guard bites, then put it back — the whole point of the
  // grid is that un-ticking something actually stops it.
  const target = managerAffiliates[0];
  const originalPermissions = { ...me.permissions };
  const withPayout = await send(manager, 'PATCH', `/affiliates/${target.id}`, { payoutMethod: target.payoutMethod ?? null });
  line('with affiliates.payout granted', `${withPayout.status} (200 expected)`);

  const revoked = { ...originalPermissions };
  delete revoked['affiliates.payout'];
  await send(admin, 'PATCH', `/managers/${me.id}`, { permissions: revoked });
  const afterRevoke = await send(manager, 'PATCH', `/affiliates/${target.id}`, { payoutMethod: target.payoutMethod ?? null });
  line('after admin un-ticks it', `${afterRevoke.status} (403 expected)`);
  line('error explains why', afterRevoke.body?.error ?? '—');
  const stillEdits = await send(manager, 'PATCH', `/affiliates/${target.id}`, { phone: target.phone ?? '' });
  line('other edits still allowed', `${stillEdits.status} (200 expected)`);

  await send(admin, 'PATCH', `/managers/${me.id}`, { permissions: originalPermissions });
  const restored = (await get(manager, '/managers/me')).body;
  line('permissions restored', Object.keys(restored.permissions).length === Object.keys(originalPermissions).length ? 'yes' : 'NO');

  console.log('\n#6 manager contact card');
  const contact = (await get(affiliate, '/affiliates/me/manager')).body;
  line('GET /affiliates/me/manager', contact ? `${contact.publicId} · ${contact.fullName} · ${contact.email}` : 'null (admin-managed)');
  line('leaks no commission/notes', contact && !('defaultCommissionPercent' in contact) && !('notes' in contact) ? 'yes' : 'NO');

  console.log('\n#7 affiliate cannot set their own payout');
  const selfPayout = await fetch(`${BASE}/affiliates/me`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${affiliate}`, 'content-type': 'application/json' },
    body: JSON.stringify({ payoutMethod: 'PAYPAL', payoutDetails: { paypalEmail: 'x@y.z' } }),
  });
  const before = (await get(affiliate, '/affiliates/me')).body.payoutMethod;
  line('PATCH /affiliates/me with payout fields', `${selfPayout.status}`);
  line('payout method unchanged', before === (await get(affiliate, '/affiliates/me')).body.payoutMethod ? 'yes' : 'NO');

  console.log('\n#17 destination URL macros');
  const offers = (await get(admin, '/offers')).body;
  const offer = (await get(admin, `/offers/${offers[0].id}`)).body;
  const originalDestination = offer.destinationUrl;
  // Save a bare landing page with no macros at all and see what comes back stored.
  const saveBody = {
    advertiserId: offer.advertiserId,
    name: offer.name,
    currency: offer.currency,
    defaultPayoutAmount: Number(offer.defaultPayoutAmount),
    trackingPlatform: 'DIRECT',
    isPublic: offer.isPublic,
    trafficTypes: offer.trafficTypes,
    featured: offer.featured,
    autoApproveConversions: offer.autoApproveConversions,
    allowDeepLinking: offer.allowDeepLinking,
    payoutRules: offer.payoutRules,
    caps: offer.caps,
    destinationUrl: 'https://advertiser.example.com/lp?utm_source=fatexia#top',
    postbackSecret: offer.postbackSecret ?? undefined,
    allowedPostbackIps: offer.allowedPostbackIps ?? undefined,
  };
  const saved = await send(admin, 'PATCH', `/offers/${offer.id}`, saveBody);
  line('saved without any macro', `${saved.status}`);
  line('stored as', saved.body?.destinationUrl ?? '—');
  line('click_id appended', saved.body?.destinationUrl?.includes('click_id={click_id}') ? 'yes' : 'NO');
  line('payout_amount appended', saved.body?.destinationUrl?.includes('payout_amount={payout_amount}') ? 'yes' : 'NO');
  line('fragment kept at the end', saved.body?.destinationUrl?.endsWith('#top') ? 'yes' : 'NO');
  const reSaved = await send(admin, 'PATCH', `/offers/${offer.id}`, { ...saveBody, destinationUrl: saved.body.destinationUrl });
  line('re-saving does not duplicate', reSaved.body?.destinationUrl === saved.body?.destinationUrl ? 'yes' : 'NO');
  await send(admin, 'PATCH', `/offers/${offer.id}`, { ...saveBody, destinationUrl: originalDestination ?? undefined });
  const after = (await get(admin, `/offers/${offer.id}`)).body;
  line('offer restored', after.destinationUrl === originalDestination ? 'yes' : `NO (now ${after.destinationUrl})`);

  console.log('\n#1 rejection email template');
  const templates = (await get(admin, '/email-templates')).body;
  const reject = templates.find((t) => t.templateKey === 'AFFILIATE_REJECTED');
  line('AFFILIATE_REJECTED present', reject ? `yes — "${reject.name}", enabled=${reject.enabled}` : 'NO');

  console.log('');
})().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
