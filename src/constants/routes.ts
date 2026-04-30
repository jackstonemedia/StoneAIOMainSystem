/**
 * Typed route constants.
 * Use these instead of raw strings in <Link to={...}>, navigate(), and route paths.
 * Typos in raw strings give no compile error; these do.
 */
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  SIGNUP: '/signup',
  ONBOARDING: '/onboarding',

  DASHBOARD: '/dashboard',
  ASSISTANT: '/assistant',
  PROJECTS: '/projects',
  MARKETPLACE: '/marketplace',
  BILLING: '/billing',
  SETTINGS: '/settings',
  TEMPLATES: '/templates',

  COMPUTER: {
    SETUP: '/computer/setup',
    DASHBOARD: '/computer',
  },

  AGENTS: {
    LIST: '/agents',
    NEW: '/agents/new',
    VOICE_NEW: '/agents/voice/new',
    VOICE_BUILD: (id: string) => `/agents/voice/${id}/build`,
    WORKFLOW_NEW: '/agents/workflow/new',
    BUILD: (id: string) => `/agents/${id}/build`,
  },

  CONVERSATIONS: {
    ROOT: '/conversations',
    CHAT: '/conversations/chat',
    MANUAL_ACTIONS: '/conversations/manual-actions',
    SNIPPETS: '/conversations/snippets',
    TRIGGER_LINKS: '/conversations/trigger-links',
  },

  BUSINESS: {
    ROOT: '/business',
    CAMPAIGNS: '/business/campaigns',
    CALENDAR: '/business/calendar',
    FORMS: '/business/forms',
    ANALYTICS: '/business/analytics',
    REPUTATION: '/business/reputation',
  },

  CRM: {
    ROOT: '/crm',
    CONTACTS: '/crm/contacts',
    CONTACT: (id: string) => `/crm/contacts/${id}`,
    COMPANIES: '/crm/companies',
    COMPANY: (id: string) => `/crm/companies/${id}`,
    TASKS: '/crm/tasks',
    SMART_LISTS: '/crm/smart-lists',
    BULK_ACTIONS: '/crm/bulk-actions',
    PIPELINE: '/crm/pipeline',
    SETTINGS: '/crm/settings',
  },
} as const;
