'use client';

import { useState, type ReactNode } from 'react';
import {
  BarChart3,
  Bell,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Mail,
  MessageSquare,
  Newspaper,
  Plug,
  Settings,
  Tag,
  User,
  UserCog,
  Users,
  Wallet,
  Circle,
  type LucideIcon,
} from 'lucide-react';
import type { MenuConfig, MenuItem } from '@fatexia/types';
import { cn } from '../lib/cn';
import { LogoMark } from './LogoMark';

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  offers: Tag,
  affiliates: Users,
  advertisers: Building2,
  managers: UserCog,
  reports: BarChart3,
  notifications: Bell,
  settings: Settings,
  billing: CreditCard,
  subscription: Wallet,
  email: Mail,
  integrations: Plug,
  messages: MessageSquare,
  news: Newspaper,
  profile: User,
  logout: LogOut,
};

/**
 * Issue #3 — the affiliate portal's nav reads as an undifferentiated grey list.
 *
 * A colour per destination, not per state: the point is that "Payments" and "Offers"
 * are visually distinct at a glance, so the eye lands on the right row without
 * reading. Kept to one hue per icon and expressed as a tint (`/10` background) rather
 * than a solid fill, so the sidebar stays a sidebar instead of a colour chart, and so
 * every pair works on both the light and dark ground without a second definition.
 *
 * Opt-in via the `colorful` prop — the admin portal deliberately stays monochrome,
 * where the nav is twice as long and the colour would be noise.
 */
const ICON_COLORS: Record<string, string> = {
  dashboard: 'text-sky-500 bg-sky-500/10',
  offers: 'text-violet-500 bg-violet-500/10',
  affiliates: 'text-emerald-500 bg-emerald-500/10',
  advertisers: 'text-amber-500 bg-amber-500/10',
  managers: 'text-indigo-500 bg-indigo-500/10',
  reports: 'text-cyan-500 bg-cyan-500/10',
  notifications: 'text-orange-500 bg-orange-500/10',
  settings: 'text-slate-500 bg-slate-500/10',
  billing: 'text-teal-500 bg-teal-500/10',
  subscription: 'text-fuchsia-500 bg-fuchsia-500/10',
  email: 'text-blue-500 bg-blue-500/10',
  integrations: 'text-lime-600 bg-lime-500/10',
  messages: 'text-pink-500 bg-pink-500/10',
  news: 'text-yellow-600 bg-yellow-500/10',
  profile: 'text-purple-500 bg-purple-500/10',
  logout: 'text-rose-500 bg-rose-500/10',
};

const DEFAULT_ICON_COLOR = 'text-muted-foreground bg-muted';

function resolveIcon(name?: string): LucideIcon {
  return (name && ICONS[name]) || Circle;
}

export interface SidebarProps {
  menu: MenuConfig;
  currentPath: string;
  onNavigate: (path: string) => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  logoMark?: ReactNode;
  logoText?: string;
  userName?: string;
  userRole?: string;
  /** Tints each nav icon and gives the active row a coloured treatment (issue #3). */
  colorful?: boolean;
  /**
   * Rendered under the nav, above the user chip — the affiliate portal's manager
   * contact card (issue #6). Hidden while collapsed, where there is no room for it.
   */
  footer?: ReactNode;
}

function initials(name: string): string {
  return name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();
}

function isActive(item: MenuItem, currentPath: string): boolean {
  if (item.path === currentPath) return true;
  return item.children?.some((child) => isActive(child, currentPath)) ?? false;
}

function SidebarItem({
  item,
  currentPath,
  onNavigate,
  collapsed,
  depth,
  colorful,
}: {
  item: MenuItem;
  currentPath: string;
  onNavigate: (path: string) => void;
  collapsed: boolean;
  depth: number;
  colorful: boolean;
}) {
  const active = isActive(item, currentPath);
  const [open, setOpen] = useState(active);
  const hasChildren = !!item.children?.length;
  const Icon = depth === 0 ? resolveIcon(item.icon) : null;
  const iconColor = (item.icon && ICON_COLORS[item.icon]) ?? DEFAULT_ICON_COLOR;

  return (
    <li className="relative">
      {/* The active marker is a positioned bar rather than a border on the button, so
          turning it on doesn't shift the row's contents by a pixel. */}
      {colorful && active && depth === 0 && (
        <span className="absolute inset-y-1 left-0 w-1 rounded-r-full bg-primary" aria-hidden="true" />
      )}
      <button
        type="button"
        onClick={() => (hasChildren ? setOpen((o) => !o) : onNavigate(item.path))}
        className={cn(
          'flex w-full items-center rounded-md text-sm transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          colorful ? 'gap-2.5 py-1.5 pl-2 pr-3' : 'gap-2 px-3 py-2',
          colorful ? 'hover:bg-accent' : 'hover:bg-accent hover:text-accent-foreground',
          active
            ? colorful
              ? 'bg-primary/10 font-medium text-foreground'
              : 'bg-accent text-accent-foreground'
            : 'text-muted-foreground',
        )}
      >
        {Icon &&
          (colorful ? (
            <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-md', iconColor)}>
              <Icon className="size-4" />
            </span>
          ) : (
            <Icon className="size-4 shrink-0" />
          ))}
        <span className={cn('flex-1 truncate text-left', collapsed && 'sr-only')}>{item.label}</span>
        {hasChildren && !collapsed && (
          <ChevronDown className={cn('size-4 shrink-0 transition-transform duration-200', open && 'rotate-180')} />
        )}
      </button>
      {hasChildren && !collapsed && (
        <div className="grid transition-[grid-template-rows] duration-200 ease-out" style={{ gridTemplateRows: open ? '1fr' : '0fr' }}>
          <div className="overflow-hidden">
            <ul className={cn('mt-1 space-y-0.5 border-l pl-3', colorful ? 'ml-5 border-primary/25' : 'ml-3 border-border')}>
              {item.children!.map((child) => (
                <SidebarItem
                  key={child.path}
                  item={child}
                  currentPath={currentPath}
                  onNavigate={onNavigate}
                  collapsed={collapsed}
                  depth={depth + 1}
                  colorful={colorful}
                />
              ))}
            </ul>
          </div>
        </div>
      )}
    </li>
  );
}

export function Sidebar({
  menu,
  currentPath,
  onNavigate,
  collapsed = false,
  onCollapsedChange,
  logoMark,
  logoText,
  userName,
  userRole,
  colorful = false,
  footer,
}: SidebarProps) {
  return (
    <aside className={cn('flex h-full flex-col border-r border-border bg-card transition-[width]', collapsed ? 'w-16' : 'w-64')}>
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3">
        {/* The wordmark already contains "Fatexia", so `logoText` is only rendered
            when a caller supplies a custom mark that doesn't include it. */}
        {logoMark ?? <LogoMark variant={collapsed ? 'mark' : 'full'} />}
        {logoMark && logoText && !collapsed && (
          <span className="truncate font-semibold text-foreground">{logoText}</span>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {menu.groups.map((group, i) => (
          <div key={group.label ?? i} className={i > 0 ? 'mt-4' : undefined}>
            {group.label && !collapsed && (
              <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <SidebarItem
                  key={item.path}
                  item={item}
                  currentPath={currentPath}
                  onNavigate={onNavigate}
                  collapsed={collapsed}
                  depth={0}
                  colorful={colorful}
                />
              ))}
            </ul>
          </div>
        ))}
      </nav>
      {footer && !collapsed && <div className="shrink-0 border-t border-border p-3">{footer}</div>}
      {(userName || userRole) && (
        <div className="flex items-center gap-2 border-t border-border px-3 py-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
            {userName ? initials(userName) : '?'}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              {userName && <p className="truncate text-sm font-medium text-foreground">{userName}</p>}
              {userRole && <p className="truncate text-xs text-muted-foreground">{userRole}</p>}
            </div>
          )}
        </div>
      )}
      {onCollapsedChange && (
        <button
          type="button"
          onClick={() => onCollapsedChange(!collapsed)}
          className="flex items-center justify-center border-t border-border py-2 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </button>
      )}
    </aside>
  );
}
