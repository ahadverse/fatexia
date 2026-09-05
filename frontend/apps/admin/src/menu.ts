import type { ManagerPermission, MenuConfig, MenuItem } from '@fatexia/types';

/**
 * Full nav per PLAN-admin.md — merged from cpatracker's super-admin + network-admin
 * menus, tenant-only items dropped (single network), MarketPlace dropped (unclear
 * scope for a single network, see PLAN.md open items).
 *
 * Every entry carries what it takes to see it (issue #4/#20):
 *   `permission` — a manager needs this ticked; an admin always passes.
 *   `adminOnly`  — network-level surfaces no manager gets regardless of their grid:
 *                  integrations credentials, staff management, billing, network
 *                  settings, and the email/blog/news publishing tools.
 *
 * `buildMenu` below prunes the tree; the same predicate drives the routes in App.tsx,
 * so a hidden item is also an unreachable URL rather than just an invisible one.
 */
interface GuardedItem extends Omit<MenuItem, 'children'> {
  permission?: ManagerPermission;
  adminOnly?: boolean;
  children?: GuardedItem[];
}

interface GuardedGroup {
  label?: string;
  items: GuardedItem[];
}

const MENU: GuardedGroup[] = [
  {
    items: [{ label: 'Dashboard', path: '/', icon: 'dashboard' }],
  },
  {
    label: 'MANAGE',
    items: [
      {
        label: 'Offers',
        path: '/offers',
        icon: 'offers',
        permission: 'offers.view',
        children: [
          { label: 'Create Offer', path: '/offers/create', permission: 'offers.create' },
          { label: 'All Offers', path: '/offers/all', permission: 'offers.view' },
          { label: 'Categories', path: '/offers/categories', permission: 'offers.edit' },
          { label: 'CR Optimizer', path: '/offers/cr-optimizer', permission: 'reports.view' },
          { label: 'Affiliate + Offer CR', path: '/offers/affiliate-offer-cr', permission: 'reports.view' },
          { label: 'Smart-Links', path: '/offers/smart-links', permission: 'offers.view' },
          { label: 'Offer Approvals', path: '/offers/approvals', permission: 'offers.edit' },
          { label: 'Access Requests', path: '/offers/access-requests', permission: 'offers.edit' },
        ],
      },
      {
        label: 'Affiliates',
        path: '/affiliates',
        icon: 'affiliates',
        permission: 'affiliates.view',
        children: [
          { label: 'Create Affiliate', path: '/affiliates/create', permission: 'affiliates.create' },
          { label: 'All Affiliates', path: '/affiliates/all', permission: 'affiliates.view' },
          { label: 'Pending', path: '/affiliates/pending', permission: 'affiliates.view' },
          { label: 'Referral Program', path: '/affiliates/referral-program', permission: 'affiliates.view' },
          { label: 'Affiliate Groups', path: '/affiliates/groups', permission: 'affiliates.edit' },
          { label: 'CR Optimizer', path: '/affiliates/cr-optimizer', permission: 'reports.view' },
          { label: 'All Affiliate Points', path: '/affiliates/points', permission: 'affiliates.view' },
          { label: 'Affiliate Messages', path: '/affiliates/messages', permission: 'affiliates.view' },
        ],
      },
      {
        label: 'Advertisers',
        path: '/advertisers',
        icon: 'advertisers',
        permission: 'advertisers.manage',
        children: [
          { label: 'Create Advertiser', path: '/advertisers/create', permission: 'advertisers.manage' },
          { label: 'All Advertisers', path: '/advertisers/all', permission: 'advertisers.manage' },
          { label: 'Pending', path: '/advertisers/pending', permission: 'advertisers.manage' },
        ],
      },
      {
        label: 'Blogs',
        path: '/blogs',
        icon: 'news',
        adminOnly: true,
        children: [
          { label: 'Create Post', path: '/blogs/create' },
          { label: 'All Posts', path: '/blogs/all' },
        ],
      },
      {
        label: 'Managers',
        path: '/managers',
        icon: 'managers',
        // Staff management stays with the admin: a manager who could edit the
        // permission grid could grant themselves anything on it (issue #20).
        adminOnly: true,
        children: [
          { label: 'Create Manager', path: '/managers/create' },
          { label: 'All Managers', path: '/managers/all' },
          { label: 'Affiliate Managers', path: '/managers/affiliate-managers' },
          { label: 'Account Managers', path: '/managers/account-managers' },
          { label: 'General Managers', path: '/managers/general-managers' },
        ],
      },
    ],
  },
  {
    label: 'ANALYSE',
    items: [
      {
        label: 'Reports',
        path: '/reports',
        icon: 'reports',
        permission: 'reports.view',
        children: [
          { label: 'Performance', path: '/reports/performance' },
          { label: 'Clicks', path: '/reports/clicks' },
          { label: 'Conversions', path: '/reports/conversions' },
          { label: 'Sub-ID Tracking', path: '/reports/sub-id-tracking' },
          { label: 'Postback Logs', path: '/reports/postback-logs' },
          { label: 'Offer Reports', path: '/reports/offer' },
          { label: 'Affiliate Reports', path: '/reports/affiliate' },
          { label: 'Advertiser Reports', path: '/reports/advertiser' },
          { label: 'Conversion Reports', path: '/reports/conversion' },
          { label: 'Advanced Reports', path: '/reports/advanced' },
        ].map((item) => ({ ...item, permission: 'reports.view' as ManagerPermission }),
        ),
      },
    ],
  },
  {
    label: 'OTHERS',
    items: [
      { label: 'Notifications', path: '/notifications', icon: 'notifications' },
      { label: 'Settings', path: '/settings', icon: 'settings', adminOnly: true },
      { label: 'Billing', path: '/billing', icon: 'billing', adminOnly: true },
      // Subscriptions is hidden for now — the page, its route and the /subscriptions
      // API are all untouched, so restoring it is uncommenting this line and the
      // matching route in App.tsx.
      // { label: 'Subscriptions', path: '/subscriptions', icon: 'subscription' },
      {
        label: 'Emails',
        path: '/emails',
        icon: 'email',
        adminOnly: true,
        children: [
          { label: 'Templates', path: '/emails/templates' },
          { label: 'Send Email', path: '/emails/send' },
          { label: 'Settings', path: '/emails/settings' },
        ],
      },
      { label: 'News', path: '/news', icon: 'news', adminOnly: true },
      { label: 'Integrations', path: '/integrations', icon: 'integrations', adminOnly: true },
      { label: 'Profile', path: '/profile', icon: 'profile' },
      { label: 'Logout', path: '/logout', icon: 'logout' },
    ],
  },
];

export interface MenuAccess {
  isAdmin: boolean;
  can: (permission: ManagerPermission) => boolean;
}

function isVisible(item: GuardedItem, access: MenuAccess): boolean {
  if (item.adminOnly && !access.isAdmin) return false;
  return !item.permission || access.can(item.permission);
}

function pruneItem(item: GuardedItem, access: MenuAccess): MenuItem | null {
  if (!isVisible(item, access)) return null;
  if (!item.children) {
    return { label: item.label, path: item.path, icon: item.icon };
  }
  const children = item.children.map((child) => pruneItem(child, access)).filter((child): child is MenuItem => child !== null);
  // A parent whose every child was pruned would be a section that opens onto nothing.
  if (children.length === 0) return null;
  return { label: item.label, path: item.path, icon: item.icon, children };
}

export function buildMenu(access: MenuAccess): MenuConfig {
  return {
    groups: MENU.map((group) => ({
      label: group.label,
      items: group.items.map((item) => pruneItem(item, access)).filter((item): item is MenuItem => item !== null),
    })).filter((group) => group.items.length > 0),
  };
}

/** The complete nav, as an admin sees it. */
export const adminMenu: MenuConfig = buildMenu({ isAdmin: true, can: () => true });
