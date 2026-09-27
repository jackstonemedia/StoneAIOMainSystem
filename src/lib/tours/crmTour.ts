import type { Tour } from './types';

export const crmTour: Tour = {
  key: 'crm',
  title: 'CRM &Contact Management',
  description: 'Master contact tracking, smart views, pipelines, and quick actions.',
  section: 'CRM',
  iconName: 'Users',
  badge: 'Core Feature',
  steps: [
    {
      id: 'crm-smart-views',
      target: '[data-tour="crm-smart-views"]',
      title: 'Smart Views & Stage Filters',
      body: 'Quickly switch between segmented contact lists, saved filters, or custom smart views to stay focused.',
      placement: 'bottom',
      route: '/crm/contacts',
    },
    {
      id: 'crm-search-filter',
      target: '[data-tour="crm-search-filter"]',
      title: 'Lightning Search & Filtering',
      body: 'Search across your entire CRM in real-time by contact name, email, phone number, or custom tags.',
      placement: 'bottom',
      route: '/crm/contacts',
    },
    {
      id: 'crm-add-contact',
      target: '[data-tour="crm-add-contact"]',
      title: 'Add or Import Contacts',
      body: 'Create a single contact in seconds or bulk-import your existing audience via CSV spreadsheet.',
      placement: 'bottom',
      route: '/crm/contacts',
    },
    {
      id: 'crm-contacts-table',
      target: '[data-tour="crm-contacts-table"]',
      title: 'Interactive Contact Database',
      body: 'Click any contact row to inspect activity timelines, notes, emails, SMS threads, and associated deals.',
      placement: 'top',
      route: '/crm/contacts',
    },
    {
      id: 'crm-pipeline-switch',
      target: '[data-tour="crm-pipeline-switch"]',
      title: 'Visual Deal Pipelines',
      body: 'Switch to Opportunities to drag and drop deals across stages, track probability, and forecast revenue.',
      placement: 'right',
      route: '/crm/contacts',
    },
  ],
};
