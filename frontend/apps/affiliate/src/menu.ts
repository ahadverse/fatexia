import type { MenuConfig } from '@fatexia/types';

// Nav per PLAN-affiliate-portal.md. Points is deliberately not a nav item (see that
// plan's Payments/Points section) — it's informational, surfaced on Dashboard/Profile
// instead of getting its own screen. Most items route to ComingSoon until that
// Backend module exists for real — see PROGRESS.md for what's live.
export const affiliateMenu: MenuConfig = {
  groups: [
    {
      items: [{ label: 'Dashboard', path: '/', icon: 'dashboard' }],
    },
    {
      label: 'OFFERS',
      items: [
        {
          label: 'Offers',
          path: '/offers',
          icon: 'offers',
          children: [
            { label: 'Browse', path: '/offers/browse' },
            { label: 'Request Access', path: '/offers/request-access' },
            { label: 'Tracking Link', path: '/offers/tracking-link' },
            { label: 'Smart-Links', path: '/offers/smart-links' },
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
          children: [
            { label: 'Performance', path: '/reports/performance' },
            { label: 'Clicks', path: '/reports/clicks' },
            { label: 'Conversions', path: '/reports/conversions' },
          ],
        },
      ],
    },
    {
      label: 'OTHERS',
      items: [
        { label: 'Payments', path: '/payments', icon: 'billing' },
        { label: 'Messages', path: '/messages', icon: 'messages' },
        { label: 'Notifications', path: '/notifications', icon: 'notifications' },
        { label: 'News', path: '/news', icon: 'news' },
        { label: 'Referral Program', path: '/referral-program' },
        { label: 'Postback Setup', path: '/postback-setup' },
        { label: 'Profile', path: '/profile', icon: 'profile' },
        { label: 'Logout', path: '/logout', icon: 'logout' },
      ],
    },
  ],
};
