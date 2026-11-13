/**
 * Platform Tools for Stone AI Assistant — Stone AIO
 * Spec Section 7.7 & Phase 7 Wave D
 */

import type { ToolDefinition } from './types.js';

interface PlatformHelpTopic {
  title: string;
  category: string;
  navigationPath: string;
  summary: string;
  steps: string[];
}

const PLATFORM_HELP_INDEX: Record<string, PlatformHelpTopic> = {
  contacts: {
    title: 'Contacts & Lead Management',
    category: 'CRM',
    navigationPath: '/crm',
    summary: 'View, search, filter, and manage customer records, tags, and communication history.',
    steps: [
      'Navigate to CRM in the main sidebar.',
      'Click on the Contacts tab to view all leads and contacts.',
      'Use the search bar or filter buttons to filter by status, tag, or owner.',
      'Click "New Contact" to create a lead, or click any contact row to open the detailed timeline.',
      'Within Contact Detail, manage notes, tasks, tags, and communication history (Email, SMS).'
    ]
  },
  companies: {
    title: 'Companies & Accounts',
    category: 'CRM',
    navigationPath: '/crm',
    summary: 'Organize contacts under parent organizations and business accounts.',
    steps: [
      'Navigate to CRM in the main sidebar.',
      'Select the Companies tab.',
      'Click "New Company" to enter company name, domain, industry, and address.',
      'Link individual contacts and deals to the company account.'
    ]
  },
  deals: {
    title: 'Deals & Sales Pipelines',
    category: 'CRM',
    navigationPath: '/crm',
    summary: 'Track revenue, opportunities, deal stages, and win rates across custom sales pipelines.',
    steps: [
      'Navigate to CRM and click the Pipeline tab.',
      'Switch between pipelines using the dropdown selector in the top left.',
      'Drag and drop deals across stages to advance them towards Closed Won or Closed Lost.',
      'Click "+ Add Deal" to create an opportunity with amount, expected close date, and contact association.'
    ]
  },
  tasks: {
    title: 'Tasks & Follow-ups',
    category: 'CRM',
    navigationPath: '/crm',
    summary: 'Manage daily to-dos, follow-ups, assignments, and due dates.',
    steps: [
      'Navigate to CRM and select the Tasks tab.',
      'Filter tasks by status (Pending, Completed), priority, or assignee.',
      'Click "+ New Task" to create a task linked to a contact or deal.',
      'Check the checkbox on any task row to mark it completed.'
    ]
  },
  calendar: {
    title: 'Calendar & Appointment Scheduling',
    category: 'Business',
    navigationPath: '/business/calendar',
    summary: 'Manage calendar availability, booking links, and appointments synced with Google Calendar.',
    steps: [
      'Navigate to Business > Calendar in the sidebar.',
      'View upcoming scheduled appointments in day, week, or month view.',
      'Configure booking links and availability schedules in Calendar Settings.',
      'Click an appointment to reschedule, view client details, or cancel.'
    ]
  },
  inbox: {
    title: 'Conversations & Unified Inbox',
    category: 'Conversations',
    navigationPath: '/conversations',
    summary: 'Multi-channel unified messaging across Email, SMS, and Web Chat.',
    steps: [
      'Click Conversations in the main sidebar.',
      'Select any thread from the left conversation list to read the message history.',
      'Type in the bottom reply composer to send an Email or SMS response.',
      'Assign threads to teammates, add labels, or snooze conversations as needed.'
    ]
  },
  email_marketing: {
    title: 'Email Marketing Campaigns & Broadcasts',
    category: 'Marketing',
    navigationPath: '/email-marketing',
    summary: 'Create, design, schedule, and send broadcast campaigns and automated email sequences.',
    steps: [
      'Click Email Marketing in the main sidebar.',
      'Click "Create Campaign" to launch the campaign builder.',
      'Choose a recipient audience from lists or smart segments.',
      'Design email content using the visual builder or AI email copywriter.',
      'Review CAN-SPAM compliance, preview across devices, and send or schedule.'
    ]
  },
  automations: {
    title: 'Automations & Workflow Engine',
    category: 'Automations',
    navigationPath: '/automations',
    summary: 'Build event-driven visual workflows with triggers, conditions, delays, and actions.',
    steps: [
      'Click Automations in the main sidebar.',
      'Click "+ New Workflow" or select an existing workflow.',
      'Select a trigger (e.g. Contact Created, Deal Stage Changed, Appointment Booked).',
      'Add action nodes such as Send Email, Send SMS, Create Task, or Webhook.',
      'Test your workflow and toggle the status from Draft to Active to publish.'
    ]
  },
  assistant: {
    title: 'Stone AI Assistant & Projects',
    category: 'Assistant',
    navigationPath: '/assistant',
    summary: 'General-purpose AI assistant capable of reasoning, researching, and operating the platform.',
    steps: [
      'Click Assistant in the main sidebar.',
      'Use the bottom composer to ask questions, request analysis, or direct actions.',
      'Use the access mode pill to switch between Read-only, Ask first, and Autonomous.',
      'File conversations into Projects (/assistant/projects) with custom knowledge files and CRM links.',
      'Manage personal and workspace preferences in Memory (/assistant/memory).'
    ]
  },
  settings: {
    title: 'Workspace Settings & Team Management',
    category: 'Settings',
    navigationPath: '/admin',
    summary: 'Manage team members, roles, email sending domains, integrations, and workspace autonomy limits.',
    steps: [
      'Navigate to Settings / Admin from the sidebar.',
      'Invite team members and assign roles (Owner, Admin, Member).',
      'Connect custom sending domains and verify DNS DKIM/SPF records.',
      'In the AI Assistant settings tab, configure autonomy caps, daily limits, and quiet hours.'
    ]
  }
};

export const platformTools: ToolDefinition[] = [
  // 1. explain_platform
  {
    name: 'explain_platform',
    description: 'Retrieve navigation guidance, user steps, and feature explanations for any area of Stone AIO (CRM, deals, inbox, campaigns, automations, calendar, assistant, settings).',
    risk: 'read',
    minimumRole: 'member',
    parameters: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'The platform topic to explain: contacts, companies, deals, tasks, calendar, inbox, email_marketing, automations, assistant, settings.',
          enum: [
            'contacts',
            'companies',
            'deals',
            'tasks',
            'calendar',
            'inbox',
            'email_marketing',
            'automations',
            'assistant',
            'settings',
          ],
        },
      },
      required: ['topic'],
    },
    execute: async (args: { topic: string }) => {
      const topicKey = args.topic.toLowerCase().trim();
      const topic = PLATFORM_HELP_INDEX[topicKey];

      if (!topic) {
        return {
          availableTopics: Object.keys(PLATFORM_HELP_INDEX),
          message: `Topic "${args.topic}" not found in help index. Available topics: ${Object.keys(PLATFORM_HELP_INDEX).join(', ')}.`,
        };
      }

      return {
        topic: topic.title,
        category: topic.category,
        navigationPath: topic.navigationPath,
        summary: topic.summary,
        steps: topic.steps,
      };
    },
  },
];
