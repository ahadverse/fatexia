'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
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
 * Opt-in via the `colorful` prop. Both portals now use it: the admin nav was left
 * monochrome originally on the grounds that colour across a nav this long reads as
 * noise, but without the icon chip the active row is a tinted pill around a plain
 * white glyph, which looks unfinished rather than restrained.
 */
// `chip` tints the icon square; `bar` is the solid left-edge marker on the current row,
// the one place the hue appears at full strength. Written out in full because Tailwind
// scans for literal class names — a composed `bg-${hue}-500` would never be generated.
const ICON_COLORS: Record<string, { chip: string; bar: string }> = {
  dashboard: { chip: 'text-sky-500 bg-sky-500/10', bar: 'bg-sky-500' },
  offers: { chip: 'text-violet-500 bg-violet-500/10', bar: 'bg-violet-500' },
  affiliates: { chip: 'text-emerald-500 bg-emerald-500/10', bar: 'bg-emerald-500' },
  advertisers: { chip: 'text-amber-500 bg-amber-500/10', bar: 'bg-amber-500' },
  managers: { chip: 'text-indigo-500 bg-indigo-500/10', bar: 'bg-indigo-500' },
  reports: { chip: 'text-cyan-500 bg-cyan-500/10', bar: 'bg-cyan-500' },
  notifications: { chip: 'text-orange-500 bg-orange-500/10', bar: 'bg-orange-500' },
  settings: { chip: 'text-slate-500 bg-slate-500/10', bar: 'bg-slate-500' },
  billing: { chip: 'text-teal-500 bg-teal-500/10', bar: 'bg-teal-500' },
  subscription: { chip: 'text-fuchsia-500 bg-fuchsia-500/10', bar: 'bg-fuchsia-500' },
  email: { chip: 'text-blue-500 bg-blue-500/10', bar: 'bg-blue-500' },
  integrations: { chip: 'text-lime-600 bg-lime-500/10', bar: 'bg-lime-500' },
  messages: { chip: 'text-pink-500 bg-pink-500/10', bar: 'bg-pink-500' },
  news: { chip: 'text-yellow-600 bg-yellow-500/10', bar: 'bg-yellow-500' },
  profile: { chip: 'text-purple-500 bg-purple-500/10', bar: 'bg-purple-500' },
  logout: { chip: 'text-rose-500 bg-rose-500/10', bar: 'bg-rose-500' },
};

const DEFAULT_ICON_COLOR = { chip: 'text-muted-foreground bg-muted', bar: 'bg-primary' };

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
  inherited,
  onExpand,
}: {
  item: MenuItem;
  currentPath: string;
  onNavigate: (path: string) => void;
  collapsed: boolean;
  depth: number;
  colorful: boolean;
  /** The parent's colour pair — sub-items have no icon of their own to take one from. */
  inherited?: { chip: string; bar: string };
  /** Opens the rail. Absent when the caller gave the Sidebar no collapse control. */
  onExpand?: () => void;
}) {
  const active = isActive(item, currentPath);
  // `active` is true for ancestors too, which is what keeps a group expanded. Only the
  // row the user is actually on gets the filled pill — with both lit, the open group
  // header and the selected child compete and neither reads as "you are here".
  const current = item.path === currentPath;
  const [open, setOpen] = useState(active);
  const hasChildren = !!item.children?.length;
  const Icon = depth === 0 ? resolveIcon(item.icon) : null;
  // Ternary, not `&&`: an empty-string icon name would make `&&` yield `''`, which
  // `??` passes through as a value rather than falling back to the default pair.
  const iconColor = (item.icon ? ICON_COLORS[item.icon] : undefined) ?? inherited ?? DEFAULT_ICON_COLOR;
  const RowTag = (hasChildren ? 'button' : 'a') as 'button';

  // Collapsed groups open as a floating panel beside the rail. It is portalled to the
  // body because `nav` scrolls, and a scroll container clips on both axes — anchored
  // inside it, the panel would be cut off at the rail's edge.
  const rowRef = useRef<HTMLLIElement>(null);
  const [flyout, setFlyout] = useState<{ top: number; left: number } | null>(null);
  // Closing is delayed so the pointer can cross the gap between the icon and the panel
  // without the panel vanishing mid-travel.
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const showFlyout = () => {
    clearTimeout(closeTimer.current);
    const rect = rowRef.current?.getBoundingClientRect();
    if (rect) setFlyout({ top: rect.top, left: rect.right });
  };
  const hideFlyout = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setFlyout(null), 120);
  };

  // The panel is positioned from a rect taken when it opened, so anything that moves
  // that rect leaves it stranded. Expanding the rail removes the reason for it at the
  // same time.
  useEffect(() => {
    if (!collapsed) setFlyout(null);
  }, [collapsed]);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  return (
    <li
      ref={rowRef}
      className="relative"
      onMouseEnter={collapsed && hasChildren ? showFlyout : undefined}
      onMouseLeave={collapsed && hasChildren ? hideFlyout : undefined}
    >
      {/* Solid hue bar at the left edge of the current row. Positioned over the block
          rather than being a border on the button, so switching it on shifts nothing. */}
      {current && (
        <span className={cn('absolute inset-y-1 left-0 z-10 w-1 rounded-r-full', iconColor.bar)} aria-hidden="true" />
      )}
      {/* A leaf row is an anchor with a real href, not a button. A button is not a link
          as far as the browser is concerned: ctrl/cmd-click, middle-click and "Open link
          in new tab" all do nothing on one, and the address never appears on hover.
          Modified clicks are left alone below so the browser handles them itself; only a
          plain left click is taken over for client-side routing.

          A group header stays a button — it opens a submenu rather than going anywhere,
          so there is no address for it to carry. */}
      <RowTag
        {...(hasChildren ? { type: 'button' as const } : { href: item.path })}
        onClick={(event: React.MouseEvent) => {
          if (!hasChildren) {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
            event.preventDefault();
            onNavigate(item.path);
            return;
          }
          // Collapsed, hovering already shows the group as a floating panel, so a click
          // means "give me the full rail" — and it is also the only way in on a touch
          // screen, where there is no hover to open the panel with.
          if (collapsed) {
            setFlyout(null);
            onExpand?.();
            setOpen(true);
            return;
          }
          setOpen((o) => !o);
        }}
        className={cn(
          'flex w-full items-center rounded-lg text-sm transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          colorful ? 'gap-2.5 py-1.5 pl-2 pr-3' : 'gap-2 px-3 py-2',
          colorful ? 'hover:bg-accent' : 'hover:bg-accent hover:text-accent-foreground',
          // Inactive items are off-white, not muted grey: the rail is always dark (see
          // `force-dark` below), so the usual muted token reads as low-contrast here.
          //
          // The current row is a solid lighter block — a flat white overlay, not a tint
          // of the item's hue. A translucent hue wash at this opacity barely separated
          // from the rail; the colour does its work in the left bar and the icon chip,
          // where it is at full strength, and the block just lifts the row off the
          // background.
          //
          // An ancestor of the current row gets weight and full-strength text but no
          // block, so it reads as the trail rather than the destination.
          current
            ? 'bg-white/10 font-medium text-foreground'
            : active
              ? 'font-medium text-foreground'
              : 'text-foreground/85 hover:text-foreground',
        )}
      >
        {Icon &&
          (colorful ? (
            <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-md', iconColor.chip)}>
              <Icon className="size-4" />
            </span>
          ) : (
            <Icon className="size-4 shrink-0" />
          ))}
        <span className={cn('flex-1 truncate text-left', collapsed && 'sr-only')}>{item.label}</span>
        {hasChildren && !collapsed && (
          <ChevronDown className={cn('size-4 shrink-0 transition-transform duration-200', open && 'rotate-180')} />
        )}
      </RowTag>

      {/* `force-dark` again here: portalled to the body, the panel is outside the
          aside that pins the dark palette, so it would otherwise render in the page's
          theme and look like a different product in light mode. */}
      {collapsed &&
        hasChildren &&
        flyout &&
        createPortal(
          <div
            className="force-dark fixed z-50 w-52 rounded-lg border border-border bg-card p-1 text-foreground shadow-lg"
            style={{ top: flyout.top, left: flyout.left }}
            onMouseEnter={showFlyout}
            onMouseLeave={hideFlyout}
          >
            <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {item.label}
            </p>
            <ul>
              {item.children!.map((child) => (
                <li key={child.path}>
                  {/* Anchors here too — see the note on the row above. */}
                  <a
                    href={child.path}
                    onClick={(event) => {
                      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
                      event.preventDefault();
                      setFlyout(null);
                      onNavigate(child.path);
                    }}
                    className={cn(
                      'flex w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors',
                      child.path === currentPath
                        ? 'bg-white/10 font-medium text-foreground'
                        : 'text-foreground/85 hover:bg-accent hover:text-foreground',
                    )}
                  >
                    {child.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )}
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
                  // Sub-items carry no icon, so they take the group's colour. Without
                  // this a selected child fell back to the generic default and lit up in
                  // a hue unrelated to the group it sits inside.
                  inherited={iconColor}
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
    // `force-dark` (see styles/theme.css) pins the dark palette here, so the nav stays
    // dark in light mode. Done with the theme tokens rather than hardcoded slate
    // classes so every child — icons, active states, the footer — moves together.
    <aside
      className={cn(
        'force-dark flex h-full flex-col border-r border-border bg-card text-foreground transition-[width]',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <div className="flex h-14 shrink-0 items-center justify-center gap-2 border-b border-border px-3">
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
                  onExpand={onCollapsedChange ? () => onCollapsedChange(false) : undefined}
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
