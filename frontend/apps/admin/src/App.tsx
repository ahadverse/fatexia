import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import type { ManagerPermission } from '@fatexia/types';
import { Toaster } from '@fatexia/ui';
import { Shell } from './Shell';
import { Login } from './pages/Login';
import { useSession } from './session/SessionContext';
import { useAccess } from './session/AccessContext';

import { Dashboard } from './pages/Dashboard';
import { AffiliateCrOptimizer, OfferCrOptimizer } from './pages/CrOptimizer';

import { AllOffers } from './pages/offers/AllOffers';
import { CreateOffer } from './pages/offers/CreateOffer';
import { EditOffer } from './pages/offers/EditOffer';
import { OfferDetails } from './pages/offers/OfferDetails';
import { Categories } from './pages/offers/Categories';
import { SmartLinks } from './pages/offers/SmartLinks';
import { SmartLinkForm } from './pages/offers/SmartLinkForm';
import { AccessRequests, OfferApprovals } from './pages/offers/AccessRequests';
import { AffiliateOfferCr } from './pages/offers/AffiliateOfferCr';

import { AllBlogs } from './pages/blogs/AllBlogs';
import { CreateBlog } from './pages/blogs/CreateBlog';
import { EditBlog } from './pages/blogs/EditBlog';
import { BlogDetails } from './pages/blogs/BlogDetails';

import { AllAffiliates, PendingAffiliates } from './pages/affiliates/AllAffiliates';
import { CreateAffiliate } from './pages/affiliates/CreateAffiliate';
import { EditAffiliate } from './pages/affiliates/EditAffiliate';
import { AffiliateGroups } from './pages/affiliates/AffiliateGroups';
import { AffiliatePoints } from './pages/affiliates/AffiliatePoints';
import { ReferralProgram } from './pages/affiliates/ReferralProgram';
import { AffiliateMessages } from './pages/affiliates/AffiliateMessages';

import { AllAdvertisers, PendingAdvertisers } from './pages/advertisers/AllAdvertisers';
import { CreateAdvertiser } from './pages/advertisers/CreateAdvertiser';

import { AccountManagers, AffiliateManagers, GeneralManagers, Managers } from './pages/managers/Managers';
import { CreateManager } from './pages/managers/CreateManager';

import {
  AdvancedReport,
  AdvertiserReport,
  AffiliateReport,
  ConversionReport,
  OfferReport,
  PerformanceReport,
  SubIdReport,
} from './pages/reports/GroupedReports';
import { ClickLogs } from './pages/reports/ClickLogs';
import { Conversions } from './pages/reports/Conversions';
import { PostbackLogs } from './pages/reports/PostbackLogs';

import { Notifications } from './pages/others/Notifications';
import { Settings } from './pages/others/Settings';
import { Billing } from './pages/others/Billing';
// Subscriptions is hidden from the nav for now (see menu.ts) — page kept on disk,
// import and route commented out together so it comes back in one edit.
// import { Subscriptions } from './pages/others/Subscriptions';
import { EmailTemplates } from './pages/emails/EmailTemplates';
import { EmailSettings } from './pages/emails/EmailSettings';
import { SendEmail } from './pages/emails/SendEmail';
import { News } from './pages/others/News';
import { Integrations } from './pages/others/Integrations';
import { Profile } from './pages/others/Profile';

/**
 * Renders `element` only if the signed-in staff account may reach it (issue #20).
 *
 * A blocked route redirects to the dashboard rather than showing "forbidden": the nav
 * already hides these entries, so the only way to land here is a typed or bookmarked
 * URL, and a manager doesn't need a lecture about a page they weren't looking for.
 */
function Guarded({ element, permission, adminOnly }: { element: ReactNode; permission?: ManagerPermission; adminOnly?: boolean }) {
  const { isAdmin, can, loading } = useAccess();
  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;
  if (permission && !can(permission)) return <Navigate to="/" replace />;
  return <>{element}</>;
}

function App() {
  const { status } = useSession();

  if (status === 'loading') {
    return <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">Loading…</div>;
  }

  if (status === 'anonymous') {
    return (
      <>
        <Login />
        <Toaster />
      </>
    );
  }

  return (
    <BrowserRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<Dashboard />} />

          <Route path="/offers" element={<Navigate to="/offers/all" replace />} />
          <Route path="/offers/all" element={<Guarded permission="offers.view" element={<AllOffers />} />} />
          <Route path="/offers/create" element={<Guarded permission="offers.create" element={<CreateOffer />} />} />
          <Route path="/offers/categories" element={<Guarded permission="offers.edit" element={<Categories />} />} />
          <Route path="/offers/cr-optimizer" element={<Guarded permission="reports.view" element={<OfferCrOptimizer />} />} />
          <Route path="/offers/affiliate-offer-cr" element={<Guarded permission="reports.view" element={<AffiliateOfferCr />} />} />
          <Route path="/offers/smart-links" element={<Guarded permission="offers.view" element={<SmartLinks />} />} />
          {/* Creating and editing need offers.create/edit, not offers.view — a manager
              who may only read the list must not reach the form by typing the URL. */}
          <Route path="/offers/smart-links/create" element={<Guarded permission="offers.create" element={<SmartLinkForm />} />} />
          <Route path="/offers/smart-links/:id" element={<Guarded permission="offers.edit" element={<SmartLinkForm />} />} />
          <Route path="/offers/approvals" element={<Guarded permission="offers.edit" element={<OfferApprovals />} />} />
          <Route path="/offers/access-requests" element={<Guarded permission="offers.edit" element={<AccessRequests />} />} />
          <Route path="/offers/:id" element={<Guarded permission="offers.view" element={<OfferDetails />} />} />
          <Route path="/offers/:id/edit" element={<Guarded permission="offers.edit" element={<EditOffer />} />} />

          <Route path="/blogs" element={<Navigate to="/blogs/all" replace />} />
          <Route path="/blogs/all" element={<Guarded adminOnly element={<AllBlogs />} />} />
          <Route path="/blogs/create" element={<Guarded adminOnly element={<CreateBlog />} />} />
          <Route path="/blogs/:id" element={<Guarded adminOnly element={<BlogDetails />} />} />
          <Route path="/blogs/:id/edit" element={<Guarded adminOnly element={<EditBlog />} />} />

          <Route path="/affiliates" element={<Navigate to="/affiliates/all" replace />} />
          <Route path="/affiliates/all" element={<Guarded permission="affiliates.view" element={<AllAffiliates />} />} />
          <Route path="/affiliates/create" element={<Guarded permission="affiliates.create" element={<CreateAffiliate />} />} />
          <Route path="/affiliates/pending" element={<Guarded permission="affiliates.view" element={<PendingAffiliates />} />} />
          <Route path="/affiliates/referral-program" element={<Guarded permission="affiliates.view" element={<ReferralProgram />} />} />
          <Route path="/affiliates/groups" element={<Guarded permission="affiliates.edit" element={<AffiliateGroups />} />} />
          <Route path="/affiliates/cr-optimizer" element={<Guarded permission="reports.view" element={<AffiliateCrOptimizer />} />} />
          <Route path="/affiliates/points" element={<Guarded permission="affiliates.view" element={<AffiliatePoints />} />} />
          <Route path="/affiliates/messages" element={<Guarded permission="affiliates.view" element={<AffiliateMessages />} />} />
          <Route path="/affiliates/:id/edit" element={<Guarded permission="affiliates.edit" element={<EditAffiliate />} />} />

          <Route path="/advertisers" element={<Navigate to="/advertisers/all" replace />} />
          <Route path="/advertisers/all" element={<Guarded permission="advertisers.manage" element={<AllAdvertisers />} />} />
          <Route path="/advertisers/create" element={<Guarded permission="advertisers.manage" element={<CreateAdvertiser />} />} />
          <Route path="/advertisers/pending" element={<Guarded permission="advertisers.manage" element={<PendingAdvertisers />} />} />

          {/* Staff management is admin-only: a manager who could edit the permission
              grid could grant themselves every box on it. */}
          <Route path="/managers" element={<Navigate to="/managers/all" replace />} />
          <Route path="/managers/all" element={<Guarded adminOnly element={<Managers />} />} />
          <Route path="/managers/create" element={<Guarded adminOnly element={<CreateManager />} />} />
          <Route path="/managers/affiliate-managers" element={<Guarded adminOnly element={<AffiliateManagers />} />} />
          <Route path="/managers/account-managers" element={<Guarded adminOnly element={<AccountManagers />} />} />
          <Route path="/managers/general-managers" element={<Guarded adminOnly element={<GeneralManagers />} />} />

          <Route path="/reports" element={<Navigate to="/reports/performance" replace />} />
          <Route path="/reports/performance" element={<Guarded permission="reports.view" element={<PerformanceReport />} />} />
          <Route path="/reports/clicks" element={<Guarded permission="reports.view" element={<ClickLogs />} />} />
          <Route path="/reports/conversions" element={<Guarded permission="reports.view" element={<Conversions />} />} />
          <Route path="/reports/sub-id-tracking" element={<Guarded permission="reports.view" element={<SubIdReport />} />} />
          <Route path="/reports/postback-logs" element={<Guarded permission="reports.view" element={<PostbackLogs />} />} />
          <Route path="/reports/offer" element={<Guarded permission="reports.view" element={<OfferReport />} />} />
          <Route path="/reports/affiliate" element={<Guarded permission="reports.view" element={<AffiliateReport />} />} />
          <Route path="/reports/advertiser" element={<Guarded permission="reports.view" element={<AdvertiserReport />} />} />
          <Route path="/reports/conversion" element={<Guarded permission="reports.view" element={<ConversionReport />} />} />
          <Route path="/reports/advanced" element={<Guarded permission="reports.view" element={<AdvancedReport />} />} />
          {/* Click Logs was folded into Clicks (same row-level table) — kept as a redirect
              so old links and the dashboard's stat-card shortcuts still land somewhere. */}
          <Route path="/reports/click-logs" element={<Navigate to="/reports/clicks" replace />} />

          <Route path="/notifications" element={<Notifications />} />
          <Route path="/settings" element={<Guarded adminOnly element={<Settings />} />} />
          <Route path="/billing" element={<Guarded adminOnly element={<Billing />} />} />
          {/* Subscriptions route hidden alongside its nav entry; /subscriptions falls
              through to the catch-all below and lands on the dashboard. */}
          {/* <Route path="/subscriptions" element={<Subscriptions />} /> */}
          <Route path="/emails" element={<Navigate to="/emails/templates" replace />} />
          <Route path="/emails/templates" element={<Guarded adminOnly element={<EmailTemplates />} />} />
          <Route path="/emails/send" element={<Guarded adminOnly element={<SendEmail />} />} />
          <Route path="/emails/settings" element={<Guarded adminOnly element={<EmailSettings />} />} />
          {/* The templates page used to live here — kept as a redirect so bookmarks
              and any linked-to URL still resolve. */}
          <Route path="/email-templates" element={<Navigate to="/emails/templates" replace />} />
          <Route path="/news" element={<Guarded adminOnly element={<News />} />} />
          <Route path="/integrations" element={<Guarded adminOnly element={<Integrations />} />} />
          <Route path="/profile" element={<Profile />} />

          {/* Unknown paths land on the dashboard rather than a dead end. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>
      <Toaster />
    </BrowserRouter>
  );
}

export default App;
