import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { SignIn, SignUp, useAuth, useClerk, useSession } from '@clerk/clerk-react';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import LandingPage from './pages/LandingPage.jsx';
import clerkAppearance from './utils/clerkAppearance.js';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import ScrollToTop from './components/ScrollToTop.jsx';
import { apiUrl } from './lib/api.js';

const Validator = lazy(() => import('./pages/Validator.jsx'));
const SignupValidator = lazy(() => import('./pages/SignupValidator.jsx'));
const SigninValidator = lazy(() => import('./pages/SigninValidator.jsx'));
const ValidatorDashboard = lazy(() => import('./pages/ValidatorDashboard.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.tsx'));
const MonitorDetails = lazy(() => import('./components/monitor/MonitorDetails.tsx'));

export default function App() {
  const { pathname } = useLocation();
  const { session } = useSession();
  const { user } = useClerk();
  const { getToken } = useAuth();

  useEffect(() => {
    if (!session || !user?.primaryEmailAddress?.emailAddress) return;
    const syncUser = async () => {
      const token = await getToken();
      const response = await fetch(apiUrl('/user'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: user.primaryEmailAddress.emailAddress }),
      });
      if (!response.ok) throw new Error('Account sync failed');
    };
    syncUser().catch((error) => console.error(error.message));
  }, [session, user, getToken]);

  const accountPage = pathname.startsWith('/sign-up') || pathname.startsWith('/sign-in');

  return (
    <div className="flex min-h-screen flex-col bg-[#07110e]">
      <ScrollToTop />
      {!accountPage && <Navbar />}
      <Suspense fallback={<div className="grid min-h-screen place-items-center text-sm text-slate-400">Loading…</div>}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/validator" element={<Validator />} />
          <Route path="/validators" element={<Navigate to="/validator" replace />} />
          <Route path="/sign-up/*" element={<main className="grid min-h-screen place-items-center px-4 py-10"><SignUp routing="path" path="/sign-up" signInUrl="/sign-in" fallbackRedirectUrl="/dashboard" appearance={clerkAppearance} /></main>} />
          <Route path="/sign-in/*" element={<main className="grid min-h-screen place-items-center px-4 py-10"><SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" fallbackRedirectUrl="/dashboard" appearance={clerkAppearance} /></main>} />
          <Route path="/signup" element={<Navigate to="/sign-up" replace />} />
          <Route path="/signin" element={<Navigate to="/sign-in" replace />} />
          <Route path="/signup-validator" element={<SignupValidator />} />
          <Route path="/signin-validator" element={<SigninValidator />} />
          <Route path="/validator-dashboard" element={<ValidatorDashboard />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/monitor/:id" element={<ProtectedRoute><MonitorDetails /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      {!accountPage && <Footer />}
    </div>
  );
}
