import { IsNull } from 'typeorm';
import { AppDataSource } from '../../infra/database/data-source';
import { Offer, OfferStatus } from '../offers/offer.entity';
import { Affiliate } from '../affiliates/affiliate.entity';
import { User, UserRole, UserStatus } from '../users/user.entity';
import { Conversion, ConversionStatus } from '../conversions/conversion.entity';
import { OfferAccessRequest, AccessRequestStatus } from '../offer-access-requests/offer-access-request.entity';
import { Invoice, InvoiceStatus } from '../invoices/invoice.entity';
import { Message, MessageDirection } from '../messages/message.entity';
import { Click, ClickQualityStatus } from '../clicks/click.entity';

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
};
