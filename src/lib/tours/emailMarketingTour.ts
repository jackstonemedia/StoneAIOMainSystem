import type { Tour } from './types';

export const emailMarketingTour: Tour = {
  key: 'email-marketing',
  title: 'Email Marketing & Campaigns',
  description: 'Design newsletters, launch automated sequences, and track click metrics.',
  section: 'Email Marketing',
  iconName: 'MailOpen',
  badge: 'Growth Engine',
  steps: [
    {
      id: 'email-create-campaign',
      target: '[data-tour="email-create-campaign"]',
      title: 'Launch a New Campaign',
      body: 'Draft broadcast newsletters, product updates, or automated drips with Resend and custom sender domains.',
      placement: 'bottom',
      route: '/email-marketing/campaigns',
    },
    {
      id: 'email-templates-tab',
      target: '[data-tour="email-templates-tab"]',
      title: 'Visual Email Templates',
      body: 'Design responsive, high-converting email layouts using rich components, custom buttons, and dynamic tags.',
      placement: 'bottom',
      route: '/email-marketing/campaigns',
    },
    {
      id: 'email-audience-tab',
      target: '[data-tour="email-audience-tab"]',
      title: 'Audience Segmentation',
      body: 'Segment contacts with granular tags, unsubscribe safety checks, and smart filters to boost open rates.',
      placement: 'bottom',
      route: '/email-marketing/campaigns',
    },
    {
      id: 'email-analytics-tab',
      target: '[data-tour="email-analytics-tab"]',
      title: 'Real-Time Delivery & Open Analytics',
      body: 'Track deliverability, open rates, link clicks, bounce rates, and unsubscribes with live webhook tracking.',
      placement: 'bottom',
      route: '/email-marketing/campaigns',
    },
  ],
};
