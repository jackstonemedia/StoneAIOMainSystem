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

// Business Pages
import Campaigns from './pages/business/Campaigns';
import Calendar from './pages/business/Calendar';
import Forms from './pages/business/Forms';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/onboarding" element={<Onboarding />} />

        {/* Authenticated Routes */}
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/assistant" element={<AIAssistant />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/computer/setup" element={<ComputerSetup />} />
          <Route path="/computer" element={<ComputerDashboard />} />
          <Route path="/agents" element={<AgentsList />} />
          <Route path="/agents/new" element={<AgentCreation />} />
          <Route path="/templates" element={<WorkflowTemplates />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/settings" element={<SettingsPage />} />
          
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/forms" element={<Forms />} />
          
          {/* CRM Routes */}
          <Route path="/crm" element={<CrmLayout />}>
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

        {/* Full-screen Builder Route */}
        <Route path="/agents/:id/build" element={<AgentBuilder />} />
      </Routes>
    </BrowserRouter>
  );
}
