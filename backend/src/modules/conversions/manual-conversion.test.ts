import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConversionStatus } from './conversion.entity';
import { PayoutMode, PayoutType, RevenueModel, type PayoutRule } from '../offers/payout-rule.entity';

/**
 * An admin recording a conversion no advertiser ever posted back.
 *
 * The risk this covers is not the happy path but the pricing: the whole point of the
 * feature is that someone is already working around normal tracking, which is exactly
 * when a hand-typed payout would slip in. So these check that the amount, the status and
 * the affiliate all come from the same places the postback path takes them from, and
 * that the two cases where there is no honest answer — a click that already converted,
 * an offer with no payout rule — are refused rather than guessed at.
 */
import { conversionService } from './conversion.service';

const { findOffer, findClick, findConversionByClickId, createConversion, findConversionById, sendPostback, findSmartLink, announce } =
  vi.hoisted(() => ({
    findOffer: vi.fn(),
    findClick: vi.fn(),
    findConversionByClickId: vi.fn(),
    createConversion: vi.fn(),
    findConversionById: vi.fn(),
    sendPostback: vi.fn(),
    findSmartLink: vi.fn(),
    announce: vi.fn(),
  }));

vi.mock('../offers/offer.repository', () => ({ offerRepository: { findForClick: findOffer } }));
vi.mock('../clicks/click.repository', () => ({
  clickRepository: { findByPostbackId: findClick, refIdsByIds: async () => new Map() },
}));
vi.mock('./conversion.repository', () => ({
  conversionRepository: {
    findByClickId: findConversionByClickId,
    create: createConversion,
    findById: findConversionById,
  },
}));
vi.mock('../smart-links/smart-link.repository', () => ({ smartLinkRepository: { findById: findSmartLink } }));
vi.mock('../postback/outbound-postback.service', () => ({ safeSendConversionPostback: sendPostback }));
vi.mock('./conversion-announce', () => ({ announceConversion: announce }));
vi.mock('../affiliate-groups/affiliate-group.repository', () => ({ affiliateGroupRepository: { findAll: async () => [] } }));
vi.mock('../../common/entity-names', () => ({ offerNames: async () => new Map(), affiliateNames: async () => new Map() }));

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
  return { id: 'offer-1', currency: 'USD', autoApproveConversions: true, payoutRules: [rule()], ...overrides };
}

function click(overrides: Record<string, unknown> = {}) {
  return {
    id: 'click-1',
    refId: 201044,
    offerId: 'offer-1',
    affiliateId: 'aff-1',
    smartLinkId: null,
    createdAt: new Date(Date.now() - 60_000),
    countryCode: 'US',
    deviceType: 'mobile',
    os: 'Android',
    subId1: 's1',
    subId2: null,
    ...overrides,
  };
}

/** The fields the service decided, as written to the conversions table. */
function written(): Record<string, unknown> {
  return createConversion.mock.calls[0]![0] as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  findClick.mockResolvedValue(click());
  findOffer.mockResolvedValue(offer());
  findConversionByClickId.mockResolvedValue(null);
  findSmartLink.mockResolvedValue(null);
  createConversion.mockImplementation(async (data: Record<string, unknown>) => ({ id: 'conv-1', refId: 300412, ...data }));
  findConversionById.mockImplementation(async () => ({
    ...(createConversion.mock.calls[0]?.[0] ?? {}),
    id: 'conv-1',
    refId: 300412,
    createdAt: new Date(),
    approvedAt: null,
    paidAt: null,
    leadRiskScore: 0,
  }));
});

describe('pricing', () => {
  it('takes both amounts from the offer’s payout rule, not from the caller', async () => {
    await conversionService.createForClick({ clickId: 'click-1' });

    expect(written().payoutAmount).toBe('25.00');
    expect(written().revenueAmount).toBe('60.00');
    expect(written().currency).toBe('USD');
  });

  it('prices a smart-link click against that link’s revenue share', async () => {
    findClick.mockResolvedValue(click({ smartLinkId: 'sl-1' }));
    findSmartLink.mockResolvedValue({ id: 'sl-1', revSharePercent: '50' });

    await conversionService.createForClick({ clickId: 'click-1' });

    // Half of the advertiser's 60, not the rule's own flat 25.
    expect(written().payoutAmount).toBe('30.00');
    expect(written().revenueAmount).toBe('60.00');
  });

  it('refuses an offer with no payout rule rather than booking a worthless conversion', async () => {
    findOffer.mockResolvedValue(offer({ payoutRules: [] }));

    await expect(conversionService.createForClick({ clickId: 'click-1' })).rejects.toThrow(/no payout rule/i);
    expect(createConversion).not.toHaveBeenCalled();
  });
});

describe('status', () => {
  it('approves when the offer auto-approves and the rule has no hold', async () => {
    await conversionService.createForClick({ clickId: 'click-1' });

    expect(written().status).toBe(ConversionStatus.APPROVED);
    expect(written().approvedAt).toBeInstanceOf(Date);
    // The affiliate's own tracker hears about it, exactly as for an auto-approved postback.
    expect(sendPostback).toHaveBeenCalledTimes(1);
  });

  it('stays pending when the offer does not auto-approve', async () => {
    findOffer.mockResolvedValue(offer({ autoApproveConversions: false }));

    await conversionService.createForClick({ clickId: 'click-1' });

    expect(written().status).toBe(ConversionStatus.PENDING);
    expect(written().approvedAt).toBeNull();
    expect(sendPostback).not.toHaveBeenCalled();
  });

  it('stays pending when the rule holds, even on an auto-approve offer', async () => {
    findOffer.mockResolvedValue(offer({ payoutRules: [rule({ holdEnabled: true, holdDays: 7 })] }));

    await conversionService.createForClick({ clickId: 'click-1' });

    expect(written().status).toBe(ConversionStatus.PENDING);
  });
});

describe('what it refuses', () => {
  it('refuses a click that already has a conversion, naming it', async () => {
    findConversionByClickId.mockResolvedValue({ id: 'conv-0', refId: 300001, status: ConversionStatus.APPROVED });

    await expect(conversionService.createForClick({ clickId: 'click-1' })).rejects.toThrow(/already has conversion #300001/);
    expect(createConversion).not.toHaveBeenCalled();
  });

  it('refuses a click ID that matches nothing', async () => {
    findClick.mockResolvedValue(null);

    await expect(conversionService.createForClick({ clickId: '1235' })).rejects.toThrow(/No click found/);
    expect(createConversion).not.toHaveBeenCalled();
  });
});

describe('announcement', () => {
  // The alert an admin hears is supposed to fire however a conversion got there, so the
  // manual path has to announce itself exactly as the postback path does.
  it('announces the conversion as manually added', async () => {
    await conversionService.createForClick({ clickId: 'click-1' });

    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce.mock.calls[0]![1]).toBe('manual');
  });

  it('announces nothing when the add was refused', async () => {
    findConversionByClickId.mockResolvedValue({ id: 'conv-0', refId: 300001, status: ConversionStatus.APPROVED });

    await expect(conversionService.createForClick({ clickId: 'click-1' })).rejects.toThrow();
    expect(announce).not.toHaveBeenCalled();
  });
});

describe('what it copies from the click', () => {
  it('carries the attribution and the click’s own context onto the conversion', async () => {
    await conversionService.createForClick({ clickId: 'click-1', transactionId: 'txn-9' });

    expect(written().clickId).toBe('click-1');
    expect(written().affiliateId).toBe('aff-1');
    expect(written().countryCode).toBe('US');
    expect(written().subId1).toBe('s1');
    expect(written().transactionId).toBe('txn-9');
    // It has a click by construction, so it is never an orphan — and an admin adding
    // one deliberately is not a duplicate of anything.
    expect(written().isOrphan).toBe(false);
    expect(written().isDuplicate).toBe(false);
    // Click-to-conversion time is measured from the click, as it is for a postback.
    expect(written().ctitMs).toBeGreaterThan(0);
  });
});
