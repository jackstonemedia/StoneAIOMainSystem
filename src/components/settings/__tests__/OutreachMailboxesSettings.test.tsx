import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OutreachMailboxesSettings } from '../OutreachMailboxesSettings';

// Mock dependencies
vi.mock('../../../lib/api/conversations', () => ({
  channelConnectionsApi: {
    list: vi.fn().mockResolvedValue([
      {
        id: 'conn-1',
        provider: 'gmail',
        email: 'alex@company.com',
        label: 'Google Workspace (alex@company.com)',
        isActive: true,
        status: 'ACTIVE',
        dailySendLimit: 40,
        sentTodayCount: 15,
        consecutiveBounces: 0,
      },
      {
        id: 'conn-2',
        provider: 'outlook',
        email: 'sales@company.com',
        label: 'Microsoft 365 (sales@company.com)',
        isActive: true,
        status: 'ACTIVE',
        dailySendLimit: 40,
        sentTodayCount: 5,
        consecutiveBounces: 0,
      },
    ]),
    update: vi.fn().mockResolvedValue({ success: true }),
    disconnect: vi.fn().mockResolvedValue({ success: true }),
    connectGmail: vi.fn(),
    connectOutlook: vi.fn(),
  },
}));

vi.mock('../../../lib/apiClient', () => ({
  apiClient: {
    get: vi.fn().mockImplementation((url: string) => {
      if (url === '/email-marketing/outreach/capacity') {
        return Promise.resolve({
          data: {
            totalCapacity: 80,
            totalSentToday: 20,
            remainingCapacity: 60,
            activeMailboxesCount: 2,
            mailboxes: [
              { id: 'conn-1', email: 'alex@company.com', status: 'ACTIVE', dailySendLimit: 40, sentTodayCount: 15 },
              { id: 'conn-2', email: 'sales@company.com', status: 'ACTIVE', dailySendLimit: 40, sentTodayCount: 5 },
            ],
          },
        });
      }
      return Promise.resolve({ data: [] });
    }),
  },
}));

vi.mock('../../ui/Toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe('OutreachMailboxesSettings', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  it('renders the multi-inbox outreach settings dashboard', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <OutreachMailboxesSettings />
      </QueryClientProvider>
    );

    expect(screen.getByText('Email Outreach Mailboxes')).toBeDefined();
    expect(screen.getByText('Native Outreach Engine')).toBeDefined();
  });
});
