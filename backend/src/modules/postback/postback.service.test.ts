import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../../common/errors';
import { ConversionStatus } from '../conversions/conversion.entity';
import { PayoutMode, PayoutType, RevenueModel, type PayoutRule } from '../offers/payout-rule.entity';

/**
 * The inbound postback is where an advertiser's HTTP request turns into money owed,
 * so it is the one place the money-integrity rule from PLAN-backend.md has to hold
 * under adversarial input: the payload is authenticated, then ignored for pricing.
 *
 * Every repository is mocked — this is about the decision logic, not about Postgres.
 */
import { postbackService } from './postback.service';

// `vi.hoisted` because `vi.mock` is lifted above the imports (see the note in
// payout-resolution.test.ts).
const { findOffer, markPostbackVerified, findClick, findConversionByClickId, createConversion, createLog, findGlobalPostbacks } = vi.hoisted(
  () => ({
    findOffer: vi.fn(),
    markPostbackVerified: vi.fn(),
    findClick: vi.fn(),
    findGlobalPostbacks: vi.fn(async () => []),
    findConversionByClickId: vi.fn(),
    createConversion: vi.fn(),
    createLog: vi.fn(),
  }),
);

vi.mock('../offers/offer.repository', () => ({
  offerRepository: { findByIdWithPayoutRules: findOffer, markPostbackVerified },
}));
vi.mock('../clicks/click.repository', () => ({ clickRepository: { findById: findClick } }));
vi.mock('../conversions/conversion.repository', () => ({
  conversionRepository: { findByClickId: findConversionByClickId, create: createConversion },
}));
vi.mock('../postback-logs/postback-log.repository', () => ({ postbackLogRepository: { create: createLog } }));
vi.mock('../affiliate-groups/affiliate-group.repository', () => ({
  affiliateGroupRepository: { findAll: async () => [] },
}));
// Consulted on every rejected postback, to see whether a network-level entry authorises
// what the offer's own credentials did not. Empty here so these cases still test the
// per-offer check in isolation; the global path has its own coverage below.
vi.mock('../global-postbacks/global-postback.repository', () => ({
  globalPostbackRepository: { findEnabled: findGlobalPostbacks, markUsed: vi.fn() },
}));
vi.mock('../smart-links/smart-link.repository', () => ({ smartLinkRepository: { findById: async () => null } }));

const SECRET = 'sk_correct_secret';
const IP = '203.0.113.10';

function rule(overrides: Partial<PayoutRule> = {}): PayoutRule {
  return {
    id: 'rule-1',
    offerId: 'offer-1',
    payoutMode: PayoutMode.CPA,
    payoutType: PayoutType.FLAT,
    amount: '25.00',
    revenueModel: RevenueModel.NONE,
    revenueAmount: '60.00',
    targeting: { countries: [], devices: [], os: [], affiliateIds: [], affiliateGroupIds: [] },
    managerCommissionPercent: 0,
    referAffiliateCommissionPercent: 0,
    holdEnabled: false,
    holdDays: 0,
    commissionPercent: 0,
    createdAt: new Date(),
    ...overrides,
  } as PayoutRule;
}

function offer(overrides: Record<string, unknown> = {}) {
  return {
    id: 'offer-1',
    currency: 'USD',
    postbackSecret: SECRET,
    allowedPostbackIps: `${IP}, 198.51.100.4`,
    autoApproveConversions: false,
    payoutRules: [rule()],
    ...overrides,
  };
}

function click(overrides: Record<string, unknown> = {}) {
  return {
    id: 'click-1',
    offerId: 'offer-1',
    affiliateId: 'aff-1',
    createdAt: new Date(Date.now() - 60_000),
    countryCode: 'US',
    deviceType: 'desktop',
    os: 'Windows',
    subId1: 's1',
    ...overrides,
  };
}

function request(overrides: Partial<Parameters<typeof postbackService.handlePostback>[0]> = {}) {
  return {
    offerId: 'offer-1',
    clickId: 'click-1',
    secret: SECRET,
    transactionId: 'txn-9',
    sourceIp: IP,
    rawQuery: {},
    ...overrides,
  };
}

/** The fields the service decided, as written to the conversions table. */
function written() {
  return createConversion.mock.calls[0]![0] as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  findOffer.mockResolvedValue(offer());
  findClick.mockResolvedValue(click());
  findConversionByClickId.mockResolvedValue(null);
  createConversion.mockImplementation(async (data: Record<string, unknown>) => ({ id: 'conv-1', ...data }));
  createLog.mockResolvedValue(undefined);
  markPostbackVerified.mockResolvedValue(undefined);
});

describe('postback verification signal', () => {
  /**
   * `postbackVerifiedAt` is stamped the first time a genuinely authenticated postback
   * arrives. It is an observational signal for admins, deliberately not an approval
   * gate — see the cycle described in offer.service.ts's assertActivationGate.
   */
  it('stamps the offer on the first authenticated postback', async () => {
    await postbackService.handlePostback(request());
    expect(markPostbackVerified).toHaveBeenCalledWith('offer-1', expect.any(Date));
  });

  it('does not re-stamp an already-verified offer', async () => {
    findOffer.mockResolvedValue(offer({ postbackVerifiedAt: new Date('2026-01-01') }));
    await postbackService.handlePostback(request());
    expect(markPostbackVerified).not.toHaveBeenCalled();
  });

  it('never stamps an offer whose secret did not match', async () => {
    await expect(postbackService.handlePostback(request({ secret: 'sk_wrong' }))).rejects.toThrow();
    expect(markPostbackVerified).not.toHaveBeenCalled();
  });
});

describe('authentication', () => {
  it('rejects a wrong secret', async () => {
    await expect(postbackService.handlePostback(request({ secret: 'sk_wrong' }))).rejects.toBeInstanceOf(NotFoundError);
    expect(createConversion).not.toHaveBeenCalled();
  });

  it('rejects a source IP that is not on the allowlist', async () => {
    await expect(postbackService.handlePostback(request({ sourceIp: '198.51.100.99' }))).rejects.toBeInstanceOf(NotFoundError);
    expect(createConversion).not.toHaveBeenCalled();
  });

  it('accepts any IP on the comma-separated allowlist, whitespace and all', async () => {
    await expect(postbackService.handlePostback(request({ sourceIp: '198.51.100.4' }))).resolves.toBeDefined();
  });

  it.each([
    ['an unknown offer', () => findOffer.mockResolvedValue(null)],
    ['an offer with no secret configured', () => findOffer.mockResolvedValue(offer({ postbackSecret: null }))],
    ['an offer with no IP allowlist', () => findOffer.mockResolvedValue(offer({ allowedPostbackIps: null }))],
  ])('gives the same generic failure for %s', async (_case, arrange) => {
    arrange();
    // Identical to the wrong-secret rejection on purpose: a distinguishable response
    // would let a caller probe for valid offer ids by trying secrets against them.
    await expect(postbackService.handlePostback(request())).rejects.toBeInstanceOf(NotFoundError);
  });

  it('logs every rejected attempt', async () => {
    await expect(postbackService.handlePostback(request({ secret: 'sk_wrong' }))).rejects.toThrow();
    expect(createLog).toHaveBeenCalledWith(expect.objectContaining({ success: false, sourceIp: IP }));
  });
});

describe('money integrity', () => {
  /**
   * The heart of it: the advertiser controls the query string, so if anything in the
   * payload could raise the payout, an advertiser (or anyone who learned the secret)
   * could mint money. Both amounts must come from the offer's own rule.
   */
  it('ignores payout and revenue claimed in the payload', async () => {
    await postbackService.handlePostback(
      request({ rawQuery: { payout: '9999.00', revenue: '9999.00', payout_amount: '9999.00', amount: '9999' } }),
    );
    expect(written()).toMatchObject({ payoutAmount: '25.00', revenueAmount: '60.00' });
  });

  it('prices a percentage rule from the rule’s own revenue', async () => {
    findOffer.mockResolvedValue(
      offer({ payoutRules: [rule({ payoutType: PayoutType.PERCENTAGE, amount: '20', revenueAmount: '150.00' })] }),
    );
    await postbackService.handlePostback(request({ rawQuery: { sale_amount: '100000' } }));
    expect(written()).toMatchObject({ payoutAmount: '30.00', revenueAmount: '150.00' });
  });

  it('records zero rather than guessing when the offer has no payout rule', async () => {
    findOffer.mockResolvedValue(offer({ payoutRules: [] }));
    await postbackService.handlePostback(request());
    expect(written()).toMatchObject({ payoutAmount: '0.00', revenueAmount: '0.00' });
  });

  it('stores amounts at two decimal places', async () => {
    findOffer.mockResolvedValue(offer({ payoutRules: [rule({ amount: '7.5' })] }));
    await postbackService.handlePostback(request());
    expect(written().payoutAmount).toBe('7.50');
  });
});

describe('click attribution', () => {
  it('attributes a conversion to the affiliate who earned the click', async () => {
    await postbackService.handlePostback(request());
    expect(written()).toMatchObject({ clickId: 'click-1', affiliateId: 'aff-1', isOrphan: false, subId1: 's1' });
  });

  /**
   * A click_id that resolves but belongs to another offer must never be attributed —
   * that would pay one affiliate for another's traffic.
   */
  it('treats a click from a different offer as no click at all', async () => {
    findClick.mockResolvedValue(click({ offerId: 'some-other-offer' }));
    await postbackService.handlePostback(request());
    expect(written()).toMatchObject({ clickId: null, affiliateId: null, isOrphan: true });
  });

  it('records an unmatched click_id as an orphan rather than failing', async () => {
    findClick.mockResolvedValue(null);
    await postbackService.handlePostback(request({ clickId: 'nope' }));
    expect(written()).toMatchObject({ isOrphan: true, clickId: null });
  });

  it('measures click-to-install time from the click', async () => {
    await postbackService.handlePostback(request());
    expect(written().ctitMs).toBeGreaterThanOrEqual(60_000);
  });

  it('has no CTIT for an orphan', async () => {
    findClick.mockResolvedValue(null);
    await postbackService.handlePostback(request());
    expect(written().ctitMs).toBeNull();
  });
});

describe('duplicates', () => {
  beforeEach(() => {
    findConversionByClickId.mockResolvedValue({ id: 'conv-existing' });
  });

  it('records a second fire on the same click as DUPLICATE', async () => {
    await postbackService.handlePostback(request());
    expect(written()).toMatchObject({ status: ConversionStatus.DUPLICATE, isDuplicate: true });
  });

  // Recorded but worth nothing, so an accidental double-fire cannot inflate totals
  // before a human reviews it.
  it('zeroes the money on a duplicate', async () => {
    await postbackService.handlePostback(request());
    expect(written()).toMatchObject({ payoutAmount: '0.00', revenueAmount: '0.00' });
  });

  it('stays DUPLICATE even when the offer auto-approves', async () => {
    findOffer.mockResolvedValue(offer({ autoApproveConversions: true }));
    await postbackService.handlePostback(request());
    expect(written().status).toBe(ConversionStatus.DUPLICATE);
  });
});

describe('approval status', () => {
  it('holds a conversion PENDING by default', async () => {
    await postbackService.handlePostback(request());
    expect(written()).toMatchObject({ status: ConversionStatus.PENDING, approvedAt: null });
  });

  it('auto-approves when the offer says so', async () => {
    findOffer.mockResolvedValue(offer({ autoApproveConversions: true }));
    await postbackService.handlePostback(request());
    expect(written().status).toBe(ConversionStatus.APPROVED);
    expect(written().approvedAt).toBeInstanceOf(Date);
  });

  // The rule's hold wins over the offer's auto-approve — a hold exists precisely to
  // stop money being approved automatically.
  it('respects a rule hold over auto-approve', async () => {
    findOffer.mockResolvedValue(offer({ autoApproveConversions: true, payoutRules: [rule({ holdEnabled: true, holdDays: 30 })] }));
    await postbackService.handlePostback(request());
    expect(written()).toMatchObject({ status: ConversionStatus.PENDING, approvedAt: null });
  });
});

describe('global postback', () => {
  const GLOBAL_SECRET = 'pb_network_wide_secret';

  /**
   * The case the feature exists for, and the one the first implementation could not
   * reach: an offer with no credentials of its own. The per-offer gate rejected it
   * before the network-level entry was ever consulted.
   */
  it('authorises an offer that has no postback credentials of its own', async () => {
    findOffer.mockResolvedValue(offer({ postbackSecret: null, allowedPostbackIps: null }));
    findGlobalPostbacks.mockResolvedValue([{ id: 'gp-1', secret: GLOBAL_SECRET, allowedIps: null }]);

    await expect(postbackService.handlePostback(request({ secret: GLOBAL_SECRET }))).resolves.toBeDefined();
    expect(createConversion).toHaveBeenCalled();
  });

  // One URL for the whole catalogue: the caller cannot name our offer, because their
  // own offer-id macro is their id, not ours.
  it('resolves the offer from the click when no offerId is sent', async () => {
    findGlobalPostbacks.mockResolvedValue([{ id: 'gp-1', secret: GLOBAL_SECRET, allowedIps: null }]);

    await expect(postbackService.handlePostback(request({ offerId: null, secret: GLOBAL_SECRET }))).resolves.toBeDefined();
    expect(written().offerId).toBe('offer-1');
  });

  it('rejects a global secret that does not match any entry', async () => {
    findGlobalPostbacks.mockResolvedValue([{ id: 'gp-1', secret: GLOBAL_SECRET, allowedIps: null }]);

    await expect(postbackService.handlePostback(request({ secret: 'pb_wrong' }))).rejects.toBeInstanceOf(NotFoundError);
    expect(createConversion).not.toHaveBeenCalled();
  });

  it('honours the allowlist on a global entry that sets one', async () => {
    findOffer.mockResolvedValue(offer({ postbackSecret: null, allowedPostbackIps: null }));
    findGlobalPostbacks.mockResolvedValue([{ id: 'gp-1', secret: GLOBAL_SECRET, allowedIps: '198.51.100.7' }]);

    await expect(
      postbackService.handlePostback(request({ secret: GLOBAL_SECRET, sourceIp: '203.0.113.99' })),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  // A disabled entry is still a row in the table; it must stop authorising immediately.
  it('ignores entries the repository does not return as enabled', async () => {
    findOffer.mockResolvedValue(offer({ postbackSecret: null, allowedPostbackIps: null }));
    findGlobalPostbacks.mockResolvedValue([]);

    await expect(postbackService.handlePostback(request({ secret: GLOBAL_SECRET }))).rejects.toBeInstanceOf(NotFoundError);
  });

  // Without a click there is nothing to name the offer, and nothing to attribute to.
  it('rejects when neither an offerId nor a resolvable click is present', async () => {
    findClick.mockResolvedValue(null);
    findGlobalPostbacks.mockResolvedValue([{ id: 'gp-1', secret: GLOBAL_SECRET, allowedIps: null }]);

    await expect(postbackService.handlePostback(request({ offerId: null, secret: GLOBAL_SECRET }))).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  // The per-offer URLs already handed out keep working unchanged.
  it('still accepts a correct per-offer secret with no global entries configured', async () => {
    findGlobalPostbacks.mockResolvedValue([]);
    await expect(postbackService.handlePostback(request())).resolves.toBeDefined();
  });
});
