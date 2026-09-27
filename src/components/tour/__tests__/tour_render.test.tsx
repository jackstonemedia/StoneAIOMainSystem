import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TourProvider } from '../TourProvider';
import { TourLauncher } from '../TourLauncher';
import { GettingStartedHub } from '../../dashboard/GettingStartedHub';
import { ToastProvider } from '../../ui/Toast';
import AppShell from '../../layout/AppShell';
import CommandPalette from '../../ui/CommandPalette';
import CrmLayout from '../../../pages/crm/CrmLayout';
import AutomationsLayout from '../../../pages/automations/AutomationsLayout';
import EmailMarketingLayout from '../../../pages/email-marketing/EmailMarketingLayout';
import ConversationsLayout from '../../../pages/conversations/ConversationsLayout';
import AdsLayout from '../../../pages/ads/AdsLayout';
import CalendarLayout from '../../../pages/business/calendar/CalendarLayout';
import BusinessLayout from '../../../pages/business/BusinessLayout';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ToastProvider>
          <TourProvider>
            {children}
          </TourProvider>
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('All Pages and Layouts Render Test', () => {
  it('renders TourLauncher without crashing', () => {
    const { container } = render(<TourLauncher />, { wrapper: Wrapper });
    expect(container).toBeDefined();
  });

  it('renders GettingStartedHub without crashing', () => {
    const { container } = render(<GettingStartedHub />, { wrapper: Wrapper });
    expect(container).toBeDefined();
  });

  it('renders CommandPalette without crashing', () => {
    const { container } = render(<CommandPalette isOpen={true} onClose={() => {}} />, { wrapper: Wrapper });
    expect(container).toBeDefined();
  });

  it('renders AppShell without crashing', () => {
    const { container } = render(<AppShell />, { wrapper: Wrapper });
    expect(container).toBeDefined();
  });

  it('renders CrmLayout without crashing', () => {
    const { container } = render(<CrmLayout />, { wrapper: Wrapper });
    expect(container).toBeDefined();
  });

  it('renders AutomationsLayout without crashing', () => {
    const { container } = render(<AutomationsLayout />, { wrapper: Wrapper });
    expect(container).toBeDefined();
  });

  it('renders EmailMarketingLayout without crashing', () => {
    const { container } = render(<EmailMarketingLayout />, { wrapper: Wrapper });
    expect(container).toBeDefined();
  });

  it('renders ConversationsLayout without crashing', () => {
    const { container } = render(<ConversationsLayout />, { wrapper: Wrapper });
    expect(container).toBeDefined();
  });

  it('renders AdsLayout without crashing', () => {
    const { container } = render(<AdsLayout />, { wrapper: Wrapper });
    expect(container).toBeDefined();
  });

  it('renders CalendarLayout without crashing', () => {
    const { container } = render(<CalendarLayout />, { wrapper: Wrapper });
    expect(container).toBeDefined();
  });

  it('renders BusinessLayout without crashing', () => {
    const { container } = render(<BusinessLayout />, { wrapper: Wrapper });
    expect(container).toBeDefined();
  });
});
