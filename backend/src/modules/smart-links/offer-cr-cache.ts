import { AppDataSource } from '../../infra/database/data-source';
import { logger } from '../../common/logger';
import { ConversionStatus } from '../conversions/conversion.entity';

/**
 * Recent conversion rate per offer, for the BEST_CR rotation.
 *
 * Cached because this sits on the click hot path: a GROUP BY over clicks and
 * conversions per redirect would put a two-table aggregate in front of every visitor,
 * which is exactly what PLAN-tracker.md's hot-path rule exists to prevent.
 *
 * A few minutes of staleness costs nothing here. Conversion rate is a trailing signal
 * measured over two weeks — it does not meaningfully move between one click and the
 * next, and the rotation only needs the *relative* ordering of the members to be
 * right, not the absolute number.
 */
const TTL_MS = 5 * 60 * 1000;
const WINDOW_DAYS = 14;

interface CrRow {
  offerId: string;
  clicks: string;
  conversions: string;
}

let cache: Map<string, number> = new Map();
let expiresAt = 0;
// Held so N simultaneous clicks arriving on a cold cache issue one query between them
// rather than N identical ones.
let inFlight: Promise<Map<string, number>> | null = null;

/**
 * What counts as a conversion here.
 *
 * The same pair the reports use (`report.repository.ts`, `approvedStates`), and for the
 * same reason: PAID conversions were APPROVED first, so counting only APPROVED would
 * make an offer look worse the moment it got paid out.
 *
 * The states left out are the point of the list. REJECTED, DUPLICATE and CHARGEBACK are
 * all rows the network affirmatively judged bad, and DUPLICATE is not rare — the
 * postback path *creates* one every time an advertiser double-fires (see
 * `conversion.service.ts`). Counting them made this rotation reward the offers whose
 * traffic was being rejected and whose advertisers were firing twice.
 *
 * PENDING is excluded too, which reads harsh for a new offer but is not: an offer with
 * no approved conversions scores 0 here and `bestCrIndex` floors every candidate, so it
 * still receives traffic while its first conversions are being reviewed.
 */
const CONVERTED_STATES = [ConversionStatus.APPROVED, ConversionStatus.PAID];

async function query(): Promise<Map<string, number>> {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const rows = await AppDataSource.query<CrRow[]>(
    // COUNT(DISTINCT c.id), never COUNT(*): this is a LEFT JOIN, so a click that carries
    // two conversion rows arrives here as two rows and would otherwise be counted as two
    // clicks. A click with a real conversion and its DUPLICATE twin is the ordinary way
    // that happens, which made the denominator wrong on exactly the offers the numerator
    // was already wrong about.
    `SELECT c."offerId" AS "offerId",
            COUNT(DISTINCT c.id) AS clicks,
            COUNT(*) FILTER (WHERE cv.status = ANY($2)) AS conversions
       FROM clicks c
       LEFT JOIN conversions cv ON cv."clickId" = c.id
      WHERE c."createdAt" >= $1
      GROUP BY c."offerId"`,
    [since, CONVERTED_STATES],
  );

  const next = new Map<string, number>();
  for (const row of rows) {
    const clicks = Number(row.clicks);
    next.set(row.offerId, clicks === 0 ? 0 : Number(row.conversions) / clicks);
  }
  return next;
}

/**
 * Conversion rate (0–1) per offer id. Never throws and never blocks a redirect: if the
 * query fails, the previous snapshot is kept and the caller falls back to an even
 * split, because a failed analytics lookup must not cost a visitor their redirect.
 */
export async function getOfferConversionRates(): Promise<Map<string, number>> {
  if (Date.now() < expiresAt) return cache;
  if (inFlight) return inFlight;

  inFlight = query()
    .then((next) => {
      cache = next;
      expiresAt = Date.now() + TTL_MS;
      return cache;
    })
    .catch((err) => {
      logger.warn({ err }, 'Offer CR refresh failed, serving the previous snapshot');
      // Backs off for a full TTL rather than retrying on the very next click, so a
      // database hiccup doesn't turn into a query storm from the hot path.
      expiresAt = Date.now() + TTL_MS;
      return cache;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}
