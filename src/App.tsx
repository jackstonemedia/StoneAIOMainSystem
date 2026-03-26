/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import AgentsList from './pages/AgentsList';
import AgentCreation from './pages/AgentCreation';
import AgentBuilder from './pages/AgentBuilder';
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
import CarouselAgentBuilder from './pages/CarouselAgentBuilder';

// Business Hub
import BusinessLayout from './pages/business/BusinessLayout';
import BusinessDashboard from './pages/business/BusinessDashboard';
import Campaigns from './pages/business/Campaigns';
import Calendar from './pages/business/Calendar';
import Forms from './pages/business/Forms';
import Analytics from './pages/business/Analytics';
import Reputation from './pages/business/Reputation';

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

export default function App() {
  const isDevBypass = !PUBLISHABLE_KEY;

  return (
    <QueryClientProvider client={queryClient}>
      {isDevBypass ? (
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/onboarding" element={<Onboarding />} />

            {/* Authenticated Routes (Bypassed) */}
            <Route element={<AppShell />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/assistant" element={<AIAssistant />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/computer/setup" element={<ComputerSetup />} />
              <Route path="/computer" element={<ComputerDashboard />} />
              <Route path="/agents" element={<AgentsList />} />
              <Route path="/agents/new" element={<AgentCreation />} />
              <Route path="/agents/voice/:id/build" element={<VoiceAgentBuilder />} />
              <Route path="/agents/voice/new" element={<VoiceAgentBuilder />} />
              <Route path="/agents/carousel/:id/build" element={<CarouselAgentBuilder />} />
              <Route path="/agents/carousel/new" element={<CarouselAgentBuilder />} />
              <Route path="/templates" element={<WorkflowTemplates />} />
              <Route path="/business" element={<BusinessLayout />}>
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
              <Route path="/marketplace" element={<Marketplace />} />
              <Route path="/billing" element={<Billing />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            <Route path="/agents/:id/build" element={<AgentBuilder />} />
          </Routes>
        </BrowserRouter>
      ) : (
        <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
          <BrowserRouter>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/onboarding" element={<Onboarding />} />

              {/* Authenticated Routes */}
              <Route element={<AppShell />}>
                {/* Core */}
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/assistant" element={<AIAssistant />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/computer/setup" element={<ComputerSetup />} />
                <Route path="/computer" element={<ComputerDashboard />} />

                {/* Agents */}
                <Route path="/agents" element={<AgentsList />} />
                <Route path="/agents/new" element={<AgentCreation />} />
                <Route path="/templates" element={<WorkflowTemplates />} />

                {/* Business Hub */}
                <Route path="/business" element={<BusinessLayout />}>
                  <Route index element={<BusinessDashboard />} />
                  <Route path="campaigns" element={<Campaigns />} />
                  <Route path="calendar" element={<Calendar />} />
                  <Route path="forms" element={<Forms />} />
                  <Route path="analytics" element={<Analytics />} />
                  <Route path="reputation" element={<Reputation />} />

                  {/* CRM (nested under Business) */}
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

                {/* Utility */}
                <Route path="/marketplace" element={<Marketplace />} />
                <Route path="/billing" element={<Billing />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
              
              {/* Full-screen Builder Route */}
              <Route path="/agents/:id/build" element={
                <>
                  <SignedIn>
                    <AgentBuilder />
                  </SignedIn>
                  <SignedOut>
                    <RedirectToSignIn />
                  </SignedOut>
                </>
              } />

              {/* Voice Agent Builder Routes */}
              <Route path="/agents/voice/:id/build" element={
                <>
                  <SignedIn>
                    <VoiceAgentBuilder />
                  </SignedIn>
                  <SignedOut>
                    <RedirectToSignIn />
                  </SignedOut>
                </>
              } />
              <Route path="/agents/voice/new" element={
                <>
                  <SignedIn>
                    <VoiceAgentBuilder />
                  </SignedIn>
                  <SignedOut>
                    <RedirectToSignIn />
                  </SignedOut>
                </>
              } />
              
              {/* Carousel Agent Builder Routes */}
              <Route path="/agents/carousel/:id/build" element={
                <>
                  <SignedIn>
                    <CarouselAgentBuilder />
                  </SignedIn>
                  <SignedOut>
                    <RedirectToSignIn />
                  </SignedOut>
                </>
              } />
              <Route path="/agents/carousel/new" element={
                <>
                  <SignedIn>
                    <CarouselAgentBuilder />
                  </SignedIn>
                  <SignedOut>
                    <RedirectToSignIn />
                  </SignedOut>
                </>
              } />
            </Routes>
          </BrowserRouter>
        </ClerkProvider>
      )}
    </QueryClientProvider>
  );
}
