/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ClerkProvider, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from './components/ui/Toast';
import { ModeProvider } from './context/ModeContext';          // ← moved from store/
import { ErrorBoundary } from './components/common/ErrorBoundary';
import PageLoader from './components/common/PageLoader';

// Layout (keep eager — needed immediately on every route)
import AppShell from './components/layout/AppShell';

// ── Eager imports (small, always needed) ──────────────────────────────────────
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Onboarding from './pages/Onboarding';

// ── Lazy imports — code split by route ───────────────────────────────────────
// Creator Studio
const Dashboard          = lazy(() => import('./pages/Dashboard'));
const AgentsList         = lazy(() => import('./pages/AgentsList'));
const AgentTypePicker    = lazy(() => import('./pages/AgentTypePicker'));
const AgentBuilder       = lazy(() => import('./pages/AgentBuilder'));      // 49KB
const VoiceAgentBuilder  = lazy(() => import('./pages/VoiceAgentBuilder')); // 40KB
const AIAssistant        = lazy(() => import('./pages/AIAssistant'));
const Projects           = lazy(() => import('./pages/Projects'));
const ComputerSetup      = lazy(() => import('./pages/ComputerSetup'));
const ComputerDashboard  = lazy(() => import('./pages/ComputerDashboard'));
const Billing            = lazy(() => import('./pages/Billing'));
const SettingsPage       = lazy(() => import('./pages/Settings'));
const WorkflowTemplates  = lazy(() => import('./pages/WorkflowTemplates'));
const Marketplace        = lazy(() => import('./pages/Marketplace'));

// Business Hub
const BusinessLayout      = lazy(() => import('./pages/business/BusinessLayout'));
const BusinessDashboard   = lazy(() => import('./pages/business/BusinessDashboard'));
const Campaigns           = lazy(() => import('./pages/business/Campaigns'));
const Calendar            = lazy(() => import('./pages/business/Calendar'));
const Forms               = lazy(() => import('./pages/business/Forms'));
const Analytics           = lazy(() => import('./pages/business/Analytics'));
const Reputation          = lazy(() => import('./pages/business/Reputation'));
const ConversationsLayout = lazy(() => import('./pages/business/conversations/ConversationsLayout'));
const ConversationsTab    = lazy(() => import('./pages/business/conversations/ConversationsTab'));
const ManualActionsTab    = lazy(() => import('./pages/business/conversations/ManualActionsTab'));
const SnippetsTab         = lazy(() => import('./pages/business/conversations/SnippetsTab'));
const TriggerLinksTab     = lazy(() => import('./pages/business/conversations/TriggerLinksTab'));

// CRM — top-level at /crm (removed from /business nesting — see Task 3.6)
const CrmLayout     = lazy(() => import('./pages/crm/CrmLayout'));
const Contacts      = lazy(() => import('./pages/crm/Contacts'));      // 45KB
const ContactDetail = lazy(() => import('./pages/crm/ContactDetail'));
const Companies     = lazy(() => import('./pages/crm/Companies'));
const CompanyDetail = lazy(() => import('./pages/crm/CompanyDetail'));
const CrmSettings   = lazy(() => import('./pages/crm/Settings'));
const SmartLists    = lazy(() => import('./pages/crm/SmartLists'));
const BulkActions   = lazy(() => import('./pages/crm/BulkActions'));
const CrmTasks      = lazy(() => import('./pages/crm/CrmTasks'));
const Opportunities = lazy(() => import('./pages/crm/Opportunities')); // 72KB

// ── App config ────────────────────────────────────────────────────────────────
const PUBLISHABLE_KEY = (import.meta as any).env.VITE_CLERK_PUBLISHABLE_KEY || '';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

// ── Route tree ────────────────────────────────────────────────────────────────
function AppRoutes({ withAuth = false }: { withAuth?: boolean }) {
  function Protect({ children }: { children: React.ReactNode }) {
    if (!withAuth) return <>{children}</>;
    return <SignedIn>{children}</SignedIn>;
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* ── Public ─────────────────────────────────────────────────────── */}
        <Route path="/"           element={<Landing />} />
        <Route path="/login"      element={<Login />} />
        <Route path="/signup"     element={<Signup />} />
        <Route path="/onboarding" element={<Onboarding />} />

        {/* ── Protected shell ────────────────────────────────────────────── */}
        <Route element={<AppShell />}>

          {/* Creator Studio */}
          <Route path="/dashboard"          element={<ErrorBoundary><Protect><Dashboard /></Protect></ErrorBoundary>} />
          <Route path="/assistant"          element={<ErrorBoundary><Protect><AIAssistant /></Protect></ErrorBoundary>} />
          <Route path="/projects"           element={<ErrorBoundary><Protect><Projects /></Protect></ErrorBoundary>} />
          <Route path="/computer/setup"     element={<ErrorBoundary><Protect><ComputerSetup /></Protect></ErrorBoundary>} />
          <Route path="/computer"           element={<ErrorBoundary><Protect><ComputerDashboard /></Protect></ErrorBoundary>} />
          <Route path="/agents"             element={<ErrorBoundary><Protect><AgentsList /></Protect></ErrorBoundary>} />
          <Route path="/agents/new"         element={<ErrorBoundary><Protect><AgentTypePicker /></Protect></ErrorBoundary>} />
          <Route path="/agents/voice/new"   element={<ErrorBoundary><Protect><VoiceAgentBuilder /></Protect></ErrorBoundary>} />
          <Route path="/agents/voice/:id/build" element={<ErrorBoundary><Protect><VoiceAgentBuilder /></Protect></ErrorBoundary>} />
          <Route path="/agents/workflow/new" element={<ErrorBoundary><Protect><AgentBuilder /></Protect></ErrorBoundary>} />
          <Route path="/agents/:id/build"   element={<ErrorBoundary><Protect><AgentBuilder /></Protect></ErrorBoundary>} />
          <Route path="/templates"          element={<ErrorBoundary><Protect><WorkflowTemplates /></Protect></ErrorBoundary>} />

          {/* Conversations (Business Hub) */}
          <Route path="/conversations" element={<ErrorBoundary><Protect><ConversationsLayout /></Protect></ErrorBoundary>}>
            <Route index element={<Navigate to="chat" replace />} />
            <Route path="chat"           element={<ConversationsTab />} />
            <Route path="manual-actions" element={<ManualActionsTab />} />
            <Route path="snippets"       element={<SnippetsTab />} />
            <Route path="trigger-links"  element={<TriggerLinksTab />} />
          </Route>

          {/* Business Hub */}
          <Route path="/business" element={<ErrorBoundary><Protect><BusinessLayout /></Protect></ErrorBoundary>}>
            <Route index          element={<BusinessDashboard />} />
            <Route path="campaigns"   element={<ErrorBoundary><Campaigns /></ErrorBoundary>} />
            <Route path="calendar"    element={<ErrorBoundary><Calendar /></ErrorBoundary>} />
            <Route path="forms"       element={<ErrorBoundary><Forms /></ErrorBoundary>} />
            <Route path="analytics"   element={<ErrorBoundary><Analytics /></ErrorBoundary>} />
            <Route path="reputation"  element={<ErrorBoundary><Reputation /></ErrorBoundary>} />
          </Route>

          {/* CRM — canonical location: /crm/* (removed from /business nesting) */}
          <Route path="/crm" element={<ErrorBoundary><Protect><CrmLayout /></Protect></ErrorBoundary>}>
            <Route index                  element={<Navigate to="contacts" replace />} />
            <Route path="contacts"        element={<ErrorBoundary><Contacts /></ErrorBoundary>} />
            <Route path="contacts/:id"    element={<ErrorBoundary><ContactDetail /></ErrorBoundary>} />
            <Route path="companies"       element={<ErrorBoundary><Companies /></ErrorBoundary>} />
            <Route path="companies/:id"   element={<ErrorBoundary><CompanyDetail /></ErrorBoundary>} />
            <Route path="tasks"           element={<ErrorBoundary><CrmTasks /></ErrorBoundary>} />
            <Route path="smart-lists"     element={<ErrorBoundary><SmartLists /></ErrorBoundary>} />
            <Route path="bulk-actions"    element={<ErrorBoundary><BulkActions /></ErrorBoundary>} />
            <Route path="pipeline"        element={<ErrorBoundary><Opportunities /></ErrorBoundary>} />
            <Route path="settings"        element={<ErrorBoundary><CrmSettings /></ErrorBoundary>} />
          </Route>

          {/* Shared */}
          <Route path="/marketplace" element={<ErrorBoundary><Protect><Marketplace /></Protect></ErrorBoundary>} />
          <Route path="/billing"     element={<ErrorBoundary><Protect><Billing /></Protect></ErrorBoundary>} />
          <Route path="/settings"    element={<ErrorBoundary><Protect><SettingsPage /></Protect></ErrorBoundary>} />
        </Route>

        {/* Redirect unknown routes to sign-in (Clerk mode only) */}
        {withAuth && <Route path="*" element={<SignedOut><RedirectToSignIn /></SignedOut>} />}
      </Routes>
    </Suspense>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  const isDevBypass = !PUBLISHABLE_KEY;

  return (
    <QueryClientProvider client={queryClient}>
      <ModeProvider>
        <ToastProvider>
          {isDevBypass ? (
            <BrowserRouter>
              <AppRoutes withAuth={false} />
            </BrowserRouter>
          ) : (
            <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
              <BrowserRouter>
                <AppRoutes withAuth={true} />
              </BrowserRouter>
            </ClerkProvider>
          )}
        </ToastProvider>
      </ModeProvider>
    </QueryClientProvider>
  );
}
