import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, EmptyState, FilterBar, FilterField, PageHeader, Pagination, Select, TableSkeleton } from '@fatexia/ui';
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '../../lib/portal-api';
import { runAction, useAsync } from '../../hooks/useAsync';
import { useRealtime } from '../../realtime/RealtimeContext';
import { dateTime } from '../../lib/format';
import { StatusPill } from '../../components/StatusPill';

const CATEGORIES = ['OFFER', 'AFFILIATE', 'CONVERSION', 'FRAUD', 'BILLING', 'SYSTEM'];
const PAGE_SIZE = 25;

export function Notifications() {
  const navigate = useNavigate();
  const { refreshNotificationUnread } = useRealtime();
  const [category, setCategory] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);

  const notifications = useAsync(
    () => getNotifications({ category: category || undefined, unreadOnly: unreadOnly || undefined, page, pageSize: PAGE_SIZE }),
    [category, unreadOnly, page],
  );

  const rows = notifications.data?.rows ?? [];

  async function open(id: string, link: string | null) {
    await markNotificationRead(id);
    notifications.reload();
    // Without this the header badge keeps its stale count until the next socket event
    // or reconnect — reading a notification here has to move it immediately.
    refreshNotificationUnread();
    if (link) navigate(link);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Decisions on your account, offers and payouts, newest first. Opening one takes you to the screen it refers to."
        actions={
          <Button
            variant="outline"
            onClick={() =>
              runAction(() => markAllNotificationsRead(), {
                success: 'All marked read',
                onDone: () => {
                  notifications.reload();
                  refreshNotificationUnread();
                },
              })
            }
          >
            Mark all read
          </Button>
        }
      />

      <FilterBar>
        <FilterField label="Category">
          <Select
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              setPage(1);
            }}
            className="w-44"
          >
            <option value="">All categories</option>
            {CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Show">
          <Select
            value={unreadOnly ? 'unread' : 'all'}
            onChange={(event) => {
              setUnreadOnly(event.target.value === 'unread');
              setPage(1);
            }}
            className="w-40"
          >
            <option value="all">Everything</option>
            <option value="unread">Unread only</option>
          </Select>
        </FilterField>
      </FilterBar>

      {notifications.error && <p className="text-sm text-destructive">{notifications.error}</p>}

      {notifications.loading ? (
        <TableSkeleton rows={6} columns={3} />
      ) : rows.length === 0 ? (
        <EmptyState title="Nothing to show" description="No notifications match this filter." />
      ) : (
        <>
          <ul className="space-y-2">
            {rows.map((notification) => (
              <li key={notification.id}>
                <button
                  type="button"
                  onClick={() => open(notification.id, notification.link)}
                  className={`w-full rounded-lg border p-4 text-left transition-colors hover:bg-accent/50 ${
                    notification.readAt ? 'border-border bg-card' : 'border-primary/40 bg-primary/5'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={notification.level} />
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">{notification.category}</span>
                    {!notification.readAt && <span className="text-xs font-medium text-primary">Unread</span>}
                    <span className="ml-auto text-xs text-muted-foreground">{dateTime(notification.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-card-foreground">{notification.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{notification.body}</p>
                </button>
              </li>
            ))}
          </ul>
          <Pagination page={page} pageSize={PAGE_SIZE} total={notifications.data?.total ?? 0} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
