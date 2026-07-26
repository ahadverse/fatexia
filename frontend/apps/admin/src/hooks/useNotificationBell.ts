import { useCallback, useEffect, useState } from 'react';
import type { Notification } from '@fatexia/types';
import { useNavigate } from 'react-router-dom';
import { getRecentNotifications, markAllNotificationsRead, markNotificationRead } from '../lib/platform-api';
import { useRealtime } from '../realtime/RealtimeContext';

/**
 * Everything the header bell needs, in one hook so `Shell.tsx` stays a wiring file.
 *
 * The preview list is fetched when the panel opens rather than kept permanently in
 * sync: it is five rows the user only sees on demand, and polling it would be a
 * request per interval for a badge the socket already keeps accurate.
 */
export function useNotificationBell() {
  const navigate = useNavigate();
  const { unreadNotifications, onNotification, refreshNotificationUnread } = useRealtime();
  const [recent, setRecent] = useState<Notification[]>([]);

  const load = useCallback(() => {
    getRecentNotifications()
      .then(setRecent)
      // A failed preview leaves the last list on screen; the badge is unaffected.
      .catch(() => undefined);
  }, []);

  // A notification arriving while the panel is open should appear in it, so the
  // preview refreshes on the event rather than only on the next open.
  useEffect(() => onNotification(() => load()), [onNotification, load]);

  async function open(notification: Notification) {
    if (!notification.readAt) {
      await markNotificationRead(notification.id).catch(() => undefined);
      refreshNotificationUnread();
      load();
    }
    if (notification.link) navigate(notification.link);
  }

  async function markAllRead() {
    await markAllNotificationsRead().catch(() => undefined);
    refreshNotificationUnread();
    load();
  }

  return {
    unreadNotifications,
    notifications: recent,
    onNotificationsOpen: load,
    onNotificationClick: open,
    onMarkAllNotificationsRead: markAllRead,
    onNotificationsViewAll: () => navigate('/notifications'),
  };
}
