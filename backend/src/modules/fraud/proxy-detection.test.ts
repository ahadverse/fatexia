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

/** The IPHub body the stub answers with; individual tests reshape it. */
let iphubBody: Record<string, unknown>;

function keyFrom(init: RequestInit | undefined): string {
  return String((init?.headers as Record<string, string> | undefined)?.['X-Key'] ?? '');
}

beforeEach(() => {
  vi.clearAllMocks();
  callsByKey = {};
  exhausted = new Set();
  broken = new Set();
  iphubBody = {
    ip: IP,
    countryCode: 'US',
    countryName: 'United States',
    asn: 7922,
    isp: 'Comcast Cable Communications, LLC',
    hostname: 'c-24-60-1-25.hsd1.ma.comcast.net',
    block: 1,
  };

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
    // A whole IPHub record, not just the verdict — the body shape is what the parsing
    // tests below are about. block: 1 is its "confirmed proxy".
    return { ok: true, json: async () => ({ ...iphubBody }) } as unknown as Response;
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

    await expect(checkResidentialProxy(IP)).resolves.toMatchObject({ flagged: true });

    expect(callsByKey['key-a']).toBe(1);
    expect(callsByKey['key-b']).toBeUndefined();
    expect(callsByKey['key-c']).toBeUndefined();
  });

  it('falls to the next key when one is exhausted at the provider', async () => {
    iphubKeys('key-a', 'key-b');
    exhausted.add('key-a');

    await expect(checkResidentialProxy(IP)).resolves.toMatchObject({ flagged: true });

    expect(callsByKey['key-a']).toBe(1);
    expect(callsByKey['key-b']).toBe(1);
  });

  it('falls to the next key when one fails outright', async () => {
    iphubKeys('key-a', 'key-b');
    broken.add('key-a');

    await expect(checkResidentialProxy(IP)).resolves.toMatchObject({ flagged: true });
    expect(callsByKey['key-b']).toBe(1);
  });

  it('skips a key whose local quota is already spent, without calling the provider', async () => {
    iphubKeys('key-a', 'key-b');
    // The first key's counter is past the daily limit; the second key's is not.
    redisIncr.mockImplementation(async (redisKey: string) => (redisKey.endsWith('iphub-0') ? 5000 : 1));

    await expect(checkResidentialProxy(IP)).resolves.toMatchObject({ flagged: true });

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

/**
 * What the lookup keeps.
 *
 * The call is metered — a thousand a day per key — and for a long time six of IPHub's
 * seven fields were parsed and dropped, so the tests here exist to stop that quietly
 * happening again. They assert on the whole verdict rather than on `flagged`, because
 * the failure being guarded against is one where `flagged` stays perfectly correct.
 */
describe('provider response capture', () => {
  it('keeps every field IPHub answered with, not just the verdict', async () => {
    iphubKeys('key-a');

    await expect(checkResidentialProxy(IP)).resolves.toEqual({
      provider: 'IPHUB',
      flagged: true,
      block: 1,
      hostname: 'c-24-60-1-25.hsd1.ma.comcast.net',
      isp: 'Comcast Cable Communications, LLC',
      asnNumber: 7922,
      countryCode: 'US',
    });
  });

  it('records which provider in the cascade actually answered', async () => {
    getCredentials.mockImplementation(async (provider: string) =>
      provider === 'IPAPI_IS' ? [{ id: 'ipapi-0', apiKey: 'key-ipapi' }] : [],
    );
    vi.stubGlobal('fetch', async () => ({
      ok: true,
      json: async () => ({ is_datacenter: true, rdns: 'ec2-1-2-3-4.compute.amazonaws.com', asn: { asn: 16509, org: 'Amazon' } }),
    }));

    // Which vendor produced a verdict matters when reading a row back: the fallbacks
    // answer with thinner data, so a null hostname means something different depending
    // on who was asked.
    await expect(checkResidentialProxy(IP)).resolves.toMatchObject({
      provider: 'IPAPI_IS',
      flagged: true,
      block: null,
      hostname: 'ec2-1-2-3-4.compute.amazonaws.com',
      asnNumber: 16509,
    });
  });

  describe("IPHub's three states", () => {
    // The bug this replaces: `block === 1` was the only thing kept, so 2 and 0 were
    // stored identically and a non-residential address read as confidently clean.
    it('keeps block 2 distinguishable from block 0', async () => {
      iphubKeys('key-a');
      iphubBody.block = 2;

      const nonResidential = await checkResidentialProxy(IP);
      expect(nonResidential).toMatchObject({ block: 2, flagged: false });

      redisGet.mockResolvedValue(null);
      iphubBody.block = 0;
      const residential = await checkResidentialProxy(IP);
      expect(residential).toMatchObject({ block: 0, flagged: false });

      // Same verdict, different answer — which is the entire point of storing `block`.
      expect(nonResidential?.block).not.toBe(residential?.block);
    });

    it('still flags only block 1', async () => {
      iphubKeys('key-a');
      iphubBody.block = 0;

      await expect(checkResidentialProxy(IP)).resolves.toMatchObject({ flagged: false, block: 0 });
    });
  });

  describe('defensive parsing', () => {
    it('costs one field, not the verdict, when the provider drops one', async () => {
      iphubKeys('key-a');
      delete iphubBody.hostname;
      delete iphubBody.isp;

      // The classification is what the click path is waiting on; a renamed field must
      // never be able to take it down.
      await expect(checkResidentialProxy(IP)).resolves.toMatchObject({
        flagged: true,
        hostname: null,
        isp: null,
        asnNumber: 7922,
      });
    });

    it('reads an ASN that arrives as a string', async () => {
      iphubKeys('key-a');
      iphubBody.asn = 'AS7922';

      await expect(checkResidentialProxy(IP)).resolves.toMatchObject({ asnNumber: 7922 });
    });

    it('treats an empty string as absent rather than storing one', async () => {
      iphubKeys('key-a');
      iphubBody.hostname = '   ';

      await expect(checkResidentialProxy(IP)).resolves.toMatchObject({ hostname: null });
    });
  });

  describe('cache', () => {
    it('round-trips the whole verdict, so a cached click keeps the same columns', async () => {
      iphubKeys('key-a');

      const fresh = await checkResidentialProxy(IP);
      const [, cached] = redisSet.mock.calls[0] as unknown as [string, string];

      // The regression guarded against: when the cache held '1'/'0', the first click
      // from an address recorded a hostname and every click after it recorded null.
      redisGet.mockResolvedValue(cached);
      await expect(checkResidentialProxy(IP)).resolves.toEqual(fresh);
    });

    it('does not answer from a pre-existing boolean entry', async () => {
      iphubKeys('key-a');
      // What the old cache held — and the reason this needs a test rather than a catch
      // block: `JSON.parse('1')` does not throw, it returns the number 1. Nothing about
      // reading it fails, so without a shape check it reaches the click path as a
      // verdict whose every field is undefined.
      redisGet.mockResolvedValue('1');

      await expect(checkResidentialProxy(IP)).resolves.toMatchObject({ hostname: iphubBody.hostname });
      expect(callsByKey['key-a']).toBe(1);
    });
  });
});
