import type { DataSource } from 'typeorm';
import { Click, ClickQualityStatus } from '../../../modules/clicks/click.entity';
import { Conversion, ConversionStatus } from '../../../modules/conversions/conversion.entity';
import { PostbackLog, PostbackDirection } from '../../../modules/postback-logs/postback-log.entity';
import { AffiliatePoint } from '../../../modules/affiliate-points/affiliate-point.entity';
import { Invoice, InvoiceStatus, PaymentMethod } from '../../../modules/invoices/invoice.entity';
import { geoSource } from '../../../modules/geo-source/geo-source';
import {
  COUNTRY_IP_POOLS,
  OFFERS,
  TRAFFIC_ASNS,
  TRAFFIC_COUNTRIES,
  TRAFFIC_DEVICE_PROFILES,
  TRAFFIC_SUB_IDS,
} from './fixtures';
import { ids } from './ids';
import { chance, createRandom, intBetween, pick } from './random';
import type { CoreSeedResult } from './seed-core';

/**
 * Generated click and conversion history.
 *
 * Every report, chart and CR calculation in the Admin portal reads these two tables,
 * so without them the reporting surface renders correctly but empty. The volume below
 * is deliberately modest — enough for trends, per-offer rankings and CR comparisons to
 * be meaningful, small enough that `npm run seed` stays quick.
 *
 * All randomness comes from a fixed-seed PRNG (see random.ts), so a re-run rewrites the
 * same rows under the same ids rather than appending a second dataset.
 */

const CLICK_COUNT = 2400;
const TRAFFIC_WINDOW_DAYS = 60;
const SEED_CONSTANT = 0x5f3a19;

interface GeneratedClick {
  id: string;
  offerId: string;
  affiliateId: string;
  createdAt: Date;
  countryCode: string;
  deviceType: string;
  qualityStatus: ClickQualityStatus;
  subId1: string | null;
  subId2: string | null;
}

export async function seedTraffic(dataSource: DataSource, core: CoreSeedResult): Promise<void> {
  const random = createRandom(SEED_CONSTANT);
  const clickRepo = dataSource.getRepository(Click);
  const conversionRepo = dataSource.getRepository(Conversion);
  const postbackRepo = dataSource.getRepository(PostbackLog);
  const pointRepo = dataSource.getRepository(AffiliatePoint);
  const invoiceRepo = dataSource.getRepository(Invoice);

  // Payout/revenue per offer, read from the same fixtures the offers were built from
  // so a conversion's money always matches its offer's payout rule.
  const offerEconomics = new Map(
    OFFERS.map((offer) => [
      core.offerIdByName.get(offer.name)!,
      { payout: Number(offer.defaultPayoutAmount), revenue: Number(offer.revenueAmount), holdDays: offer.holdDays },
    ]),
  );

  const clicks: Click[] = [];
  const generated: GeneratedClick[] = [];
  // Mirrors the runtime unique rule (first click per offer+IP) so the seeded badge and
  // the aggregate metric agree, exactly as they do for live traffic.
  const seenOfferIp = new Set<string>();

  for (let index = 0; index < CLICK_COUNT; index += 1) {
    const offerId = pick(random, core.approvedOfferIds);
    const affiliateId = pick(random, core.activeAffiliateIds);

    // Weighted toward recent days so the trend chart slopes rather than sitting flat.
    const dayOffset = Math.floor(Math.pow(random(), 1.6) * TRAFFIC_WINDOW_DAYS);
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - dayOffset);
    createdAt.setHours(intBetween(random, 0, 23), intBetween(random, 0, 59), intBetween(random, 0, 59), 0);

    const isDatacenter = chance(random, 0.06);
    const isProxyOrVpn = chance(random, 0.85) ? chance(random, 0.08) : null;

    // Mirrors the live scoring in click.service.ts (datacenter +70, proxy +50) so the
    // seeded quality bands match what the real pipeline would produce.
    let riskScore = 0;
    if (isDatacenter) riskScore += 70;
    if (isProxyOrVpn === true) riskScore += 50;

    let qualityStatus: ClickQualityStatus;
    if (riskScore >= 70) qualityStatus = ClickQualityStatus.BLOCKED;
    else if (riskScore >= 30) qualityStatus = ClickQualityStatus.SUSPECT;
    else if (isProxyOrVpn === null) qualityStatus = ClickQualityStatus.UNSCORED;
    else qualityStatus = ClickQualityStatus.GOOD;

    const fixtureCountry = pick(random, TRAFFIC_COUNTRIES);
    const ip = pick(random, COUNTRY_IP_POOLS[fixtureCountry]!);

    // The real lookup, not a synthesised country. This makes the seed an actual
    // exercise of the geo pipeline: if the .mmdb files are missing or the reader
    // regresses, the seeded rows lose their city and the failure is visible instead of
    // being papered over by a hardcoded value. Falls back to the fixture country so a
    // fresh checkout without the databases still seeds successfully.
    const geo = await geoSource.lookup(ip);
    const countryCode = geo.countryCode ?? fixtureCountry;

    // One draw for the whole device profile, so OS and browser stay consistent with
    // the device rather than being three independent picks.
    const profile = pick(random, TRAFFIC_DEVICE_PROFILES);
    const browser = pick(random, profile.browsers);
    const subId1 = pick(random, TRAFFIC_SUB_IDS) || null;
    const subId2 = chance(random, 0.4) ? `creative_${intBetween(random, 1, 6)}` : null;
    const id = ids.click(index);

    const offerIpKey = `${offerId}|${ip}`;
    const isUnique = !seenOfferIp.has(offerIpKey);
    seenOfferIp.add(offerIpKey);

    clicks.push(
      clickRepo.create({
        id,
        offerId,
        affiliateId,
        ip,
        userAgent: `Mozilla/5.0 (${profile.os}; ${profile.deviceType}) ${browser}/${profile.browserVersion}`,
        countryCode,
        city: geo.city,
        region: geo.region,
        regionCode: geo.regionCode,
        deviceType: profile.deviceType,
        deviceBrand: profile.deviceBrand,
        os: profile.os,
        osVersion: profile.osVersion,
        browser,
        browserVersion: profile.browserVersion,
        // Kept as an independent draw rather than the ASN the IP really belongs to:
        // the demo needs a deliberate spread of BLOCKED/SUSPECT rows, and real consumer
        // ISP ranges would score clean every time. Mildly inconsistent with `ip` on
        // purpose — the geo fields above are the ones that must be truthful.
        asn: pick(random, TRAFFIC_ASNS),
        isDatacenter,
        isProxyOrVpn,
        isUnique,
        subId1,
        subId2,
        subId3: null,
        subId4: null,
        subId5: null,
        subId6: null,
        subId7: null,
        subId8: null,
        referer: chance(random, 0.5) ? 'https://www.google.com/' : null,
        riskScore,
        qualityStatus,
        createdAt,
      }),
    );

    generated.push({
      id,
      offerId,
      affiliateId,
      createdAt,
      countryCode,
      deviceType: profile.deviceType,
      qualityStatus,
      subId1,
      subId2,
    });
  }

  // Chunked because a single 2,400-row INSERT exceeds Postgres' bind-parameter limit
  // once every column is counted.
  const CHUNK = 200;
  for (let i = 0; i < clicks.length; i += CHUNK) {
    await clickRepo.save(clicks.slice(i, i + CHUNK));
  }

  // Conversions are derived from real clicks rather than generated independently, so
  // click_id always resolves, CTIT is a genuine interval, and the reports' conversion
  // rate is a true ratio of the click rows next to it.
  const conversions: Conversion[] = [];
  const postbacks: PostbackLog[] = [];
  const points: AffiliatePoint[] = [];
  let conversionIndex = 0;

  for (const click of generated) {
    // Blocked traffic does not convert — that is the point of blocking it.
    if (click.qualityStatus === ClickQualityStatus.BLOCKED) continue;
    if (!chance(random, 0.055)) continue;

    const economics = offerEconomics.get(click.offerId)!;
    const ctitMs = intBetween(random, 45_000, 5 * 24 * 60 * 60 * 1000);
    const createdAt = new Date(click.createdAt.getTime() + ctitMs);
    // A conversion timestamped in the future would sit outside every report window.
    if (createdAt > new Date()) continue;

    const roll = random();
    let status: ConversionStatus;
    if (roll < 0.62) status = ConversionStatus.APPROVED;
    else if (roll < 0.74) status = ConversionStatus.PAID;
    else if (roll < 0.86) status = ConversionStatus.PENDING;
    else if (roll < 0.95) status = ConversionStatus.REJECTED;
    else status = ConversionStatus.DUPLICATE;

    const approvedAt =
      status === ConversionStatus.APPROVED || status === ConversionStatus.PAID
        ? new Date(createdAt.getTime() + intBetween(random, 1, 48) * 3600_000)
        : null;

    const id = ids.conversion(conversionIndex);
    conversions.push(
      conversionRepo.create({
        id,
        clickId: click.id,
        offerId: click.offerId,
        affiliateId: click.affiliateId,
        revenueAmount: economics.revenue.toFixed(2),
        payoutAmount: economics.payout.toFixed(2),
        currency: 'USD',
        status,
        isDuplicate: status === ConversionStatus.DUPLICATE,
        isOrphan: false,
        leadRiskScore: intBetween(random, 0, 40),
        emailHash: null,
        phoneHash: null,
        ctitMs,
        subId1: click.subId1,
        subId2: click.subId2,
        subId3: null,
        subId4: null,
        subId5: null,
        subId6: null,
        subId7: null,
        subId8: null,
        countryCode: click.countryCode,
        transactionId: `txn_${id.slice(0, 12)}`,
        approvedAt,
        paidAt: status === ConversionStatus.PAID ? new Date(approvedAt!.getTime() + 30 * 86400_000) : null,
        invoiceId: null,
        createdAt,
      }),
    );

    // Inbound postback from the advertiser, then the outbound one to the affiliate —
    // the pair the Postback Logs report is built to show side by side.
    postbacks.push(
      postbackRepo.create({
        id: ids.postbackLog(`in:${conversionIndex}`),
        conversionId: id,
        offerId: click.offerId,
        affiliateId: click.affiliateId,
        direction: PostbackDirection.INBOUND,
        url: null,
        payload: { click_id: click.id, payout: economics.payout, txid: `txn_${id.slice(0, 12)}` },
        responseStatus: 200,
        success: true,
        errorMessage: null,
        attemptCount: 1,
        sourceIp: '127.0.0.1',
        createdAt,
      }),
    );

    if (status === ConversionStatus.APPROVED || status === ConversionStatus.PAID) {
      // ~8% of outbound deliveries fail, so the report has real failures to filter on
      // rather than an unbroken column of successes.
      const delivered = chance(random, 0.92);
      postbacks.push(
        postbackRepo.create({
          id: ids.postbackLog(`out:${conversionIndex}`),
          conversionId: id,
          offerId: click.offerId,
          affiliateId: click.affiliateId,
          direction: PostbackDirection.OUTBOUND,
          url: `https://postback.example.com/cb?click_id=${click.id}&payout=${economics.payout}&status=approved`,
          payload: { click_id: click.id, payout: economics.payout, status: 'approved' },
          responseStatus: delivered ? 200 : 502,
          success: delivered,
          errorMessage: delivered ? null : 'Upstream returned 502 Bad Gateway',
          attemptCount: delivered ? 1 : 3,
          sourceIp: null,
          createdAt: approvedAt ?? createdAt,
        }),
      );

      points.push(
        pointRepo.create({
          id: ids.affiliatePoint(`conv:${conversionIndex}`),
          affiliateId: click.affiliateId,
          conversionId: id,
          points: 10,
          reason: 'Approved conversion',
          createdByUserId: null,
          createdAt: approvedAt ?? createdAt,
        }),
      );
    }

    conversionIndex += 1;
  }

  for (let i = 0; i < conversions.length; i += CHUNK) {
    await conversionRepo.save(conversions.slice(i, i + CHUNK));
  }
  for (let i = 0; i < postbacks.length; i += CHUNK) {
    await postbackRepo.save(postbacks.slice(i, i + CHUNK));
  }
  for (let i = 0; i < points.length; i += CHUNK) {
    await pointRepo.save(points.slice(i, i + CHUNK));
  }

  // One manual adjustment so the Points page shows both earned and admin-adjusted
  // rows, which is the distinction the ledger exists to preserve.
  await pointRepo.save(
    pointRepo.create({
      id: ids.affiliatePoint('manual:1'),
      affiliateId: core.activeAffiliateIds[0]!,
      conversionId: null,
      points: 250,
      reason: 'Q2 top-performer bonus',
      createdByUserId: core.adminUserId,
    }),
  );

  // Historical invoices covering already-PAID conversions, so Billing opens with a
  // real settled history rather than only whatever the next batch would produce.
  const paidConversions = conversions.filter((c) => c.status === ConversionStatus.PAID);
  const byAffiliate = new Map<string, Conversion[]>();
  for (const conversion of paidConversions) {
    const list = byAffiliate.get(conversion.affiliateId!) ?? [];
    list.push(conversion);
    byAffiliate.set(conversion.affiliateId!, list);
  }

  const periodFrom = new Date();
  periodFrom.setDate(periodFrom.getDate() - TRAFFIC_WINDOW_DAYS);

  // Clear the seed's own invoices before rewriting them. Every other table here is
  // upserted by a stable id, but `invoiceNumber` carries its own unique constraint:
  // if a re-run assigns a number to a different affiliate than last time, the insert
  // collides with the leftover row still holding it. Deleting first makes the invoice
  // step as re-runnable as the rest of the seed.
  const seededInvoiceIds = core.activeAffiliateIds.map((affiliateId) => ids.invoice(`batch:${affiliateId}`));
  await conversionRepo
    .createQueryBuilder()
    .update(Conversion)
    .set({ invoiceId: null })
    .where('"invoiceId" IN (:...seededInvoiceIds)', { seededInvoiceIds })
    .execute();
  await invoiceRepo.delete(seededInvoiceIds);

  for (const [affiliateId, rows] of byAffiliate) {
    if (rows.length < 2) continue;

    // The invoice number is derived from the affiliate's fixed position in the
    // affiliate list, not from a running counter over this loop. A counter would
    // renumber every invoice whenever the generated traffic changed which affiliates
    // have payable conversions, and the re-run would then collide with the stored
    // number on a different affiliate's row.
    const invoiceSequence = core.activeAffiliateIds.indexOf(affiliateId) + 1;
    const invoiceId = ids.invoice(`batch:${affiliateId}`);
    const amount = rows.reduce((sum, row) => sum + Number(row.payoutAmount), 0);

    await invoiceRepo.save(
      invoiceRepo.create({
        id: invoiceId,
        invoiceNumber: `INV-${String(invoiceSequence).padStart(6, '0')}`,
        affiliateId,
        periodFrom,
        periodTo: new Date(),
        amount: amount.toFixed(2),
        currency: 'USD',
        conversionCount: rows.length,
        // Alternating so Billing has both a settled and an awaiting-payment example.
        status: invoiceSequence % 2 === 0 ? InvoiceStatus.PAID : InvoiceStatus.PENDING,
        paymentMethod: invoiceSequence % 2 === 0 ? PaymentMethod.PAYPAL : PaymentMethod.BANK_TRANSFER,
        paymentReference: invoiceSequence % 2 === 0 ? `PP-${invoiceId.slice(0, 8)}` : null,
        notes: null,
        paidAt: invoiceSequence % 2 === 0 ? new Date() : null,
      }),
    );

    // Link the conversions to the invoice they were settled on, so an admin opening
    // an invoice sees exactly which rows it covers.
    await conversionRepo.update(
      rows.map((row) => row.id),
      { invoiceId },
    );
  }
}
