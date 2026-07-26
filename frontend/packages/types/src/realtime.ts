import type { Message, Notification } from './platform';

// Mirrors the Backend's `infra/realtime/events.ts`. Both portals import these names
// rather than typing string literals, so a rename on the server surfaces as a
// compile error here instead of a listener that silently never fires.
export const REALTIME_EVENTS = {
  MESSAGE_NEW: 'message:new',
  MESSAGE_UNREAD: 'message:unread',
  MESSAGE_READ: 'message:read',
  NOTIFICATION_NEW: 'notification:new',
  NOTIFICATION_UNREAD: 'notification:unread',
} as const;

export interface MessageNewPayload {
  message: Message;
}

export interface MessageUnreadPayload {
  // The recipient's authoritative unread total — not a delta, so a badge built from
  // it is self-correcting after a dropped event or a reconnect.
  unread: number;
}

export interface MessageReadPayload {
  affiliateId: string;
  reader: 'NETWORK' | 'AFFILIATE';
  readAt: string;
}

export interface NotificationNewPayload {
  notification: Notification;
}

export interface NotificationUnreadPayload {
  // Absolute, like MessageUnreadPayload — the client never increments.
  unread: number;
}
