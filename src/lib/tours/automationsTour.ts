import type { Tour } from './types';

export const automationsTour: Tour = {
  key: 'automations',
  title: 'Automations & AI Workflows',
  description: 'Automate repetitive tasks, trigger AI actions, and connect integrations.',
  section: 'Automations',
  iconName: 'Zap',
  badge: 'High Impact',
  steps: [
    {
      id: 'automations-create-btn',
      target: '[data-tour="automations-create-btn"]',
      title: 'Create Automated Workflows',
      body: 'Build new workflows from scratch or pick from our curated collection of pre-built business recipes.',
      placement: 'bottom',
      route: '/automations',
    },
    {
      id: 'automations-list',
      target: '[data-tour="automations-list"]',
      title: 'Active Workflows & Triggers',
      body: 'Manage your active workflows. Automations can trigger on contact creation, form submission, tags, or webhooks.',
      placement: 'bottom',
      route: '/automations',
    },
    {
      id: 'automations-runs-tab',
      target: '[data-tour="automations-runs-tab"]',
      title: 'Execution Logs & Run History',
      body: 'Monitor live automation runs, inspect node-by-node execution payloads, and debug failed steps effortlessly.',
      placement: 'bottom',
      route: '/automations',
    },
    {
      id: 'automations-connections-tab',
      target: '[data-tour="automations-connections-tab"]',
      title: 'App & API Connections',
      body: 'Connect third-party webhooks, OpenAI keys, email services, and messaging endpoints to power your steps.',
      placement: 'bottom',
      route: '/automations',
    },
  ],
};
