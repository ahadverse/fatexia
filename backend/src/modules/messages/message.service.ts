import { NotFoundError } from '../../common/errors';
import { paginate, type Paginated } from '../../common/pagination';
import { affiliateNames } from '../../common/entity-names';
import { affiliateRepository } from '../affiliates/affiliate.repository';
import { emitToRoom } from '../../infra/realtime/socket-server';
import { REALTIME_EVENTS, ROOMS } from '../../infra/realtime/events';
import { messageRepository } from './message.repository';
import { MessageDirection } from './message.entity';
import {
  previewOf,
  toMessageDto,
  type MessageDto,
  type MessageFiltersDto,
  type MessageThreadDetailDto,
  type MessageThreadDto,
  type ReplyMessageDto,
  type SendMessageDto,
  type ThreadFiltersDto,
} from './message.dto';

/**
 * Messaging between the network and one affiliate.
 *
 * `readAt` means "read by the recipient", and which party that is follows from the
 * direction: the network's inbox is INBOUND, the affiliate's is OUTBOUND. Every
 * read-marking path below states its own inbox explicitly, so one side acknowledging
 * a conversation can never clear the other side's unread state.
 */

// Which direction a given reader's inbox holds.
const INBOX: Record<'NETWORK' | 'AFFILIATE', MessageDirection> = {
  NETWORK: MessageDirection.INBOUND,
  AFFILIATE: MessageDirection.OUTBOUND,
};

/**
 * Pushes a new message and the recipient's refreshed unread total to whoever
 * receives it.
 *
 * The count is recomputed and sent rather than incremented client-side: a recipient
 * may have several tabs open, or have been offline through earlier messages, and a
 * badge derived from "+1 per event" drifts the moment one event is missed. Sending
 * the authoritative number makes the badge self-correcting.
 *
 * Emission is deliberately after the write and outside any transaction — a delivery
 * failure must never roll back a message that was genuinely saved.
 */
async function broadcastNewMessage(message: MessageDto, affiliateId: string): Promise<void> {
  const recipientRoom =
    message.direction === MessageDirection.OUTBOUND ? ROOMS.affiliate(affiliateId) : ROOMS.network;
  const recipientInbox =
    message.direction === MessageDirection.OUTBOUND ? INBOX.AFFILIATE : INBOX.NETWORK;

  emitToRoom(recipientRoom, REALTIME_EVENTS.MESSAGE_NEW, { message });

  const unread = await messageRepository.countUnread(
    recipientInbox,
    // The network's badge is a total across every affiliate; an affiliate's is their
    // own thread only.
    recipientInbox === INBOX.AFFILIATE ? affiliateId : undefined,
  );
  emitToRoom(recipientRoom, REALTIME_EVENTS.MESSAGE_UNREAD, { unread });

  // The sender's own view also updates — their thread gains the message they just
  // sent, so any other tab they have open stays in sync.
  const senderRoom = message.direction === MessageDirection.OUTBOUND ? ROOMS.network : ROOMS.affiliate(affiliateId);
  emitToRoom(senderRoom, REALTIME_EVENTS.MESSAGE_NEW, { message });
}

export const messageService = {
  async getMessages(filters: MessageFiltersDto): Promise<Paginated<MessageDto>> {
    const [rows, total] = await messageRepository.findAll(filters);
    const names = await affiliateNames(rows.map((r) => r.affiliateId));
    return paginate(
      rows.map((row) => toMessageDto(row, names.get(row.affiliateId) ?? null)),
      total,
      filters,
    );
  },

  // Thread list for the admin inbox. Three queries total regardless of how many
  // conversations there are: the grouped aggregate, the newest message per thread,
  // and one batched affiliate lookup for the names.
  async getThreads(filters: ThreadFiltersDto): Promise<Paginated<MessageThreadDto>> {
    const [aggregates, total] = await messageRepository.threadAggregates(filters);
    const affiliateIds = aggregates.map((row) => row.affiliateId);

    const [latest, affiliates] = await Promise.all([
      messageRepository.latestPerThread(affiliateIds),
      affiliateRepository.findByIds(affiliateIds),
    ]);

    const latestById = new Map(latest.map((row) => [row.affiliateId, row]));
    const affiliateById = new Map(affiliates.map((affiliate) => [affiliate.id, affiliate]));

    const rows = aggregates.map((row) => {
      const preview = latestById.get(row.affiliateId);
      const affiliate = affiliateById.get(row.affiliateId);
      return {
        affiliateId: row.affiliateId,
        affiliateName: affiliate?.fullName ?? affiliate?.companyName ?? null,
        affiliateEmail: affiliate?.user?.email ?? null,
        lastMessageAt: new Date(row.lastMessageAt).toISOString(),
        lastPreview: preview ? previewOf(preview.body) : null,
        lastDirection: preview?.direction ?? null,
        messageCount: Number(row.messageCount),
        unreadCount: Number(row.unreadCount),
      };
    });

    return paginate(rows, total, filters);
  },

  async getThread(affiliateId: string): Promise<MessageThreadDetailDto> {
    const affiliate = await affiliateRepository.findById(affiliateId);
    if (!affiliate) {
      throw new NotFoundError('Affiliate not found');
    }
    const messages = await messageRepository.findThread(affiliateId);
    const name = affiliate.fullName ?? affiliate.companyName ?? null;
    return {
      affiliateId,
      affiliateName: name,
      affiliateEmail: affiliate.user?.email ?? null,
      messages: messages.map((message) => toMessageDto(message, name)),
    };
  },

  async getOwnThread(userId: string): Promise<MessageThreadDetailDto> {
    const affiliate = await affiliateRepository.findByUserId(userId);
    if (!affiliate) {
      throw new NotFoundError('Affiliate profile not found');
    }
    return this.getThread(affiliate.id);
  },

  // Network-wide unread count for the admin badge.
  async getUnreadCount(managerScopeId?: string): Promise<{ unread: number }> {
    return { unread: await messageRepository.countUnread(MessageDirection.INBOUND, undefined, managerScopeId) };
  },

  // The affiliate's own unread count — messages the network sent them.
  async getOwnUnreadCount(userId: string): Promise<{ unread: number }> {
    const affiliate = await affiliateRepository.findByUserId(userId);
    if (!affiliate) {
      throw new NotFoundError('Affiliate profile not found');
    }
    return { unread: await messageRepository.countUnread(MessageDirection.OUTBOUND, affiliate.id) };
  },

  async send(dto: SendMessageDto, senderUserId: string): Promise<MessageDto> {
    const affiliate = await affiliateRepository.findById(dto.affiliateId);
    if (!affiliate) {
      throw new NotFoundError('Affiliate not found');
    }
    const message = await messageRepository.create({
      affiliateId: dto.affiliateId,
      direction: MessageDirection.OUTBOUND,
      body: dto.body,
      senderUserId,
    });
    const dtoOut = toMessageDto(message, affiliate.fullName ?? null);
    await broadcastNewMessage(dtoOut, dto.affiliateId);
    return dtoOut;
  },

  async reply(userId: string, dto: ReplyMessageDto): Promise<MessageDto> {
    const affiliate = await affiliateRepository.findByUserId(userId);
    if (!affiliate) {
      throw new NotFoundError('Affiliate profile not found');
    }
    const message = await messageRepository.create({
      affiliateId: affiliate.id,
      direction: MessageDirection.INBOUND,
      body: dto.body,
      senderUserId: userId,
    });
    const dtoOut = toMessageDto(message, affiliate.fullName ?? null);
    await broadcastNewMessage(dtoOut, affiliate.id);
    return dtoOut;
  },

  // Admin acknowledges a conversation: marks the messages the affiliate sent, and
  // only those. One UPDATE, idempotent, and structurally unable to touch the
  // affiliate's own unread state.
  async markThreadReadByNetwork(affiliateId: string): Promise<{ marked: number }> {
    const affiliate = await affiliateRepository.findById(affiliateId);
    if (!affiliate) {
      throw new NotFoundError('Affiliate not found');
    }
    const readAt = new Date();
    const marked = await messageRepository.markThreadRead(affiliateId, INBOX.NETWORK, readAt);

    // Nothing changed, so nothing to announce — this keeps a re-opened thread from
    // emitting a pointless event to every connected admin.
    if (marked === 0) return { marked };

    // The network's own badge drops for every admin, not just the one who read it.
    const unread = await messageRepository.countUnread(INBOX.NETWORK);
    emitToRoom(ROOMS.network, REALTIME_EVENTS.MESSAGE_UNREAD, { unread });

    // The affiliate is told their messages were read so their sent-receipts update.
    // This carries no unread count — their own badge is untouched by this action.
    emitToRoom(ROOMS.affiliate(affiliateId), REALTIME_EVENTS.MESSAGE_READ, {
      affiliateId,
      reader: 'NETWORK',
      readAt: readAt.toISOString(),
    });

    return { marked };
  },

  // The affiliate side of the same action — marks what the network sent them. Its
  // absence was why their unread badge could never go down.
  async markOwnThreadRead(userId: string): Promise<{ marked: number }> {
    const affiliate = await affiliateRepository.findByUserId(userId);
    if (!affiliate) {
      throw new NotFoundError('Affiliate profile not found');
    }
    const readAt = new Date();
    const marked = await messageRepository.markThreadRead(affiliate.id, INBOX.AFFILIATE, readAt);
    if (marked === 0) return { marked };

    // Their own badge, scoped to their own thread.
    const unread = await messageRepository.countUnread(INBOX.AFFILIATE, affiliate.id);
    emitToRoom(ROOMS.affiliate(affiliate.id), REALTIME_EVENTS.MESSAGE_UNREAD, { unread });

    // Staff see the read receipt on what they sent; the network's unread total is
    // deliberately not sent here, since it did not move.
    emitToRoom(ROOMS.network, REALTIME_EVENTS.MESSAGE_READ, {
      affiliateId: affiliate.id,
      reader: 'AFFILIATE',
      readAt: readAt.toISOString(),
    });

    return { marked };
  },
};
