import { useState, Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { ThemeProvider } from '../../context/ThemeContext';
import { Menu, X } from 'lucide-react';
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
import { IS_DEV_AUTH_BYPASS } from '../../lib/clerkConfig';

function ContentFallback() {
  return <div className="flex-1 h-full w-full" style={{ background: 'var(--bg)' }} />;
}

export default function AppShell() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isDevBypass = IS_DEV_AUTH_BYPASS;
  const location = useLocation();

  const content = (
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
                style={{ color: 'var(--text-main)' }}
              >
                Stone AIO
              </span>
            </div>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}
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
            <Suspense fallback={<ContentFallback />}>
              <div key={location.pathname.split('/').slice(0, 2).join('/')} className="flex flex-col h-full w-full" style={{ animation: 'appShellFadeIn 0.18s cubic-bezier(0.16,1,0.3,1) both' }}>
                <Outlet />
              </div>
            </Suspense>
          </main>
        </div>
      </ThemeProvider>
  );

  if (isDevBypass) return content;

  return (
    <>
      <SignedIn>{content}</SignedIn>
      <SignedOut><RedirectToSignIn /></SignedOut>
    </>
  );
}
