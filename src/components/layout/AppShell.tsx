import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { ThemeProvider } from '../../context/ThemeContext';
import { Menu, X, Zap } from 'lucide-react';
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
import { IS_DEV_AUTH_BYPASS } from '../../lib/clerkConfig';

export default function AppShell() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isDevBypass = IS_DEV_AUTH_BYPASS;

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
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <Zap className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} strokeWidth={1.8} />
              </div>
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
            <Outlet />
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
