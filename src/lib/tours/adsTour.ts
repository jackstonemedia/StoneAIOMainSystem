import type { Tour } from './types';

export const adsTour: Tour = {
  key: 'ads',
  title: 'Ad Manager & Lead Sync',
  description: 'Manage multi-channel campaigns, AI creative generation, and instant lead capture.',
  section: 'Ad Manager',
  iconName: 'Megaphone',
  badge: 'Paid Ads',
  steps: [
    {
      id: 'ads-accounts-switch',
      target: '[data-tour="ads-accounts-switch"]',
      title: 'Connected Ad Accounts',
      body: 'Connect and toggle between Facebook, Instagram, Google Ads, and TikTok advertising accounts.',
      placement: 'bottom',
      route: '/ads/overview',
    },
    {
      id: 'ads-create-campaign',
      target: '[data-tour="ads-create-campaign"]',
      title: 'AI Ad Campaign Creator',
      body: 'Generate winning ad copy, high-converting creatives, and targeted audience segments with AI in minutes.',
      placement: 'bottom',
      route: '/ads/overview',
    },
    {
      id: 'ads-metrics-overview',
      target: '[data-tour="ads-metrics-overview"]',
      title: 'Real-Time ROI & Spend Metrics',
      body: 'Track ROAS, CPA, CPC, Impressions, and total ad spend across all active marketing campaigns.',
      placement: 'bottom',
      route: '/ads/overview',
    },
    {
      id: 'ads-leads-sync',
      target: '[data-tour="ads-leads-sync"]',
      title: 'Automated Lead Syncing',
      body: 'Incoming Facebook & Google lead forms sync instantly into your CRM with automatic tag routing and notifications.',
      placement: 'top',
      route: '/ads/overview',
    },
  ],
};
