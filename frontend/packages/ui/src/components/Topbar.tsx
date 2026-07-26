'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Bell, Mail, Menu, Moon, Sun, User } from 'lucide-react';
import type { Notification } from '@fatexia/types';
import { useTheme } from '../theme/ThemeProvider';

export interface TopbarProps {
  userLabel?: string;
  onLogout?: () => void;
  onMenuClick?: () => void;
  onProfileClick?: () => void;
  /** Unread message count. Omit to hide the messages button entirely. */
  unreadMessages?: number;
  onMessagesClick?: () => void;
  /** Unread notification count. Omit to hide the bell entirely. */
  unreadNotifications?: number;
  /** The newest few, fetched when the panel opens. */
  notifications?: Notification[];
  onNotificationsOpen?: () => void;
  onNotificationClick?: (notification: Notification) => void;
  onNotificationsViewAll?: () => void;
  onMarkAllNotificationsRead?: () => void;
}

// Counts past 99 are shown as "99+" — the exact number stops being actionable long
// before then, and a 4-digit badge wrecks the header layout.
function formatBadge(count: number): string {
  return count > 99 ? '99+' : String(count);
}

// Relative time to the minute, which is the precision that matters for "did this just
// happen". Anything older than a week falls back to a date.
function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

const LEVEL_DOT: Record<Notification['level'], string> = {
  INFO: 'bg-primary',
  SUCCESS: 'bg-success',
  WARNING: 'bg-warning',
  ERROR: 'bg-destructive',
};

export function Topbar({
  userLabel = 'Account',
  onLogout,
  onMenuClick,
  onProfileClick,
  unreadMessages,
  onMessagesClick,
  unreadNotifications,
  notifications = [],
  onNotificationsOpen,
  onNotificationClick,
  onNotificationsViewAll,
  onMarkAllNotificationsRead,
}: TopbarProps) {
  const { theme, toggleTheme } = useTheme();
  const showMessages = unreadMessages !== undefined && onMessagesClick !== undefined;
  const hasUnread = (unreadMessages ?? 0) > 0;
  const showNotifications = unreadNotifications !== undefined;
  const hasUnreadNotifications = (unreadNotifications ?? 0) > 0;

  return (
    <header className="flex h-14 items-center justify-between gap-4 border-b border-border bg-card px-4">
      <div className="flex flex-1 items-center gap-2">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Open menu"
            className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
          >
            <Menu className="size-4" />
          </button>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {showNotifications && (
          <DropdownMenu.Root onOpenChange={(open) => open && onNotificationsOpen?.()}>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                aria-label={
                  hasUnreadNotifications ? `Notifications, ${unreadNotifications} unread` : 'Notifications'
                }
                className="relative flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Bell className="size-4" />
                {hasUnreadNotifications && (
                  <span
                    aria-hidden
                    className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium leading-none text-primary-foreground"
                  >
                    {formatBadge(unreadNotifications!)}
                  </span>
                )}
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={8}
                className="z-50 w-80 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
              >
                <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                  <span className="text-xs font-semibold text-card-foreground">Notifications</span>
                  {hasUnreadNotifications && onMarkAllNotificationsRead && (
                    <DropdownMenu.Item
                      onSelect={onMarkAllNotificationsRead}
                      className="cursor-pointer rounded-sm px-1 text-xs text-primary outline-none hover:underline"
                    >
                      Mark all read
                    </DropdownMenu.Item>
                  )}
                </div>
                <DropdownMenu.Separator className="my-1 h-px bg-border" />

                {notifications.length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-muted-foreground">Nothing yet.</p>
                ) : (
                  <ul className="max-h-80 overflow-y-auto">
                    {notifications.map((notification) => (
                      <li key={notification.id}>
                        <DropdownMenu.Item
                          onSelect={() => onNotificationClick?.(notification)}
                          className="flex cursor-pointer gap-2 rounded-sm px-2 py-2 outline-none hover:bg-accent hover:text-accent-foreground"
                        >
                          <span
                            aria-hidden
                            className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                              notification.readAt ? 'bg-transparent' : LEVEL_DOT[notification.level]
                            }`}
                          />
                          <span className="min-w-0 flex-1">
                            <span
                              className={`block truncate text-xs ${notification.readAt ? 'text-muted-foreground' : 'font-medium text-card-foreground'}`}
                            >
                              {notification.title}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                              {notification.body}
                            </span>
                            <span className="mt-0.5 block text-[11px] text-muted-foreground">
                              {relativeTime(notification.createdAt)}
                            </span>
                          </span>
                        </DropdownMenu.Item>
                      </li>
                    ))}
                  </ul>
                )}

                <DropdownMenu.Separator className="my-1 h-px bg-border" />
                <DropdownMenu.Item
                  onSelect={onNotificationsViewAll}
                  className="cursor-pointer rounded-sm px-2 py-1.5 text-center text-xs text-primary outline-none hover:bg-accent"
                >
                  All notifications
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        )}

        {showMessages && (
          <button
            type="button"
            onClick={onMessagesClick}
            // The count goes in the label, not just the badge, so a screen reader
            // announces it — the coloured dot means nothing without sight.
            aria-label={hasUnread ? `Messages, ${unreadMessages} unread` : 'Messages'}
            className="relative flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Mail className="size-4" />
            {hasUnread && (
              <span
                aria-hidden
                className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium leading-none text-primary-foreground"
              >
                {formatBadge(unreadMessages!)}
              </span>
            )}
          </button>
        )}

        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="flex size-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="User menu"
            >
              <User className="size-4" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={8} className="z-50 min-w-40 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
              <DropdownMenu.Label className="px-2 py-1.5 text-xs text-muted-foreground">{userLabel}</DropdownMenu.Label>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <DropdownMenu.Item onSelect={onProfileClick} className="cursor-pointer rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground">
                Profile
              </DropdownMenu.Item>
              <DropdownMenu.Item onSelect={onLogout} className="cursor-pointer rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground">
                Log out
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
