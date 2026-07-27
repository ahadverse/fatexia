import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from '@fatexia/ui';
import { Shell } from './Shell';
import { Login } from './pages/Login';
import { useSession } from './session/SessionContext';

import { Dashboard } from './pages/Dashboard';
import { AffiliateCrOptimizer, OfferCrOptimizer } from './pages/CrOptimizer';

import { AllOffers } from './pages/offers/AllOffers';
import { CreateOffer } from './pages/offers/CreateOffer';
import { EditOffer } from './pages/offers/EditOffer';
import { OfferDetails } from './pages/offers/OfferDetails';
import { Categories } from './pages/offers/Categories';
import { SmartLinks } from './pages/offers/SmartLinks';
import { AccessRequests, OfferApprovals } from './pages/offers/AccessRequests';
import { AffiliateOfferCr } from './pages/offers/AffiliateOfferCr';

import { AllBlogs } from './pages/blogs/AllBlogs';
import { CreateBlog } from './pages/blogs/CreateBlog';
import { EditBlog } from './pages/blogs/EditBlog';
import { BlogDetails } from './pages/blogs/BlogDetails';

import { AllAffiliates, PendingAffiliates } from './pages/affiliates/AllAffiliates';
import { CreateAffiliate } from './pages/affiliates/CreateAffiliate';
import { AffiliateGroups } from './pages/affiliates/AffiliateGroups';
import { AffiliatePoints } from './pages/affiliates/AffiliatePoints';
import { ReferralProgram } from './pages/affiliates/ReferralProgram';
import { AffiliateMessages } from './pages/affiliates/AffiliateMessages';

import { AllAdvertisers, PendingAdvertisers } from './pages/advertisers/AllAdvertisers';
import { CreateAdvertiser } from './pages/advertisers/CreateAdvertiser';

// Managers is hidden from the nav for now (see menu.ts). The pages are left on disk
// and their imports/routes commented out together, so the section comes back in one
// edit rather than needing to be rebuilt.
// import { AccountManagers, AffiliateManagers, GeneralManagers, Managers } from './pages/managers/Managers';
// import { CreateManager } from './pages/managers/CreateManager';

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
import { ReportView } from './components/ReportView';

import { Notifications } from './pages/others/Notifications';
import { Settings } from './pages/others/Settings';
import { Billing } from './pages/others/Billing';
// Subscriptions is hidden from the nav for now (see menu.ts) — page kept on disk,
// import and route commented out together so it comes back in one edit.
// import { Subscriptions } from './pages/others/Subscriptions';
import { EmailTemplates } from './pages/others/EmailTemplates';
import { News } from './pages/others/News';
import { Integrations } from './pages/others/Integrations';
import { Profile } from './pages/others/Profile';

// Reports → Clicks is the aggregate view (volume and quality over time); Reports →
// Click Logs is the row-level table. Two different questions, so two pages.
function ClicksReport() {
  return (
    <ReportView
      title="Clicks"
      description="Click volume over time, and how it breaks down by geo, device and source."
      selectableDimensions={['date', 'country', 'city', 'device', 'os', 'browser', 'offer', 'affiliate']}
      showTrend
    />
  );
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
          <Route path="/offers/all" element={<AllOffers />} />
          <Route path="/offers/create" element={<CreateOffer />} />
          <Route path="/offers/categories" element={<Categories />} />
          <Route path="/offers/cr-optimizer" element={<OfferCrOptimizer />} />
          <Route path="/offers/affiliate-offer-cr" element={<AffiliateOfferCr />} />
          <Route path="/offers/smart-links" element={<SmartLinks />} />
          <Route path="/offers/approvals" element={<OfferApprovals />} />
          <Route path="/offers/access-requests" element={<AccessRequests />} />
          <Route path="/offers/:id" element={<OfferDetails />} />
          <Route path="/offers/:id/edit" element={<EditOffer />} />

          <Route path="/blogs" element={<Navigate to="/blogs/all" replace />} />
          <Route path="/blogs/all" element={<AllBlogs />} />
          <Route path="/blogs/create" element={<CreateBlog />} />
          <Route path="/blogs/:id" element={<BlogDetails />} />
          <Route path="/blogs/:id/edit" element={<EditBlog />} />

          <Route path="/affiliates" element={<Navigate to="/affiliates/all" replace />} />
          <Route path="/affiliates/all" element={<AllAffiliates />} />
          <Route path="/affiliates/create" element={<CreateAffiliate />} />
          <Route path="/affiliates/pending" element={<PendingAffiliates />} />
          <Route path="/affiliates/referral-program" element={<ReferralProgram />} />
          <Route path="/affiliates/groups" element={<AffiliateGroups />} />
          <Route path="/affiliates/cr-optimizer" element={<AffiliateCrOptimizer />} />
          <Route path="/affiliates/points" element={<AffiliatePoints />} />
          <Route path="/affiliates/messages" element={<AffiliateMessages />} />

          <Route path="/advertisers" element={<Navigate to="/advertisers/all" replace />} />
          <Route path="/advertisers/all" element={<AllAdvertisers />} />
          <Route path="/advertisers/create" element={<CreateAdvertiser />} />
          <Route path="/advertisers/pending" element={<PendingAdvertisers />} />

          {/* Managers routes are hidden alongside their nav entry. Any /managers/*
              URL falls through to the catch-all below and lands on the dashboard. */}
          {/* <Route path="/managers" element={<Navigate to="/managers/all" replace />} />
          <Route path="/managers/all" element={<Managers />} />
          <Route path="/managers/create" element={<CreateManager />} />
          <Route path="/managers/affiliate-managers" element={<AffiliateManagers />} />
          <Route path="/managers/account-managers" element={<AccountManagers />} />
          <Route path="/managers/general-managers" element={<GeneralManagers />} /> */}

          <Route path="/reports" element={<Navigate to="/reports/performance" replace />} />
          <Route path="/reports/performance" element={<PerformanceReport />} />
          <Route path="/reports/clicks" element={<ClicksReport />} />
          <Route path="/reports/conversions" element={<Conversions />} />
          <Route path="/reports/sub-id-tracking" element={<SubIdReport />} />
          <Route path="/reports/postback-logs" element={<PostbackLogs />} />
          <Route path="/reports/offer" element={<OfferReport />} />
          <Route path="/reports/affiliate" element={<AffiliateReport />} />
          <Route path="/reports/advertiser" element={<AdvertiserReport />} />
          <Route path="/reports/conversion" element={<ConversionReport />} />
          <Route path="/reports/advanced" element={<AdvancedReport />} />
          <Route path="/reports/click-logs" element={<ClickLogs />} />

          <Route path="/notifications" element={<Notifications />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/billing" element={<Billing />} />
          {/* Subscriptions route hidden alongside its nav entry; /subscriptions falls
              through to the catch-all below and lands on the dashboard. */}
          {/* <Route path="/subscriptions" element={<Subscriptions />} /> */}
          <Route path="/email-templates" element={<EmailTemplates />} />
          <Route path="/news" element={<News />} />
          <Route path="/integrations" element={<Integrations />} />
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
