/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import AgentsList from './pages/AgentsList';
import AgentTypePicker from './pages/AgentTypePicker';
import Marketplace from './pages/Marketplace';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Onboarding from './pages/Onboarding';
import AppShell from './components/layout/AppShell';
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
import Inbox from './pages/business/Inbox';

// CRM Pages
import CrmLayout from './pages/crm/CrmLayout';
import CrmDashboard from './pages/crm/Dashboard';
import Contacts from './pages/crm/Contacts';
import ContactDetail from './pages/crm/ContactDetail';
import Companies from './pages/crm/Companies';
import CompanyDetail from './pages/crm/CompanyDetail';
import Deals from './pages/crm/Deals';
import DealDetail from './pages/crm/DealDetail';
import Activities from './pages/crm/Activities';
import Pipelines from './pages/crm/Pipelines';
import CrmSettings from './pages/crm/Settings';

import { ClerkProvider, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const PUBLISHABLE_KEY = (import.meta as any).env.VITE_CLERK_PUBLISHABLE_KEY || '';
const queryClient = new QueryClient();

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/onboarding" element={<Onboarding />} />

      {/* Authenticated Routes */}
      <Route element={<AppShell />}>
        {/* Creator Studio */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/assistant" element={<AIAssistant />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/computer/setup" element={<ComputerSetup />} />
        <Route path="/computer" element={<ComputerDashboard />} />

        {/* Agents — active */}
        <Route path="/agents" element={<AgentsList />} />
        <Route path="/agents/new" element={<AgentTypePicker />} />
        <Route path="/agents/voice/new" element={<VoiceAgentBuilder />} />
        <Route path="/agents/voice/:id/build" element={<VoiceAgentBuilder />} />
        {/* Workflow new → goes to AgentBuilder with blank canvas */}
        <Route path="/agents/workflow/new" element={<AgentBuilder />} />
        <Route path="/agents/:id/build" element={<AgentBuilder />} />
        <Route path="/templates" element={<WorkflowTemplates />} />

        {/* Business Hub */}
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/business" element={<BusinessLayout />}>
          <Route index element={<BusinessDashboard />} />
          <Route path="campaigns" element={<Campaigns />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="forms" element={<Forms />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="reputation" element={<Reputation />} />
          {/* CRM nested under business */}
          <Route path="crm" element={<CrmLayout />}>
            <Route index element={<CrmDashboard />} />
            <Route path="contacts" element={<Contacts />} />
            <Route path="contacts/:id" element={<ContactDetail />} />
            <Route path="companies" element={<Companies />} />
            <Route path="companies/:id" element={<CompanyDetail />} />
            <Route path="deals" element={<Deals />} />
            <Route path="deals/:id" element={<DealDetail />} />
            <Route path="activities" element={<Activities />} />
            <Route path="pipelines" element={<Pipelines />} />
            <Route path="settings" element={<CrmSettings />} />
          </Route>
        </Route>

        {/* Shared */}
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  const isDevBypass = !PUBLISHABLE_KEY;

  return (
    <QueryClientProvider client={queryClient}>
      {isDevBypass ? (
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      ) : (
        <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
          <BrowserRouter>
            <Routes>
              {/* Public */}
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/onboarding" element={<Onboarding />} />

              {/* Protected shell */}
              <Route element={<AppShell />}>
                <Route path="/dashboard" element={<SignedIn><Dashboard /></SignedIn>} />
                <Route path="/assistant" element={<SignedIn><AIAssistant /></SignedIn>} />
                <Route path="/projects" element={<SignedIn><Projects /></SignedIn>} />
                <Route path="/computer/setup" element={<SignedIn><ComputerSetup /></SignedIn>} />
                <Route path="/computer" element={<SignedIn><ComputerDashboard /></SignedIn>} />
                <Route path="/agents" element={<SignedIn><AgentsList /></SignedIn>} />
                <Route path="/agents/new" element={<SignedIn><AgentTypePicker /></SignedIn>} />
                <Route path="/agents/voice/new" element={<SignedIn><VoiceAgentBuilder /></SignedIn>} />
                <Route path="/agents/voice/:id/build" element={<SignedIn><VoiceAgentBuilder /></SignedIn>} />
                <Route path="/agents/workflow/new" element={<SignedIn><AgentBuilder /></SignedIn>} />
                <Route path="/agents/:id/build" element={<SignedIn><AgentBuilder /></SignedIn>} />
                <Route path="/templates" element={<SignedIn><WorkflowTemplates /></SignedIn>} />
                <Route path="/inbox" element={<SignedIn><Inbox /></SignedIn>} />
                <Route path="/business" element={<SignedIn><BusinessLayout /></SignedIn>}>
                  <Route index element={<BusinessDashboard />} />
                  <Route path="campaigns" element={<Campaigns />} />
                  <Route path="calendar" element={<Calendar />} />
                  <Route path="forms" element={<Forms />} />
                  <Route path="analytics" element={<Analytics />} />
                  <Route path="reputation" element={<Reputation />} />
                  <Route path="crm" element={<CrmLayout />}>
                    <Route index element={<CrmDashboard />} />
                    <Route path="contacts" element={<Contacts />} />
                    <Route path="contacts/:id" element={<ContactDetail />} />
                    <Route path="companies" element={<Companies />} />
                    <Route path="companies/:id" element={<CompanyDetail />} />
                    <Route path="deals" element={<Deals />} />
                    <Route path="deals/:id" element={<DealDetail />} />
                    <Route path="activities" element={<Activities />} />
                    <Route path="pipelines" element={<Pipelines />} />
                    <Route path="settings" element={<CrmSettings />} />
                  </Route>
                </Route>
                <Route path="/marketplace" element={<SignedIn><Marketplace /></SignedIn>} />
                <Route path="/billing" element={<SignedIn><Billing /></SignedIn>} />
                <Route path="/settings" element={<SignedIn><SettingsPage /></SignedIn>} />
              </Route>

              {/* Catch signed-out */}
              <Route path="*" element={<SignedOut><RedirectToSignIn /></SignedOut>} />
            </Routes>
          </BrowserRouter>
        </ClerkProvider>
      )}
    </QueryClientProvider>
  );
}
