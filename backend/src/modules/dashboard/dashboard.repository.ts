import { IsNull } from 'typeorm';
import { AppDataSource } from '../../infra/database/data-source';
import { applyManagerScope } from '../../common/manager-scope-sql';
import { Offer, OfferStatus } from '../offers/offer.entity';
import { Affiliate } from '../affiliates/affiliate.entity';
import { User, UserRole, UserStatus } from '../users/user.entity';
import { Conversion, ConversionStatus } from '../conversions/conversion.entity';
import { OfferAccessRequest, AccessRequestStatus } from '../offer-access-requests/offer-access-request.entity';
import { Invoice, InvoiceStatus } from '../invoices/invoice.entity';
import { Message, MessageDirection } from '../messages/message.entity';
import { Click, ClickQualityStatus } from '../clicks/click.entity';
import { Advertiser, AdvertiserStatus } from '../advertisers/advertiser.entity';
import type { ActivityEvent, ActivityKind } from '../reports/report.dto';

// Pure counts for the dashboard's stat tiles. Every one is a COUNT in Postgres — the
// dashboard must not load rows to size them.
export const dashboardRepository = {
  countOffersByStatus(status: OfferStatus): Promise<number> {
    return AppDataSource.getRepository(Offer).count({ where: { status } });
  },

  // Affiliate status lives on the linked user account, so this counts through the join
  // rather than off the affiliate row.
  countAffiliatesByStatus(status: UserStatus): Promise<number> {
    return AppDataSource.getRepository(Affiliate)
      .createQueryBuilder('affiliate')
      .innerJoin(User, 'user', 'user.id = affiliate."userId"')
      .where('user.status = :status', { status })
      .andWhere('user.role = :role', { role: UserRole.AFFILIATE })
      .getCount();
  },

  countConversionsByStatus(status: ConversionStatus): Promise<number> {
    return AppDataSource.getRepository(Conversion).count({ where: { status } });
  },

  countPendingAccessRequests(): Promise<number> {
    return AppDataSource.getRepository(OfferAccessRequest).count({
      where: { status: AccessRequestStatus.PENDING },
    });
  },

  countPendingInvoices(): Promise<number> {
    return AppDataSource.getRepository(Invoice).count({ where: { status: InvoiceStatus.PENDING } });
  },

  countUnreadMessages(): Promise<number> {
    return AppDataSource.getRepository(Message).count({
      where: { direction: MessageDirection.INBOUND, readAt: IsNull() },
    });
  },

  // Both fraud bands in one pass — two separate COUNTs would scan the clicks table
  // twice for the same window.
  async countClicksByQuality(since: Date | null): Promise<{ blocked: number; suspect: number }> {
    const qb = AppDataSource.getRepository(Click)
      .createQueryBuilder('click')
      .select(`COUNT(*) FILTER (WHERE click."qualityStatus" = :blocked)`, 'blocked')
      .addSelect(`COUNT(*) FILTER (WHERE click."qualityStatus" = :suspect)`, 'suspect')
      .setParameters({ blocked: ClickQualityStatus.BLOCKED, suspect: ClickQualityStatus.SUSPECT });

    if (since) {
      qb.where('click."createdAt" >= :since', { since });
    }

    const row = await qb.getRawOne<{ blocked: string; suspect: string }>();
    return { blocked: Number(row?.blocked ?? 0), suspect: Number(row?.suspect ?? 0) };
  },

  countActiveAdvertisers(): Promise<number> {
    return AppDataSource.getRepository(Advertiser).count({ where: { status: AdvertiserStatus.ACTIVE } });
  },

  // Calendar month to date, matching how an operator reads "this month" on a
  // statement — not a rolling 30 days, which would disagree with the invoice run.
  async sumPaidInvoicesThisMonth(managerScopeId?: string): Promise<number> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const qb = AppDataSource.getRepository(Invoice)
      .createQueryBuilder('invoice')
      .select('COALESCE(SUM(invoice.amount), 0)', 'total')
      .where('invoice.status = :status', { status: InvoiceStatus.PAID })
      .andWhere('invoice."paidAt" >= :monthStart', { monthStart });

    applyManagerScope(qb, 'invoice', managerScopeId);

    const row = await qb.getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  },

  /**
   * The newest events across three tables, merged and cut to `limit`.
   *
   * A UNION ALL with one outer ORDER BY/LIMIT rather than three queries merged in
   * JS: the database can stop reading each branch once it has `limit` rows, whereas
   * fetching `limit` from each and sorting in the app reads 3x the rows and still
   * has to discard two thirds of them.
   *
   * Parameterised throughout — `managerScopeId` reaches SQL as a bind parameter, never
   * string-interpolated, even though it comes from the session rather than the client.
   */
  async getRecentActivity(limit: number, managerScopeId?: string): Promise<ActivityEvent[]> {
    const scope = managerScopeId
      ? `AND source."affiliateId" IN (SELECT scoped.id FROM affiliates scoped WHERE scoped."assignedManagerId" = $2)`
      : '';

    const rows = await AppDataSource.query(
      `
      SELECT * FROM (
        SELECT source.id::text AS id, 'click' AS kind, offer.name AS offer,
               affiliate."publicId" AS affiliate, source."countryCode" AS "countryCode",
               NULL::numeric AS amount, source."createdAt" AS at
          FROM clicks source
          LEFT JOIN offers offer ON offer.id = source."offerId"
          LEFT JOIN affiliates affiliate ON affiliate.id = source."affiliateId"
         WHERE TRUE ${scope}
         ORDER BY source."createdAt" DESC
         LIMIT $1
      ) AS recent_clicks
      UNION ALL
      SELECT * FROM (
        SELECT source.id::text AS id, 'conversion' AS kind, offer.name AS offer,
               affiliate."publicId" AS affiliate, source."countryCode" AS "countryCode",
               NULL::numeric AS amount, source."createdAt" AS at
          FROM conversions source
          LEFT JOIN offers offer ON offer.id = source."offerId"
          LEFT JOIN affiliates affiliate ON affiliate.id = source."affiliateId"
         WHERE TRUE ${scope}
         ORDER BY source."createdAt" DESC
         LIMIT $1
      ) AS recent_conversions
      UNION ALL
      SELECT * FROM (
        SELECT source.id::text AS id, 'payout' AS kind, NULL AS offer,
               affiliate."publicId" AS affiliate, NULL AS "countryCode",
               source.amount AS amount, source."paidAt" AS at
          FROM invoices source
          LEFT JOIN affiliates affiliate ON affiliate.id = source."affiliateId"
         WHERE source."paidAt" IS NOT NULL ${scope}
         ORDER BY source."paidAt" DESC
         LIMIT $1
      ) AS recent_payouts
      ORDER BY at DESC
      LIMIT $1
      `,
      managerScopeId ? [limit, managerScopeId] : [limit],
    );

    return (rows as Record<string, unknown>[]).map((row) => ({
      id: String(row.id),
      kind: row.kind as ActivityKind,
      offer: (row.offer as string | null) ?? null,
      affiliate: (row.affiliate as string | null) ?? null,
      countryCode: (row.countryCode as string | null) ?? null,
      amount: row.amount === null ? null : Number(row.amount),
      at: new Date(row.at as string).toISOString(),
    }));
  },

  /** The same feed narrowed to one affiliate, for the affiliate portal's own dashboard. */
  async getAffiliateRecentActivity(affiliateId: string, limit: number): Promise<ActivityEvent[]> {
    const rows = await AppDataSource.query(
      `
      SELECT * FROM (
        SELECT source.id::text AS id, 'click' AS kind, offer.name AS offer,
               source."countryCode" AS "countryCode", NULL::numeric AS amount,
               source."createdAt" AS at
          FROM clicks source
          LEFT JOIN offers offer ON offer.id = source."offerId"
         WHERE source."affiliateId" = $2
         ORDER BY source."createdAt" DESC
         LIMIT $1
      ) AS recent_clicks
      UNION ALL
      SELECT * FROM (
        SELECT source.id::text AS id, 'conversion' AS kind, offer.name AS offer,
               source."countryCode" AS "countryCode", NULL::numeric AS amount,
               source."createdAt" AS at
          FROM conversions source
          LEFT JOIN offers offer ON offer.id = source."offerId"
         WHERE source."affiliateId" = $2
         ORDER BY source."createdAt" DESC
         LIMIT $1
      ) AS recent_conversions
      UNION ALL
      SELECT * FROM (
        SELECT source.id::text AS id, 'payout' AS kind, NULL AS offer,
               NULL AS "countryCode", source.amount AS amount, source."paidAt" AS at
          FROM invoices source
         WHERE source."affiliateId" = $2 AND source."paidAt" IS NOT NULL
         ORDER BY source."paidAt" DESC
         LIMIT $1
      ) AS recent_payouts
      ORDER BY at DESC
      LIMIT $1
      `,
      [limit, affiliateId],
    );

    // No `affiliate` field: on their own dashboard every row is theirs, and echoing
    // their own public id back on each line is noise.
    return (rows as Record<string, unknown>[]).map((row) => ({
      id: String(row.id),
      kind: row.kind as ActivityKind,
      offer: (row.offer as string | null) ?? null,
      affiliate: null,
      countryCode: (row.countryCode as string | null) ?? null,
      amount: row.amount === null ? null : Number(row.amount),
      at: new Date(row.at as string).toISOString(),
    }));
  },
};
