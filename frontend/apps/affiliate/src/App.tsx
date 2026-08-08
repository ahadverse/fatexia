import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from '@fatexia/ui';
import { Shell } from './Shell';
import { Login } from './pages/auth/Login';
import { Register } from './pages/auth/Register';
import { useSession } from './session/SessionContext';

import { Dashboard } from './pages/Dashboard';

import { Browse } from './pages/offers/Browse';
import { RequestAccess } from './pages/offers/RequestAccess';
import { TrackingLink } from './pages/offers/TrackingLink';
import { SmartLinks } from './pages/offers/SmartLinks';

import { Performance } from './pages/reports/Performance';
import { Clicks } from './pages/reports/Clicks';
import { Conversions } from './pages/reports/Conversions';

import { Payments } from './pages/others/Payments';
import { Messages } from './pages/others/Messages';
import { News } from './pages/others/News';
import { Notifications } from './pages/others/Notifications';
import { ReferralProgram } from './pages/others/ReferralProgram';
import { PostbackSetup } from './pages/others/PostbackSetup';
import { Profile } from './pages/others/Profile';

function App() {
  const { status } = useSession();

  if (status === 'loading') {
    return <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">Loading…</div>;
  }

  // Signed-out visitors get their own small router so /register is a real, linkable
  // URL rather than a state flag — the public site links straight to it, and a
  // half-finished application survives a refresh of the address bar.
  if (status === 'anonymous') {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          {/* Any deep link while signed out lands on sign-in. The intended
              destination is not preserved — that would need the login to redirect
              back, which is a separate piece of work. */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        <Toaster />
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<Dashboard />} />

          <Route path="/offers" element={<Navigate to="/offers/browse" replace />} />
          <Route path="/offers/browse" element={<Browse />} />
          <Route path="/offers/request-access" element={<RequestAccess />} />
          <Route path="/offers/tracking-link" element={<TrackingLink />} />
          <Route path="/offers/smart-links" element={<SmartLinks />} />

          <Route path="/reports" element={<Navigate to="/reports/performance" replace />} />
          <Route path="/reports/performance" element={<Performance />} />
          <Route path="/reports/clicks" element={<Clicks />} />
          <Route path="/reports/conversions" element={<Conversions />} />

          <Route path="/payments" element={<Payments />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/news" element={<News />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/referral-program" element={<ReferralProgram />} />
          <Route path="/postback-setup" element={<PostbackSetup />} />
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
