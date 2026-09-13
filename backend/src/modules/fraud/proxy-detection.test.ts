import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The credential cascade.
 *
 * A provider can hold several API keys because the free tiers are metered per key, so
 * a second IPHub key is a second daily allowance. The properties that matter, and that
 * are easy to break without noticing:
 *
 *  - each key is spent in order, and an exhausted or failing one falls to the next;
 *  - quota is counted per key, never per provider — shared, the second key buys
 *    nothing, which is the whole reason it was added;
 *  - a provider's keys are all tried before the cascade moves to the next provider;
 *  - nothing here ever throws, because this sits on the click path where the
 *    fail-open rule says a dead provider costs a signal, not a redirect.
 *
 * Redis and the credential store are mocked; `fetch` is stubbed per key so a specific
 * key can be made to 429 or fail without a network.
 */
import { checkResidentialProxy } from './proxy-detection';

const { getCredentials, redisIncr, redisExpire, redisGet, redisSet } = vi.hoisted(() => ({
  getCredentials: vi.fn(),
  redisIncr: vi.fn(),
  redisExpire: vi.fn(async () => 1),
  redisGet: vi.fn(async () => null),
  redisSet: vi.fn(async () => 'OK'),
}));

vi.mock('../integrations/integration-credentials', () => ({ getIntegrationCredentials: getCredentials }));
vi.mock('../../infra/redis/redis-client', () => ({
  redis: { incr: redisIncr, expire: redisExpire, get: redisGet, set: redisSet },
}));

const IP = '203.0.113.9';

/** Per-key call counts, so a test can assert which keys were actually spent. */
let callsByKey: Record<string, number>;

/** Keys that should answer as though their daily allowance is gone. */
let exhausted: Set<string>;

/** Keys whose request should fail outright, as a dead provider would. */
let broken: Set<string>;

function keyFrom(init: RequestInit | undefined): string {
  return String((init?.headers as Record<string, string> | undefined)?.['X-Key'] ?? '');
}

beforeEach(() => {
  vi.clearAllMocks();
  callsByKey = {};
  exhausted = new Set();
  broken = new Set();

  // Quota available by default. Counted per credential id, so returning 1 every time
  // means "first call of the window for this key".
  redisIncr.mockResolvedValue(1);
  redisGet.mockResolvedValue(null);

  vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
    const key = keyFrom(init);
    callsByKey[key] = (callsByKey[key] ?? 0) + 1;
    if (broken.has(key)) throw new Error('network down');
    // IPHub answers 429 once the key's daily quota is spent.
    if (exhausted.has(key)) return { ok: false, status: 429 } as Response;
    // block: 1 is IPHub's "confirmed proxy".
    return { ok: true, json: async () => ({ block: 1 }) } as unknown as Response;
  });
});

function iphubKeys(...keys: string[]) {
  getCredentials.mockImplementation(async (provider: string) =>
    provider === 'IPHUB' ? keys.map((apiKey, index) => ({ id: `iphub-${index}`, apiKey })) : [],
  );
}

describe('credential cascade', () => {
  it('uses the first key and leaves the spares untouched', async () => {
    iphubKeys('key-a', 'key-b', 'key-c');

    await expect(checkResidentialProxy(IP)).resolves.toBe(true);

    expect(callsByKey['key-a']).toBe(1);
    expect(callsByKey['key-b']).toBeUndefined();
    expect(callsByKey['key-c']).toBeUndefined();
  });

  it('falls to the next key when one is exhausted at the provider', async () => {
    iphubKeys('key-a', 'key-b');
    exhausted.add('key-a');

    await expect(checkResidentialProxy(IP)).resolves.toBe(true);

    expect(callsByKey['key-a']).toBe(1);
    expect(callsByKey['key-b']).toBe(1);
  });

  it('falls to the next key when one fails outright', async () => {
    iphubKeys('key-a', 'key-b');
    broken.add('key-a');

    await expect(checkResidentialProxy(IP)).resolves.toBe(true);
    expect(callsByKey['key-b']).toBe(1);
  });

  it('skips a key whose local quota is already spent, without calling the provider', async () => {
    iphubKeys('key-a', 'key-b');
    // The first key's counter is past the daily limit; the second key's is not.
    redisIncr.mockImplementation(async (redisKey: string) => (redisKey.endsWith('iphub-0') ? 5000 : 1));

    await expect(checkResidentialProxy(IP)).resolves.toBe(true);

    // Never called: local quota is what protects the provider's rate limit, so an
    // exhausted key must not produce a request at all.
    expect(callsByKey['key-a']).toBeUndefined();
    expect(callsByKey['key-b']).toBe(1);
  });

  it('counts quota per key, not per provider', async () => {
    iphubKeys('key-a', 'key-b', 'key-c');
    await checkResidentialProxy(IP);

    // Only the key that was actually used should have been counted — a provider-wide
    // counter would have been incremented once for the provider instead.
    const counted = redisIncr.mock.calls.map(([key]) => String(key));
    expect(counted).toEqual(['proxy-detect:quota:iphub-0']);
  });

  it('moves to the next provider only after every key is spent', async () => {
    getCredentials.mockImplementation(async (provider: string) => {
      if (provider === 'IPHUB') {
        return [
          { id: 'iphub-0', apiKey: 'key-a' },
          { id: 'iphub-1', apiKey: 'key-b' },
        ];
      }
      if (provider === 'IPAPI_IS') return [{ id: 'ipapi-0', apiKey: 'key-ipapi' }];
      return [];
    });
    exhausted.add('key-a');
    exhausted.add('key-b');

    // ipapi.is takes the key in the query string rather than a header, so it lands
    // under the empty-header bucket — what matters is that both IPHub keys were tried
    // before anything else was.
    await checkResidentialProxy(IP);

    expect(callsByKey['key-a']).toBe(1);
    expect(callsByKey['key-b']).toBe(1);
    expect(getCredentials.mock.calls.map(([provider]) => provider)).toEqual(['IPHUB', 'IPAPI_IS']);
  });

  it('returns null rather than throwing when every credential is gone', async () => {
    getCredentials.mockResolvedValue([]);

    // null is "never scored", which the caller records as UNSCORED — not "clean".
    await expect(checkResidentialProxy(IP)).resolves.toBeNull();
  });

  it('never spends a key on a private address', async () => {
    iphubKeys('key-a');

    await expect(checkResidentialProxy('127.0.0.1')).resolves.toBeNull();
    expect(callsByKey['key-a']).toBeUndefined();
    expect(redisIncr).not.toHaveBeenCalled();
  });
});
