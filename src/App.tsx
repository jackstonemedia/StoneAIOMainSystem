/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ClerkProvider, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from './components/ui/Toast';
import { ModeProvider } from './store/modeStore';

// Layout
import AppShell from './components/layout/AppShell';

// Creator Studio
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import AgentsList from './pages/AgentsList';
import AgentTypePicker from './pages/AgentTypePicker';
import Marketplace from './pages/Marketplace';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Onboarding from './pages/Onboarding';
import ComputerSetup from './pages/ComputerSetup';
import ComputerDashboard from './pages/ComputerDashboard';
import Billing from './pages/Billing';
import SettingsPage from './pages/Settings';
import WorkflowTemplates from './pages/WorkflowTemplates';
import AIAssistant from './pages/AIAssistant';
import Projects from './pages/Projects';
import VoiceAgentBuilder from './pages/VoiceAgentBuilder';
import AgentBuilder from './pages/AgentBuilder';

// Business Hub
import BusinessLayout from './pages/business/BusinessLayout';
import BusinessDashboard from './pages/business/BusinessDashboard';
import Campaigns from './pages/business/Campaigns';
import Calendar from './pages/business/Calendar';
import Forms from './pages/business/Forms';
import Analytics from './pages/business/Analytics';
import Reputation from './pages/business/Reputation';
import ConversationsLayout from './pages/business/conversations/ConversationsLayout';
import ConversationsTab   from './pages/business/conversations/ConversationsTab';
import ManualActionsTab   from './pages/business/conversations/ManualActionsTab';
import SnippetsTab        from './pages/business/conversations/SnippetsTab';
import TriggerLinksTab    from './pages/business/conversations/TriggerLinksTab';

// CRM
import CrmLayout from './pages/crm/CrmLayout';
import CrmDashboard from './pages/crm/Dashboard';
import Contacts from './pages/crm/Contacts';
import ContactDetail from './pages/crm/ContactDetail';
import Companies from './pages/crm/Companies';
import CompanyDetail from './pages/crm/CompanyDetail';
import CrmSettings from './pages/crm/Settings';
import SmartLists from './pages/crm/SmartLists';
import BulkActions from './pages/crm/BulkActions';
import CrmTasks from './pages/crm/CrmTasks';

const PUBLISHABLE_KEY = (import.meta as any).env.VITE_CLERK_PUBLISHABLE_KEY || '';
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30s
      retry: 1,
    },
  },
});

// ── Shared route tree ──────────────────────────────────────────────────────
// Defined once and used in both dev-bypass and Clerk-protected modes.
function AppRoutes({ withAuth = false }: { withAuth?: boolean }) {
  function Protect({ children }: { children: React.ReactNode }) {
    if (!withAuth) return <>{children}</>;
    return <SignedIn>{children}</SignedIn>;
  }

  const crmRoutes = (
    <Route path="crm" element={<CrmLayout />}>
      <Route index element={<Navigate to="contacts" replace />} />
      <Route path="contacts"     element={<Contacts />} />
      <Route path="contacts/:id" element={<ContactDetail />} />
      <Route path="companies"    element={<Companies />} />
      <Route path="companies/:id" element={<CompanyDetail />} />
      <Route path="tasks"        element={<CrmTasks />} />
      <Route path="smart-lists"  element={<SmartLists />} />
      <Route path="bulk-actions" element={<BulkActions />} />
      <Route path="settings"     element={<CrmSettings />} />
    </Route>
  );

  return (
    <Routes>
      {/* Public */}
      <Route path="/"           element={<Landing />} />
      <Route path="/login"      element={<Login />} />
      <Route path="/signup"     element={<Signup />} />
      <Route path="/onboarding" element={<Onboarding />} />

      {/* Protected shell */}
      <Route element={<AppShell />}>
        {/* Creator Studio */}
        <Route path="/dashboard"         element={<Protect><Dashboard /></Protect>} />
        <Route path="/assistant"         element={<Protect><AIAssistant /></Protect>} />
        <Route path="/projects"          element={<Protect><Projects /></Protect>} />
        <Route path="/computer/setup"    element={<Protect><ComputerSetup /></Protect>} />
        <Route path="/computer"          element={<Protect><ComputerDashboard /></Protect>} />
        <Route path="/agents"            element={<Protect><AgentsList /></Protect>} />
        <Route path="/agents/new"        element={<Protect><AgentTypePicker /></Protect>} />
        <Route path="/agents/voice/new"  element={<Protect><VoiceAgentBuilder /></Protect>} />
        <Route path="/agents/voice/:id/build" element={<Protect><VoiceAgentBuilder /></Protect>} />
        <Route path="/agents/workflow/new" element={<Protect><AgentBuilder /></Protect>} />
        <Route path="/agents/:id/build"  element={<Protect><AgentBuilder /></Protect>} />
        <Route path="/templates"         element={<Protect><WorkflowTemplates /></Protect>} />

        {/* Business Hub */}
        <Route path="/conversations" element={<Protect><ConversationsLayout /></Protect>}>
          <Route index element={<Navigate to="chat" replace />} />
          <Route path="chat"           element={<ConversationsTab />} />
          <Route path="manual-actions" element={<ManualActionsTab />} />
          <Route path="snippets"       element={<SnippetsTab />} />
          <Route path="trigger-links"  element={<TriggerLinksTab />} />
        </Route>
        <Route path="/business" element={<Protect><BusinessLayout /></Protect>}>
          <Route index element={<BusinessDashboard />} />
          <Route path="campaigns"  element={<Campaigns />} />
          <Route path="calendar"   element={<Calendar />} />
          <Route path="forms"      element={<Forms />} />
          <Route path="analytics"  element={<Analytics />} />
          <Route path="reputation" element={<Reputation />} />
          {crmRoutes}
        </Route>

        {/* Shared */}
        <Route path="/marketplace" element={<Protect><Marketplace /></Protect>} />
        <Route path="/billing"     element={<Protect><Billing /></Protect>} />
        <Route path="/settings"    element={<Protect><SettingsPage /></Protect>} />
      </Route>

      {/* Catch signed-out (only in Clerk mode) */}
      {withAuth && <Route path="*" element={<SignedOut><RedirectToSignIn /></SignedOut>} />}
    </Routes>
  );
}

// ── Root App ───────────────────────────────────────────────────────────────
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
