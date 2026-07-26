'use client';

import { useState, type ReactNode } from 'react';
import type { MenuConfig } from '@fatexia/types';
import { cn } from '../lib/cn';
import { Sidebar } from './Sidebar';
import { Topbar, type TopbarProps } from './Topbar';

export interface AppShellProps extends TopbarProps {
  menu: MenuConfig;
  currentPath: string;
  onNavigate: (path: string) => void;
  children: ReactNode;
  logoMark?: ReactNode;
  logoText?: string;
  userName?: string;
}

export function AppShell({ menu, currentPath, onNavigate, children, logoMark, logoText, userName, ...topbarProps }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  function handleNavigate(path: string) {
    onNavigate(path);
    setMobileNavOpen(false);
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-background text-foreground">
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 bg-background/80 md:hidden" onClick={() => setMobileNavOpen(false)} aria-hidden="true" />
      )}
      <div className={cn('fixed inset-y-0 left-0 z-50 transition-transform md:static md:translate-x-0', mobileNavOpen ? 'translate-x-0' : '-translate-x-full')}>
        <Sidebar
          menu={menu}
          currentPath={currentPath}
          onNavigate={handleNavigate}
          collapsed={collapsed}
          onCollapsedChange={setCollapsed}
          logoMark={logoMark}
          logoText={logoText}
          userName={userName}
          userRole={topbarProps.userLabel}
        />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar {...topbarProps} onMenuClick={() => setMobileNavOpen(true)} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
