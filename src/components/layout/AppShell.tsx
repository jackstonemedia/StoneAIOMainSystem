import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { ThemeProvider } from '../../lib/ThemeContext';
import { ModeProvider } from '../../store/modeStore';
import { Menu, X } from 'lucide-react';
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';

export default function AppShell() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isDevBypass = !(import.meta as any).env.VITE_CLERK_PUBLISHABLE_KEY;

  const content = (
    <ModeProvider>
      <ThemeProvider>
        <div className="flex h-screen bg-bg overflow-hidden relative">
          {/* Mobile Header */}
          <div className="md:hidden h-14 bg-surface border-b border-border flex items-center px-4 justify-between shrink-0 absolute top-0 left-0 right-0 z-40">
             <div className="flex items-center gap-2">
               <div className="stone-logo w-8 h-8 text-xs shrink-0">S</div>
               <span className="font-semibold text-sm tracking-tight text-text-main">Stone AIO</span>
             </div>
             <button 
               onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
               className="p-2 text-text-muted hover:text-text-main transition-colors"
             >
               {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
             </button>
          </div>

          {/* Sidebar */}
          <Sidebar mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />
          
          {/* Main Content Area */}
          <main className="flex-1 flex flex-col overflow-hidden pt-14 md:pt-0">
            <Outlet />
          </main>
        </div>
      </ThemeProvider>
    </ModeProvider>
  );

  if (isDevBypass) {
    return content;
  }

  return (
    <>
      <SignedIn>
        {content}
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}
