/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ClerkProvider, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from './components/ui/Toast';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import PageLoader from './components/common/PageLoader';
import { AuthTokenProvider } from './lib/AuthTokenProvider';
import { CLERK_PUBLISHABLE_KEY, IS_DEV_AUTH_BYPASS } from './lib/clerkConfig';

// Layout (keep eager — needed immediately on every route)
import AppShell from './components/layout/AppShell';

// ── Eager imports (small, always needed) ──────────────────────────────────────
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import SSOCallback from './pages/SSOCallback';
import Onboarding from './pages/Onboarding';

// CRM / Automations
const Workflows          = lazy(() => import('./pages/Workflows'));
const AutomationsLayout  = lazy(() => import('./pages/automations/AutomationsLayout'));
const AutomationsTables  = lazy(() => import('./pages/automations/AutomationsTables'));
const AutomationsTableDetail = lazy(() => import('./pages/automations/AutomationsTableDetail'));
const AutomationsReleases = lazy(() => import('./pages/automations/AutomationsReleases'));
const AutomationsSettings = lazy(() => import('./pages/automations/AutomationsSettings'));
const WorkflowBuilder = lazy(() => import('./pages/automations/WorkflowBuilder'));

// Admin
const PlatformAdminLayout = lazy(() => import('./pages/admin/PlatformAdminLayout'));
import { 
  AdminProjects, AdminUsers, AdminRoles, AdminAudit, AdminPieces, 
  AdminAI, AdminInfra, AdminSecurity, AdminBranding, AdminSSO 
} from './pages/admin/AdminPages';
const VoiceAgentBuilder  = lazy(() => import('./pages/VoiceAgentBuilder')); // 40KB
const Billing            = lazy(() => import('./pages/Billing'));
const SettingsPage       = lazy(() => import('./pages/Settings'));
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
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: (failureCount, error: any) => {
        // Don't retry on 404 - it's a real not-found
        if (error?.response?.status === 404) return false;
        return failureCount < 2;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    },
  },
});

// ── Route tree ────────────────────────────────────────────────────────────────
function AppRoutes({ withAuth = false }: { withAuth?: boolean }) {
  function Protect({ children }: { children: React.ReactNode }) {
    if (!withAuth) return <>{children}</>;
    return (
      <>
        <SignedIn>{children}</SignedIn>
        <SignedOut><RedirectToSignIn /></SignedOut>
      </>
    );
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* ── Public ─────────────────────────────────────────────────────── */}
          <Route path="/"           element={<Landing />} />
          <Route path="/login"      element={withAuth ? <Login /> : <Navigate to="/crm" replace />} />
          <Route path="/signup"     element={withAuth ? <Signup /> : <Navigate to="/crm" replace />} />
          <Route path="/sso-callback" element={withAuth ? <SSOCallback /> : <Navigate to="/crm" replace />} />
          <Route path="/onboarding" element={<Onboarding />} />

          {/* ── Protected shell ────────────────────────────────────────────── */}
          <Route element={<AppShell />}>

            {/* Unified CRM Routes */}
            <Route path="/agents/voice/new"   element={<ErrorBoundary><Protect><VoiceAgentBuilder /></Protect></ErrorBoundary>} />
            <Route path="/agents/voice/:id/build" element={<ErrorBoundary><Protect><VoiceAgentBuilder /></Protect></ErrorBoundary>} />
            <Route path="/workflows"          element={<ErrorBoundary><Protect><Workflows /></Protect></ErrorBoundary>} />
            <Route path="/automations/:id"      element={<ErrorBoundary><Protect><WorkflowBuilder /></Protect></ErrorBoundary>} />

            {/* Automations sub-pages (with sidebar layout) */}
            <Route path="/automations" element={<ErrorBoundary><Protect><AutomationsLayout /></Protect></ErrorBoundary>}>
              <Route index element={<Navigate to="/workflows" replace />} />
              <Route path="runs" element={<Navigate to="/workflows" replace />} />
              <Route path="connections" element={<Navigate to="/workflows" replace />} />
              <Route path="tables" element={<AutomationsTables />} />
              <Route path="tables/:tableId" element={<AutomationsTableDetail />} />
              <Route path="releases" element={<AutomationsReleases />} />
              <Route path="settings" element={<AutomationsSettings />} />
            </Route>

            {/* Platform Admin */}
            <Route path="/admin" element={<ErrorBoundary><Protect><PlatformAdminLayout /></Protect></ErrorBoundary>}>
              <Route index element={<Navigate to="projects" replace />} />
              <Route path="projects" element={<AdminProjects />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="roles" element={<AdminRoles />} />
              <Route path="audit" element={<AdminAudit />} />
              <Route path="pieces" element={<AdminPieces />} />
              <Route path="ai" element={<AdminAI />} />
              <Route path="infrastructure" element={<AdminInfra />} />
              <Route path="security" element={<AdminSecurity />} />
              <Route path="branding" element={<AdminBranding />} />
              <Route path="sso" element={<AdminSSO />} />
            </Route>

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

          {/* Redirect unknown routes */}
          {withAuth && (
            <Route path="*" element={
              <>
                <SignedOut><RedirectToSignIn /></SignedOut>
                <SignedIn><Navigate to="/crm" replace /></SignedIn>
              </>
            } />
          )}
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {IS_DEV_AUTH_BYPASS ? (
          <BrowserRouter>
            <AppRoutes withAuth={false} />
          </BrowserRouter>
        ) : (
          <ClerkProvider 
            publishableKey={CLERK_PUBLISHABLE_KEY}
            signInUrl="/login"
            signUpUrl="/signup"
            signInForceRedirectUrl="/crm"
            signUpForceRedirectUrl="/crm"
          >
            <AuthTokenProvider>
              <BrowserRouter>
                <AppRoutes withAuth={true} />
              </BrowserRouter>
            </AuthTokenProvider>
          </ClerkProvider>
        )}
      </ToastProvider>
    </QueryClientProvider>
  );
}
