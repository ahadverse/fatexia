import type { MessageDto } from '../../modules/messages/message.dto';
import type { NotificationDto } from '../../modules/notifications/notification.dto';

/**
 * The realtime contract, in one place.
 *
 * Both portals import the same event names and payload shapes (mirrored in
 * `packages/types`), so a rename here is a compile error on the client rather than a
 * silently dead listener.
 */
export const REALTIME_EVENTS = {
  // A message was created that the recipient should see immediately.
  MESSAGE_NEW: 'message:new',
  // The recipient's unread total changed — sent to whoever's count moved, which is
  // not always the same party that triggered the change.
  MESSAGE_UNREAD: 'message:unread',
  // A conversation was acknowledged; used to clear read receipts on the sender's side.
  MESSAGE_READ: 'message:read',
  // A notification was created for one specific user — pushed to their room so the
  // header bell moves without a reload.
  NOTIFICATION_NEW: 'notification:new',
  // That user's unread notification total. Absolute, never a delta.
  NOTIFICATION_UNREAD: 'notification:unread',
  // A conversion was recorded, however it got there — an advertiser's postback or an
  // admin adding it by hand. Sent to the network room and deliberately NOT stored as a
  // notification row: this is an alert to whoever is watching right now, and a network
  // doing a thousand conversions a day would bury the bell in a day.
  CONVERSION_NEW: 'conversion:new',
} as const;

export interface MessageNewPayload {
  message: MessageDto;
}

export interface MessageUnreadPayload {
  unread: number;
}

export interface MessageReadPayload {
  affiliateId: string;
  // Which side acknowledged — the other side uses this to update its read receipts.
  reader: 'NETWORK' | 'AFFILIATE';
  readAt: string;
}

export interface NotificationNewPayload {
  notification: NotificationDto;
}

export interface NotificationUnreadPayload {
  unread: number;
}

/**
 * Enough to announce a conversion without a follow-up fetch.
 *
 * `source` is part of it because the two origins mean different things to whoever is
 * watching: `postback` is the advertiser reporting a sale, `manual` is a colleague
 * recording one the advertiser never sent.
 */
export interface ConversionNewPayload {
  conversionId: string;
  /** The conversion's short number — what the toast shows and a dispute quotes. */
  refId: number;
  offerName: string | null;
  payoutAmount: number;
  currency: string;
  status: string;
  source: 'postback' | 'manual';
}

/**
 * Room naming.
 *
 * `network` is every signed-in admin and manager: the network's inbox is shared, so a
 * message from an affiliate has to reach whoever happens to be looking. An affiliate
 * gets their own room keyed by affiliate id rather than user id, because everything
 * about messaging is scoped to the affiliate record, not the login.
 */
export const ROOMS = {
  network: 'network',
  affiliate: (affiliateId: string) => `affiliate:${affiliateId}`,
  user: (userId: string) => `user:${userId}`,
} as const;
