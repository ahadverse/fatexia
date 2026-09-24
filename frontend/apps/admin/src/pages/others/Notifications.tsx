import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, ConfirmModal, EmptyState, FilterBar, FilterField, PageHeader, Pagination, Select, TableSkeleton } from '@fatexia/ui';
import { bulkDeleteNotifications, getNotifications, markAllNotificationsRead, markNotificationRead } from '../../lib/platform-api';
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
  const [confirmMarkAll, setConfirmMarkAll] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const notifications = useAsync(
    () => getNotifications({ category: category || undefined, unreadOnly: unreadOnly || undefined, page, pageSize: PAGE_SIZE }),
    [category, unreadOnly, page],
  );

  const rows = notifications.data?.rows ?? [];
  const pageIds = rows.map((row) => row.id);
  const selectedOnPage = pageIds.filter((id) => selected.has(id)).length;
  const allOnPageSelected = pageIds.length > 0 && selectedOnPage === pageIds.length;
  const someOnPageSelected = selectedOnPage > 0 && !allOnPageSelected;

  function toggleAllOnPage() {
    const next = new Set(selected);
    if (allOnPageSelected) pageIds.forEach((id) => next.delete(id));
    else pageIds.forEach((id) => next.add(id));
    setSelected(next);
  }

  function toggleRow(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function changePage(next: number) {
    setPage(next);
    setSelected(new Set());
  }

  async function open(id: string, link: string | null) {
    await markNotificationRead(id);
    notifications.reload();
    // Without this the header badge keeps its stale count until the next socket event
    // or reconnect — reading a notification here has to move it immediately.
    refreshNotificationUnread();
    if (link) navigate(link);
  }

  async function confirmBulkDelete() {
    setDeleting(true);
    const result = await runAction(() => bulkDeleteNotifications([...selected]), {
      success: `${selected.size} notification${selected.size === 1 ? '' : 's'} deleted`,
      onDone: () => {
        notifications.reload();
        refreshNotificationUnread();
      },
    });
    setDeleting(false);
    if (result) {
      setSelected(new Set());
      setConfirmDelete(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Everything the network flagged for attention, newest first. Opening one takes you to the screen that resolves it."
        actions={
          <>
            {selected.size > 0 && (
              <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
                Delete selected ({selected.size})
              </Button>
            )}
            <Button variant="outline" onClick={() => setConfirmMarkAll(true)}>
              Mark all read
            </Button>
          </>
        }
      />

      <FilterBar>
        <FilterField label="Category">
          <Select
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              changePage(1);
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
              changePage(1);
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
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={allOnPageSelected}
              ref={(el) => {
                if (el) el.indeterminate = someOnPageSelected;
              }}
              onChange={toggleAllOnPage}
              className="size-3.5 accent-[hsl(var(--primary))]"
            />
            Select all on this page
          </label>
          <ul className="space-y-2">
            {rows.map((notification) => (
              <li key={notification.id} className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selected.has(notification.id)}
                  onChange={() => toggleRow(notification.id)}
                  aria-label="Select notification"
                  className="mt-4 size-3.5 shrink-0 accent-[hsl(var(--primary))]"
                />
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
          <Pagination page={page} pageSize={PAGE_SIZE} total={notifications.data?.total ?? 0} onPageChange={changePage} />
        </>
      )}

      <ConfirmModal
        open={confirmMarkAll}
        onOpenChange={setConfirmMarkAll}
        title="Mark all notifications read?"
        description="Every unread notification for you is cleared. This can't be undone."
        confirmLabel="Mark all read"
        loading={markingAll}
        onConfirm={async () => {
          setMarkingAll(true);
          const result = await runAction(() => markAllNotificationsRead(), {
            success: 'All marked read',
            onDone: () => {
              notifications.reload();
              refreshNotificationUnread();
            },
          });
          setMarkingAll(false);
          if (result) setConfirmMarkAll(false);
        }}
      />

      <ConfirmModal
        open={confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(false)}
        title={`Delete ${selected.size} notification${selected.size === 1 ? '' : 's'}?`}
        description="This can't be undone."
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={confirmBulkDelete}
      />
    </div>
  );
}
