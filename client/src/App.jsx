import { useEffect } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { restoreSession, sessionExpired } from './features/auth/authSlice.js';
import { AccountSettingsPage } from './pages/account/AccountSettingsPage.jsx';
import { AccountDetailsPage, AppearanceSettingsPage, EditProfilePage, InformationSettingsPage, NotificationSettingsPage, PrivacySettingsPage, SecuritySettingsPage } from './pages/account/SettingsPages.jsx';
import { AuthPage } from './pages/auth/AuthPage.jsx';
import { PasswordRecoveryPage } from './pages/auth/PasswordRecoveryPage.jsx';
import { VerifyEmailPage } from './pages/auth/VerifyEmailPage.jsx';
import { ConversationHome } from './pages/chat/ConversationHome.jsx';
import { LoadingState } from './components/common/LoadingState.jsx';
import { Toaster } from 'sonner';

function LoadingScreen() {
  return <main className="grid min-h-screen place-items-center bg-[#F8F8F6]"><LoadingState>Restoring your WolfLink session…</LoadingState></main>;
}

function AuthBootstrap() {
  const dispatch = useDispatch();
  const status = useSelector((state) => state.auth.status);

  useEffect(() => {
    dispatch(restoreSession());
    const onExpired = () => dispatch(sessionExpired());
    window.addEventListener('wolflink:session-expired', onExpired);
    return () => window.removeEventListener('wolflink:session-expired', onExpired);
  }, [dispatch]);

  if (status === 'checking') return <LoadingScreen />;
  return <Routes>
    <Route element={<PublicOnly />}>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />
      <Route path="/forgot-password" element={<PasswordRecoveryPage />} />
    </Route>
    <Route element={<RequireAuth />}>
      <Route path="/" element={<ConversationHome />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/settings" element={<Navigate to="/settings/profile" replace />} />
      <Route path="/settings/profile" element={<AccountSettingsPage />} />
      <Route path="/settings/edit-profile" element={<EditProfilePage />} />
      <Route path="/settings/account" element={<AccountDetailsPage />} />
      <Route path="/settings/privacy" element={<PrivacySettingsPage />} />
      <Route path="/settings/security" element={<SecuritySettingsPage />} />
      <Route path="/settings/appearance" element={<AppearanceSettingsPage />} />
      <Route path="/settings/notifications" element={<NotificationSettingsPage />} />
      <Route path="/settings/about" element={<InformationSettingsPage kind="about" />} />
      <Route path="/settings/terms" element={<InformationSettingsPage kind="terms" />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}

function PublicOnly() {
  const { status, user } = useSelector((state) => state.auth);
  if (status === 'checking') return <LoadingScreen />;
  return user ? <Navigate to="/" replace /> : <Outlet />;
}

function RequireAuth() {
  const { status, user } = useSelector((state) => state.auth);
  const location = useLocation();
  if (status === 'checking') return <LoadingScreen />;
  return user ? <Outlet /> : <Navigate to="/login" replace state={{ from: location }} />;
}

export default function App() {
  useEffect(() => {
    document.documentElement.dataset.theme = localStorage.getItem('wolflink:theme') === 'dark' ? 'dark' : 'light';
    localStorage.removeItem('wolflink:message-sounds');
  }, []);
  return <><Toaster position="top-right" richColors closeButton toastOptions={{ style: { fontFamily: 'Segoe UI, sans-serif' } }} /><AuthBootstrap /></>;
}
