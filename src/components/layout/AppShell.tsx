import { useState, useEffect, Suspense } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { ThemeProvider } from '../../context/ThemeContext';
import { Menu, X } from 'lucide-react';
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
import { IS_DEV_AUTH_BYPASS } from '../../lib/clerkConfig';
import TopBar from './TopBar';
import CommandPalette from '../ui/CommandPalette';
import NotificationPanel from '../ui/NotificationPanel';

import { ToastProvider } from '../ui/Toast';
import TwoFactorGate from '../auth/TwoFactorGate';
import { apiFetch } from '../../lib/apiClient';
import { getSelectedWorkspaceId } from '../../lib/workspaceSelection';

function ContentFallback() {
  return <div className="flex-1 h-full w-full" style={{ background: 'var(--bg)' }} />;
}

export default function AppShell() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const isDevBypass = IS_DEV_AUTH_BYPASS;
  const location = useLocation();
  const navigate = useNavigate();

  // ── Onboarding first-login redirect (complete-platform item 6) ────────────
  // The server decides (GET /api/onboarding/status: owner + flag unset);
  // the shell just navigates. Once per tab session per selected workspace,
  // so leaving onboarding mid-flow doesn't bounce the user back on the next
  // page load; closing the tab re-arms it. /onboarding itself is outside
  // this shell, so the redirect cannot loop.
  useEffect(() => {
    const key = `onboarding-checked-${getSelectedWorkspaceId() ?? 'default'}`;
    if (sessionStorage.getItem(key)) return;
    let cancelled = false;
    apiFetch('/api/onboarding/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((s: { shouldRedirect?: boolean } | null) => {
        if (cancelled) return;
        sessionStorage.setItem(key, '1');
        if (s?.shouldRedirect) navigate('/onboarding', { replace: true });
      })
      .catch(() => {
        // Onboarding is a nicety, never a blocker: a failed status check
        // must not break the app. The check re-arms next session.
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onOpenCmd   = () => setCommandPaletteOpen(true);
    const onOpenNotif = () => setNotificationPanelOpen(true);
    document.addEventListener('open-command-palette', onOpenCmd);
    document.addEventListener('open-notifications', onOpenNotif);
    return () => {
      document.removeEventListener('open-command-palette', onOpenCmd);
      document.removeEventListener('open-notifications', onOpenNotif);
    };
  }, []);

  const content = (
    <ToastProvider>
      <ThemeProvider>
          <div
            className="flex h-screen overflow-hidden relative"
            style={{ background: 'var(--bg)' }}
          >
          {/* Mobile Header */}
          <div
            className="md:hidden h-[52px] flex items-center px-4 justify-between shrink-0 absolute top-0 left-0 right-0 z-40 border-b"
            style={{ background: 'var(--sidebar-bg)', borderColor: 'var(--sidebar-border)' }}
          >
            <div className="flex items-center gap-2">
              <img
                src="https://res.cloudinary.com/dbdrkehcp/image/upload/v1779753173/ChatGPT_Image_May_25_2026_07_51_34_PM_shkd53.png"
                alt="Stone AIO"
                className="w-9 h-9 object-contain shrink-0"
                style={{ filter: 'invert(1)', mixBlendMode: 'screen' }}
              />
              <span
                className="font-bold text-[14.5px] tracking-tight"
                style={{ color: 'var(--sidebar-text-main, var(--text-main))' }}
              >
                Stone AIO
              </span>
            </div>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--sidebar-text-muted, var(--text-muted))' }}
            >
              {mobileMenuOpen
                ? <X className="w-5 h-5" />
                : <Menu className="w-5 h-5" />
              }
            </button>
          </div>

          {/* Sidebar */}
          <Sidebar mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />

          {/* Main Content */}
          <main
            className="flex-1 flex flex-col overflow-hidden pt-[52px] md:pt-0"
            style={{ background: 'var(--bg)' }}
          >
            {!location.pathname.startsWith('/crm') &&
             !location.pathname.startsWith('/conversations') &&
             !location.pathname.startsWith('/inbox') &&
             !location.pathname.startsWith('/marketing') &&
             !location.pathname.startsWith('/email-marketing') &&
             !location.pathname.startsWith('/business') &&
             !location.pathname.startsWith('/automations') &&
             !location.pathname.startsWith('/admin') &&
             !location.pathname.startsWith('/ads') &&
             !location.pathname.startsWith('/dashboard') &&
             !location.pathname.startsWith('/assistant') && (
              <TopBar 
                onOpenCommandPalette={() => setCommandPaletteOpen(true)}
                onOpenNotifications={() => setNotificationPanelOpen(true)}
              />
            )}
            <Suspense fallback={<ContentFallback />}>
              <div key={location.pathname.split('/').slice(0, 2).join('/')} className="flex flex-col h-full w-full" style={{ animation: 'appShellFadeIn 0.18s cubic-bezier(0.16,1,0.3,1) both' }}>
                {/* 2FA gate (Tranche A fix 17): blocks the shell until this
                    sign-in session passes the TOTP challenge, when 2FA is
                    enabled or the workspace requires it. */}
                <TwoFactorGate>
                  <Outlet />
                </TwoFactorGate>
              </div>
            </Suspense>
          </main>
        </div>

        <CommandPalette isOpen={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
        <NotificationPanel isOpen={notificationPanelOpen} onClose={() => setNotificationPanelOpen(false)} />
      </ThemeProvider>
    </ToastProvider>
  );

  if (isDevBypass) return content;

  return (
    <>
      <SignedIn>{content}</SignedIn>
      <SignedOut><RedirectToSignIn /></SignedOut>
    </>
  );
}
