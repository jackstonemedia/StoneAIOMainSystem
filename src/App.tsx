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

// Conversations module (unified inbox — Email + SMS)
const ConvLayout        = lazy(() => import('./pages/conversations/ConversationsLayout'));
const ConvInbox         = lazy(() => import('./pages/conversations/ConversationsInbox'));
const ConvSettingsLayout = lazy(() => import('./pages/conversations/settings/ConversationsSettingsLayout'));
const ConvChannels      = lazy(() => import('./pages/conversations/settings/ConversationsChannelsSettings'));
const ConvTemplates     = lazy(() => import('./pages/conversations/settings/ConversationsTemplatesSettings'));
const ConvTags          = lazy(() => import('./pages/conversations/settings/ConversationsTagsSettings'));

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
const OpportunitiesPage         = lazy(() => import('./pages/opportunities/OpportunitiesPage'));
const OpportunityDetailPage     = lazy(() => import('./pages/opportunities/OpportunityDetailPage'));
const PipelineSettingsPage      = lazy(() => import('./pages/opportunities/settings/PipelineSettingsPage'));
const CustomFieldsSettingsPage  = lazy(() => import('./pages/opportunities/settings/CustomFieldsSettingsPage'));
const TagsSettingsPage          = lazy(() => import('./pages/opportunities/settings/TagsSettingsPage'));

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

// Email Marketing
const EmailMarketingLayout = lazy(() => import('./pages/email-marketing/EmailMarketingLayout'));
const CampaignsList        = lazy(() => import('./pages/email-marketing/CampaignsList'));
const EmailCampaignBuilder = lazy(() => import('./pages/email-marketing/CampaignBuilder'));
const ListsAndSegments     = lazy(() => import('./pages/email-marketing/ListsAndSegments'));
const AutomationsList      = lazy(() => import('./pages/email-marketing/AutomationsList'));
const AutomationCanvas     = lazy(() => import('./pages/email-marketing/AutomationCanvas'));
const TemplatesList        = lazy(() => import('./pages/email-marketing/TemplatesList'));
const CampaignAnalytics    = lazy(() => import('./pages/email-marketing/CampaignAnalytics'));

// Autonomous AI SDR
const AutonomousSdrDashboard = lazy(() => import('./pages/sdr/AutonomousSdrDashboard'));

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
            <Route
              path="/sdr"
              element={<ErrorBoundary><Protect withAuth={withAuth}><AutonomousSdrDashboard /></Protect></ErrorBoundary>}
            />
            <Route path="/workflows"          element={<Navigate to="/automations" replace />} />
            <Route path="/automations/:id"      element={<ErrorBoundary><Protect withAuth={withAuth}><WorkflowBuilder /></Protect></ErrorBoundary>} />

            {/* Automations sub-pages (with sidebar layout) */}
            <Route path="/automations" element={<ErrorBoundary><Protect withAuth={withAuth}><AutomationsLayout /></Protect></ErrorBoundary>}>
              <Route index element={<ErrorBoundary><Workflows /></ErrorBoundary>} />
              <Route path="runs" element={<Navigate to="/automations" replace />} />
              <Route path="connections" element={<Navigate to="/automations" replace />} />
              <Route path="tables" element={<ErrorBoundary><AutomationsTables /></ErrorBoundary>} />
              <Route path="tables/:tableId" element={<ErrorBoundary><AutomationsTableDetail /></ErrorBoundary>} />
              <Route path="releases" element={<ErrorBoundary><AutomationsReleases /></ErrorBoundary>} />
              <Route path="settings" element={<ErrorBoundary><AutomationsSettings /></ErrorBoundary>} />
            </Route>

            {/* Inbox (Business Hub) */}
            <Route path="/inbox" element={<ErrorBoundary><Protect withAuth={withAuth}><ConversationsLayout /></Protect></ErrorBoundary>}>
              <Route index element={<Navigate to="chat" replace />} />
              <Route path="chat"           element={<ErrorBoundary><ConversationsTab /></ErrorBoundary>} />
              <Route path="manual-actions" element={<ErrorBoundary><ManualActionsTab /></ErrorBoundary>} />
              <Route path="snippets"       element={<ErrorBoundary><SnippetsTab /></ErrorBoundary>} />
              <Route path="trigger-links"  element={<ErrorBoundary><TriggerLinksTab /></ErrorBoundary>} />
            </Route>



            {/* Business Hub */}
            <Route path="/business" element={<ErrorBoundary><Protect withAuth={withAuth}><BusinessLayout /></Protect></ErrorBoundary>}>
              <Route index          element={<ErrorBoundary><BusinessDashboard /></ErrorBoundary>} />

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
              <Route path="opportunities"                    element={<ErrorBoundary><OpportunitiesPage /></ErrorBoundary>} />
              <Route path="opportunities/:id"                element={<ErrorBoundary><OpportunityDetailPage /></ErrorBoundary>} />
              <Route path="opportunities/settings/pipelines" element={<ErrorBoundary><PipelineSettingsPage /></ErrorBoundary>} />
              <Route path="opportunities/settings/fields"    element={<ErrorBoundary><CustomFieldsSettingsPage /></ErrorBoundary>} />
              <Route path="opportunities/settings/tags"      element={<ErrorBoundary><TagsSettingsPage /></ErrorBoundary>} />
              <Route path="tasks"           element={<ErrorBoundary><CrmTasks /></ErrorBoundary>} />
              <Route path="documents"       element={<ErrorBoundary><CrmDocuments /></ErrorBoundary>} />
              <Route path="smart-lists"     element={<ErrorBoundary><SmartLists /></ErrorBoundary>} />
              <Route path="bulk-actions"    element={<ErrorBoundary><BulkActions /></ErrorBoundary>} />
              <Route path="pipeline"        element={<Navigate to="/crm/opportunities" replace />} />
              <Route path="settings"        element={<ErrorBoundary><CrmSettings /></ErrorBoundary>} />
            </Route>

            {/* Opportunities Route Aliases */}
            <Route path="/opportunities"                    element={<Navigate to="/crm/opportunities" replace />} />
            <Route path="/opportunities/:id"                element={<Navigate to="/crm/opportunities/:id" replace />} />
            <Route path="/opportunities/settings/pipelines" element={<Navigate to="/crm/opportunities/settings/pipelines" replace />} />
            <Route path="/opportunities/settings/fields"    element={<Navigate to="/crm/opportunities/settings/fields" replace />} />
            <Route path="/opportunities/settings/tags"      element={<Navigate to="/crm/opportunities/settings/tags" replace />} />

            {/* Shared */}
            <Route path="/marketplace" element={<ErrorBoundary><Protect withAuth={withAuth}><Marketplace /></Protect></ErrorBoundary>} />
            <Route path="/billing"     element={<ErrorBoundary><Protect withAuth={withAuth}><Billing /></Protect></ErrorBoundary>} />
            <Route path="/settings"    element={<ErrorBoundary><Protect withAuth={withAuth}><SettingsPage /></Protect></ErrorBoundary>} />

            {/* Lead Studio */}
            <Route path="/leads" element={<ErrorBoundary><Protect withAuth={withAuth}><LeadStudio /></Protect></ErrorBoundary>} />

            {/* Email Marketing */}
            <Route path="/email-marketing" element={<ErrorBoundary><Protect withAuth={withAuth}><EmailMarketingLayout /></Protect></ErrorBoundary>}>
              <Route index element={<Navigate to="campaigns" replace />} />
              <Route path="campaigns" element={<ErrorBoundary><CampaignsList /></ErrorBoundary>} />
              <Route path="campaigns/new" element={<ErrorBoundary><EmailCampaignBuilder /></ErrorBoundary>} />
              <Route path="campaigns/:campaignId" element={<ErrorBoundary><EmailCampaignBuilder /></ErrorBoundary>} />
              <Route path="automations" element={<ErrorBoundary><AutomationsList /></ErrorBoundary>} />
              <Route path="automations/new" element={<ErrorBoundary><AutomationCanvas /></ErrorBoundary>} />
              <Route path="automations/:automationId" element={<ErrorBoundary><AutomationCanvas /></ErrorBoundary>} />
              <Route path="audience" element={<ErrorBoundary><ListsAndSegments /></ErrorBoundary>} />
              <Route path="templates" element={<ErrorBoundary><TemplatesList /></ErrorBoundary>} />
              <Route path="suppression" element={<ErrorBoundary><ListsAndSegments /></ErrorBoundary>} />
              <Route path="analytics" element={<ErrorBoundary><CampaignAnalytics /></ErrorBoundary>} />
            </Route>

            {/* Inbox */}
            <Route path="/inbox" element={<ErrorBoundary><Protect withAuth={withAuth}><InboxLayout /></Protect></ErrorBoundary>}>
              <Route index element={<ErrorBoundary><InboxView /></ErrorBoundary>} />
              <Route path="reports" element={<ErrorBoundary><InboxReports /></ErrorBoundary>} />
              <Route path="contacts" element={<ErrorBoundary><InboxContacts /></ErrorBoundary>} />
              <Route path="help-center" element={<ErrorBoundary><InboxHelpCenter /></ErrorBoundary>} />
              <Route path="settings" element={<ErrorBoundary><InboxSettings /></ErrorBoundary>}>
                <Route index element={<Navigate to="channels" replace />} />
                <Route path="channels" element={<ErrorBoundary><InboxChannels /></ErrorBoundary>} />
                <Route path="teams" element={<ErrorBoundary><InboxTeams /></ErrorBoundary>} />
                <Route path="labels" element={<ErrorBoundary><InboxLabels /></ErrorBoundary>} />
                <Route path="canned-responses" element={<ErrorBoundary><InboxCannedResponses /></ErrorBoundary>} />
              </Route>
            </Route>

            {/* Conversations (unified inbox — Email + SMS) */}
            <Route path="/conversations" element={<ErrorBoundary><Protect withAuth={withAuth}><ConvLayout /></Protect></ErrorBoundary>}>
              <Route index element={<ErrorBoundary><ConvInbox /></ErrorBoundary>} />
              <Route path=":id" element={<ErrorBoundary><ConvInbox /></ErrorBoundary>} />
              <Route path="settings" element={<ErrorBoundary><ConvSettingsLayout /></ErrorBoundary>}>
                <Route index element={<Navigate to="channels" replace />} />
                <Route path="channels"  element={<ErrorBoundary><ConvChannels /></ErrorBoundary>} />
                <Route path="templates" element={<ErrorBoundary><ConvTemplates /></ErrorBoundary>} />
                <Route path="tags"      element={<ErrorBoundary><ConvTags /></ErrorBoundary>} />
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
          {withAuth ? (
            <Route path="*" element={
              <>
                <SignedOut><RedirectToSignIn /></SignedOut>
                <SignedIn><Navigate to="/crm" replace /></SignedIn>
              </>
            } />
          ) : (
            <Route path="*" element={<Navigate to="/opportunities" replace />} />
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
