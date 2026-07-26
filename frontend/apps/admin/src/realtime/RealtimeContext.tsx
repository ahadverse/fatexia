import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  REALTIME_EVENTS,
  type MessageNewPayload,
  type MessageReadPayload,
  type MessageUnreadPayload,
  type NotificationNewPayload,
  type NotificationUnreadPayload,
} from '@fatexia/types';
import { getAccessToken } from '../lib/api';
import { getUnreadMessageCount, getUnreadNotificationCount } from '../lib/platform-api';
import { useSession } from '../session/SessionContext';

/**
 * The portal's live connection.
 *
 * One socket for the whole app, held here rather than opened per page — a component
 * that mounts and unmounts (a route change) must not tear down the connection that
 * keeps the header badges live.
 *
 * Both unread counts are fetched once on connect and then driven by server events.
 * They are always replaced with the server's number, never incremented locally: a badge
 * built from "+1 per event" drifts permanently the first time an event is missed, and
 * with multiple tabs open that happens routinely.
 */

type MessageListener = (payload: MessageNewPayload) => void;
type ReadListener = (payload: MessageReadPayload) => void;
type NotificationListener = (payload: NotificationNewPayload) => void;

interface RealtimeValue {
  connected: boolean;
  unreadMessages: number;
  unreadNotifications: number;
  /** Subscribe to incoming messages. Returns an unsubscribe function. */
  onMessage: (listener: MessageListener) => () => void;
  /** Subscribe to read receipts from the other party. */
  onRead: (listener: ReadListener) => () => void;
  /** Subscribe to incoming notifications. */
  onNotification: (listener: NotificationListener) => () => void;
  /** Lets a page that just marked a thread read correct the badge immediately. */
  refreshUnread: () => void;
  /** Same, for the notification bell after a mark-read. */
  refreshNotificationUnread: () => void;
}

const RealtimeContext = createContext<RealtimeValue | null>(null);

const API_URL = import.meta.env.VITE_API_URL as string;

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const [connected, setConnected] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Listener sets live in refs so subscribing doesn't re-render the provider (and
  // therefore doesn't churn the socket).
  const messageListeners = useRef(new Set<MessageListener>());
  const readListeners = useRef(new Set<ReadListener>());
  const notificationListeners = useRef(new Set<NotificationListener>());

  const refreshUnread = useCallback(() => {
    getUnreadMessageCount()
      .then(({ unread }) => setUnreadMessages(unread))
      // A failed count is not worth a toast — the badge simply keeps its last value
      // and the next event or reconnect corrects it.
      .catch(() => undefined);
  }, []);

  const refreshNotificationUnread = useCallback(() => {
    getUnreadNotificationCount()
      .then(({ unread }) => setUnreadNotifications(unread))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') {
      setConnected(false);
      setUnreadMessages(0);
      setUnreadNotifications(0);
      return;
    }

    const token = getAccessToken();
    if (!token) return;

    const socket: Socket = io(API_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      // Reconnect with backoff rather than hammering a server that just restarted.
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
    });

    socket.on('connect', () => {
      setConnected(true);
      // Re-sync on every connect, not just the first: a reconnect may have missed
      // events entirely, so both counts are re-read from the source of truth.
      refreshUnread();
      refreshNotificationUnread();
    });
    socket.on('disconnect', () => setConnected(false));

    socket.on(REALTIME_EVENTS.MESSAGE_UNREAD, (payload: MessageUnreadPayload) => {
      setUnreadMessages(payload.unread);
    });
    socket.on(REALTIME_EVENTS.MESSAGE_NEW, (payload: MessageNewPayload) => {
      messageListeners.current.forEach((listener) => listener(payload));
    });
    socket.on(REALTIME_EVENTS.MESSAGE_READ, (payload: MessageReadPayload) => {
      readListeners.current.forEach((listener) => listener(payload));
    });

    socket.on(REALTIME_EVENTS.NOTIFICATION_UNREAD, (payload: NotificationUnreadPayload) => {
      setUnreadNotifications(payload.unread);
    });
    socket.on(REALTIME_EVENTS.NOTIFICATION_NEW, (payload: NotificationNewPayload) => {
      notificationListeners.current.forEach((listener) => listener(payload));
    });

    return () => {
      socket.close();
      setConnected(false);
    };
  }, [status, refreshUnread, refreshNotificationUnread]);

  const onMessage = useCallback((listener: MessageListener) => {
    messageListeners.current.add(listener);
    return () => {
      messageListeners.current.delete(listener);
    };
  }, []);

  const onRead = useCallback((listener: ReadListener) => {
    readListeners.current.add(listener);
    return () => {
      readListeners.current.delete(listener);
    };
  }, []);

  const onNotification = useCallback((listener: NotificationListener) => {
    notificationListeners.current.add(listener);
    return () => {
      notificationListeners.current.delete(listener);
    };
  }, []);

  return (
    <RealtimeContext.Provider
      value={{
        connected,
        unreadMessages,
        unreadNotifications,
        onMessage,
        onRead,
        onNotification,
        refreshUnread,
        refreshNotificationUnread,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime(): RealtimeValue {
  const ctx = useContext(RealtimeContext);
  if (!ctx) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return ctx;
}
