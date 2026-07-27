import type { MenuConfig } from '@fatexia/types';

// Full nav per PLAN-admin.md — merged from cpatracker's super-admin + network-admin
// menus, tenant-only items dropped (single network), MarketPlace dropped (unclear
// scope for a single network, see PLAN.md open items). Most items route to
// ComingSoon until that module is built for real — see PROGRESS.md for what's live.
export const adminMenu: MenuConfig = {
  groups: [
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
          children: [
            { label: 'Create Offer', path: '/offers/create' },
            { label: 'All Offers', path: '/offers/all' },
            { label: 'Categories', path: '/offers/categories' },
            { label: 'CR Optimizer', path: '/offers/cr-optimizer' },
            { label: 'Affiliate + Offer CR', path: '/offers/affiliate-offer-cr' },
            { label: 'Smart-Links', path: '/offers/smart-links' },
            { label: 'Offer Approvals', path: '/offers/approvals' },
            { label: 'Access Requests', path: '/offers/access-requests' },
          ],
        },
        {
          label: 'Affiliates',
          path: '/affiliates',
          icon: 'affiliates',
          children: [
            { label: 'Create Affiliate', path: '/affiliates/create' },
            { label: 'All Affiliates', path: '/affiliates/all' },
            { label: 'Pending', path: '/affiliates/pending' },
            { label: 'Referral Program', path: '/affiliates/referral-program' },
            { label: 'Affiliate Groups', path: '/affiliates/groups' },
            { label: 'CR Optimizer', path: '/affiliates/cr-optimizer' },
            { label: 'All Affiliate Points', path: '/affiliates/points' },
            { label: 'Affiliate Messages', path: '/affiliates/messages' },
          ],
        },
        {
          label: 'Advertisers',
          path: '/advertisers',
          icon: 'advertisers',
          children: [
            { label: 'Create Advertiser', path: '/advertisers/create' },
            { label: 'All Advertisers', path: '/advertisers/all' },
            { label: 'Pending', path: '/advertisers/pending' },
          ],
        },
        {
          label: 'Blogs',
          path: '/blogs',
          icon: 'news',
          children: [
            { label: 'Create Post', path: '/blogs/create' },
            { label: 'All Posts', path: '/blogs/all' },
          ],
        },
        // Managers is hidden for now. Its pages, routes and API all still exist —
        // restoring it is uncommenting this block and the matching routes in
        // App.tsx. Manager *assignment* is unaffected either way: the affiliate and
        // advertiser forms still load the manager list for their dropdowns.
        // {
        //   label: 'Managers',
        //   path: '/managers',
        //   icon: 'managers',
        //   children: [
        //     { label: 'Create Manager', path: '/managers/create' },
        //     { label: 'Affiliate Managers', path: '/managers/affiliate-managers' },
        //     { label: 'Account Managers', path: '/managers/account-managers' },
        //     { label: 'General Managers', path: '/managers/general-managers' },
        //   ],
        // },
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
            { label: 'Sub-ID Tracking', path: '/reports/sub-id-tracking' },
            { label: 'Postback Logs', path: '/reports/postback-logs' },
            { label: 'Offer Reports', path: '/reports/offer' },
            { label: 'Affiliate Reports', path: '/reports/affiliate' },
            { label: 'Advertiser Reports', path: '/reports/advertiser' },
            { label: 'Conversion Reports', path: '/reports/conversion' },
            { label: 'Advanced Reports', path: '/reports/advanced' },
            { label: 'Click Logs', path: '/reports/click-logs' },
          ],
        },
      ],
    },
    {
      label: 'OTHERS',
      items: [
        { label: 'Notifications', path: '/notifications', icon: 'notifications' },
        { label: 'Settings', path: '/settings', icon: 'settings' },
        { label: 'Billing', path: '/billing', icon: 'billing' },
        // Subscriptions is hidden for now, same pattern as Managers above — the page,
        // its route and the /subscriptions API are all untouched, so restoring it is
        // uncommenting this line and the matching route in App.tsx.
        // { label: 'Subscriptions', path: '/subscriptions', icon: 'subscription' },
        { label: 'Email Templates', path: '/email-templates', icon: 'email' },
        { label: 'News', path: '/news', icon: 'news' },
        { label: 'Integrations', path: '/integrations', icon: 'integrations' },
        { label: 'Profile', path: '/profile', icon: 'profile' },
        { label: 'Logout', path: '/logout', icon: 'logout' },
      ],
    },
  ],
};
