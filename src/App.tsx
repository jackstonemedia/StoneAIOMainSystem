/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ClerkProvider, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from './components/common/ErrorBoundary';
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

const VoiceAgentBuilder  = lazy(() => import('./pages/VoiceAgentBuilder')); // 40KB
const Billing            = lazy(() => import('./pages/Billing'));
const SettingsPage       = lazy(() => import('./pages/Settings'));
const Marketplace        = lazy(() => import('./pages/Marketplace'));

// Business Hub & Dashboard
const BusinessLayout      = lazy(() => import('./pages/business/BusinessLayout'));
const BusinessDashboard   = lazy(() => import('./pages/business/BusinessDashboard'));
const DashboardPage       = lazy(() => import('./pages/Dashboard'));

const Calendar            = lazy(() => import('./pages/business/Calendar'));

const Analytics           = lazy(() => import('./pages/business/Analytics'));

const ConversationsLayout = lazy(() => import('./pages/business/inbox/ConversationsLayout'));
const ConversationsTab    = lazy(() => import('./pages/business/inbox/ConversationsTab'));
const ManualActionsTab    = lazy(() => import('./pages/business/inbox/ManualActionsTab'));
const SnippetsTab         = lazy(() => import('./pages/business/inbox/SnippetsTab'));
const TriggerLinksTab     = lazy(() => import('./pages/business/inbox/TriggerLinksTab'));

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
const CrmDocuments  = lazy(() => import('./pages/crm/Documents'));
const Opportunities = lazy(() => import('./pages/crm/Opportunities'));

// Ad Manager
const AdsLayout              = lazy(() => import('./pages/ads/AdsLayout'));
const AdsDashboard           = lazy(() => import('./pages/ads/AdsDashboard'));
const AdsCampaigns           = lazy(() => import('./pages/ads/AdsCampaigns'));
const AdsSettings            = lazy(() => import('./pages/ads/AdsSettings'));
const AdsReports             = lazy(() => import('./pages/ads/AdsReports'));
const CampaignTypePickerPage = lazy(() => import('./pages/ads/CampaignTypePickerPage'));
const CampaignBuilder        = lazy(() => import('./pages/ads/CampaignBuilder'));
const CampaignDetail         = lazy(() => import('./pages/ads/CampaignDetail'));

// Lead Studio
const LeadStudio             = lazy(() => import('./pages/leads/LeadStudio'));

// Inbox
const InboxLayout            = lazy(() => import('./pages/inbox/InboxLayout'));
const InboxView              = lazy(() => import('./pages/inbox/InboxView'));
const InboxReports           = lazy(() => import('./pages/inbox/InboxReports'));
const InboxContacts          = lazy(() => import('./pages/inbox/InboxContacts'));
const InboxHelpCenter        = lazy(() => import('./pages/inbox/InboxHelpCenter'));
const InboxSettings          = lazy(() => import('./pages/inbox/settings/InboxSettings'));
const InboxChannels          = lazy(() => import('./pages/inbox/settings/InboxChannels'));
const InboxTeams             = lazy(() => import('./pages/inbox/settings/InboxTeams'));
const InboxLabels            = lazy(() => import('./pages/inbox/settings/InboxLabels'));
const InboxCannedResponses   = lazy(() => import('./pages/inbox/settings/InboxCannedResponses'));

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

function Protect({ children, withAuth }: { children: React.ReactNode; withAuth: boolean }) {
  if (!withAuth) return <>{children}</>;
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut><RedirectToSignIn /></SignedOut>
    </>
  );
}


// ── Route tree ────────────────────────────────────────────────────────────────
function AppRoutes({ withAuth = false }: { withAuth?: boolean }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={null}>
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
            <Route
              path="/dashboard"
              element={<ErrorBoundary><Protect withAuth={withAuth}><DashboardPage /></Protect></ErrorBoundary>}
            />
            <Route path="/agents/voice/new"   element={<ErrorBoundary><Protect withAuth={withAuth}><VoiceAgentBuilder /></Protect></ErrorBoundary>} />
            <Route path="/agents/voice/:id/build" element={<ErrorBoundary><Protect withAuth={withAuth}><VoiceAgentBuilder /></Protect></ErrorBoundary>} />
            <Route path="/workflows"          element={<Navigate to="/automations" replace />} />
            <Route path="/automations/:id"      element={<ErrorBoundary><Protect withAuth={withAuth}><WorkflowBuilder /></Protect></ErrorBoundary>} />

            {/* Automations sub-pages (with sidebar layout) */}
            <Route path="/automations" element={<ErrorBoundary><Protect withAuth={withAuth}><AutomationsLayout /></Protect></ErrorBoundary>}>
              <Route index element={<ErrorBoundary><Workflows /></ErrorBoundary>} />
              <Route path="runs" element={<Navigate to="/automations" replace />} />
              <Route path="connections" element={<Navigate to="/automations" replace />} />
              <Route path="tables" element={<AutomationsTables />} />
              <Route path="tables/:tableId" element={<AutomationsTableDetail />} />
              <Route path="releases" element={<AutomationsReleases />} />
              <Route path="settings" element={<AutomationsSettings />} />
            </Route>

            {/* Inbox (Business Hub) */}
            <Route path="/inbox" element={<ErrorBoundary><Protect withAuth={withAuth}><ConversationsLayout /></Protect></ErrorBoundary>}>
              <Route index element={<Navigate to="chat" replace />} />
              <Route path="chat"           element={<ConversationsTab />} />
              <Route path="manual-actions" element={<ManualActionsTab />} />
              <Route path="snippets"       element={<SnippetsTab />} />
              <Route path="trigger-links"  element={<TriggerLinksTab />} />
            </Route>



            {/* Business Hub */}
            <Route path="/business" element={<ErrorBoundary><Protect withAuth={withAuth}><BusinessLayout /></Protect></ErrorBoundary>}>
              <Route index          element={<BusinessDashboard />} />

              <Route path="calendar"    element={<ErrorBoundary><Calendar /></ErrorBoundary>} />

              <Route path="analytics"   element={<ErrorBoundary><Analytics /></ErrorBoundary>} />

            </Route>

            {/* CRM — canonical location: /crm/* (removed from /business nesting) */}
            <Route path="/crm" element={<ErrorBoundary><Protect withAuth={withAuth}><CrmLayout /></Protect></ErrorBoundary>}>
              <Route index                  element={<Navigate to="contacts" replace />} />
              <Route path="contacts"        element={<ErrorBoundary><Contacts /></ErrorBoundary>} />
              <Route path="contacts/:id"    element={<ErrorBoundary><ContactDetail /></ErrorBoundary>} />
              <Route path="companies"       element={<ErrorBoundary><Companies /></ErrorBoundary>} />
              <Route path="companies/:id"   element={<ErrorBoundary><CompanyDetail /></ErrorBoundary>} />
              <Route path="tasks"           element={<ErrorBoundary><CrmTasks /></ErrorBoundary>} />
              <Route path="documents"       element={<ErrorBoundary><CrmDocuments /></ErrorBoundary>} />
              <Route path="smart-lists"     element={<ErrorBoundary><SmartLists /></ErrorBoundary>} />
              <Route path="bulk-actions"    element={<ErrorBoundary><BulkActions /></ErrorBoundary>} />
              <Route path="pipeline"        element={<ErrorBoundary><Opportunities /></ErrorBoundary>} />
              <Route path="settings"        element={<ErrorBoundary><CrmSettings /></ErrorBoundary>} />
            </Route>

            {/* Shared */}
            <Route path="/marketplace" element={<ErrorBoundary><Protect withAuth={withAuth}><Marketplace /></Protect></ErrorBoundary>} />
            <Route path="/billing"     element={<ErrorBoundary><Protect withAuth={withAuth}><Billing /></Protect></ErrorBoundary>} />
            <Route path="/settings"    element={<ErrorBoundary><Protect withAuth={withAuth}><SettingsPage /></Protect></ErrorBoundary>} />

            {/* Lead Studio */}
            <Route path="/leads" element={<ErrorBoundary><Protect withAuth={withAuth}><LeadStudio /></Protect></ErrorBoundary>} />

            {/* Inbox */}
            <Route path="/inbox" element={<ErrorBoundary><Protect withAuth={withAuth}><InboxLayout /></Protect></ErrorBoundary>}>
              <Route index element={<InboxView />} />
              <Route path="reports" element={<InboxReports />} />
              <Route path="contacts" element={<InboxContacts />} />
              <Route path="help-center" element={<InboxHelpCenter />} />
              <Route path="settings" element={<InboxSettings />}>
                <Route index element={<Navigate to="channels" replace />} />
                <Route path="channels" element={<InboxChannels />} />
                <Route path="teams" element={<InboxTeams />} />
                <Route path="labels" element={<InboxLabels />} />
                <Route path="canned-responses" element={<InboxCannedResponses />} />
              </Route>
            </Route>

            {/* Ad Manager */}
            <Route path="/ads" element={<ErrorBoundary><Protect withAuth={withAuth}><AdsLayout /></Protect></ErrorBoundary>}>
              <Route index element={<Navigate to="overview" replace />} />
              <Route path="overview"   element={<ErrorBoundary><AdsDashboard /></ErrorBoundary>} />
              <Route path="campaigns"  element={<ErrorBoundary><AdsCampaigns /></ErrorBoundary>} />
              <Route path="campaigns/:id" element={<ErrorBoundary><CampaignDetail /></ErrorBoundary>} />
              <Route path="reports"    element={<ErrorBoundary><AdsReports /></ErrorBoundary>} />
              <Route path="settings"   element={<ErrorBoundary><AdsSettings /></ErrorBoundary>} />
            </Route>

        </Route>  {/* AppShell */}


        {/* ── Fullscreen Ad Campaign Routes (no sidebar) ──────────────── */}
        <Route path="/ads/campaigns/new"     element={<ErrorBoundary><Protect withAuth={withAuth}><CampaignTypePickerPage /></Protect></ErrorBoundary>} />
        <Route path="/ads/campaigns/new/:type" element={<ErrorBoundary><Protect withAuth={withAuth}><CampaignBuilder /></Protect></ErrorBoundary>} />
        <Route path="/ads/campaigns/:id/edit"  element={<ErrorBoundary><Protect withAuth={withAuth}><CampaignBuilder /></Protect></ErrorBoundary>} />

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
    </QueryClientProvider>
  );
}
