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
}: {
  item: MenuItem;
  currentPath: string;
  onNavigate: (path: string) => void;
  collapsed: boolean;
  depth: number;
}) {
  const active = isActive(item, currentPath);
  const [open, setOpen] = useState(active);
  const hasChildren = !!item.children?.length;
  const Icon = depth === 0 ? resolveIcon(item.icon) : null;

  return (
    <li>
      <button
        type="button"
        onClick={() => (hasChildren ? setOpen((o) => !o) : onNavigate(item.path))}
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground',
        )}
      >
        {Icon && <Icon className="size-4 shrink-0" />}
        <span className={cn('flex-1 truncate text-left', collapsed && 'sr-only')}>{item.label}</span>
        {hasChildren && !collapsed && (
          <ChevronDown className={cn('size-4 shrink-0 transition-transform duration-200', open && 'rotate-180')} />
        )}
      </button>
      {hasChildren && !collapsed && (
        <div className="grid transition-[grid-template-rows] duration-200 ease-out" style={{ gridTemplateRows: open ? '1fr' : '0fr' }}>
          <div className="overflow-hidden">
            <ul className="ml-3 mt-1 space-y-0.5 border-l border-border pl-3">
              {item.children!.map((child) => (
                <SidebarItem key={child.path} item={child} currentPath={currentPath} onNavigate={onNavigate} collapsed={collapsed} depth={depth + 1} />
              ))}
            </ul>
          </div>
        </div>
      )}
    </li>
  );
}

export function Sidebar({ menu, currentPath, onNavigate, collapsed = false, onCollapsedChange, logoMark, logoText, userName, userRole }: SidebarProps) {
  return (
    <aside className={cn('flex h-full flex-col border-r border-border bg-card transition-[width]', collapsed ? 'w-16' : 'w-64')}>
      {(logoMark || logoText) && (
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3">
          {logoMark}
          {logoText && !collapsed && <span className="truncate font-semibold text-foreground">{logoText}</span>}
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {menu.groups.map((group, i) => (
          <div key={group.label ?? i} className={i > 0 ? 'mt-4' : undefined}>
            {group.label && !collapsed && (
              <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <SidebarItem key={item.path} item={item} currentPath={currentPath} onNavigate={onNavigate} collapsed={collapsed} depth={0} />
              ))}
            </ul>
          </div>
        ))}
      </nav>
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
