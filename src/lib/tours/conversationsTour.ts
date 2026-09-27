import type { Tour } from './types';

export const conversationsTour: Tour = {
  key: 'conversations',
  title: 'Unified Conversations & AI Copilot',
  description: 'Manage Email, SMS, WhatsApp, and Webchat threads with AI assistance.',
  section: 'Conversations',
  iconName: 'MessageSquare',
  badge: 'Omnichannel',
  steps: [
    {
      id: 'inbox-channel-filter',
      target: '[data-tour="inbox-channel-filter"]',
      title: 'Omnichannel Channels',
      body: 'Filter threads across SMS, Email, WhatsApp, and Live Webchat widgets from a single unified inbox.',
      placement: 'bottom',
      route: '/conversations',
    },
    {
      id: 'inbox-conversation-list',
      target: '[data-tour="inbox-conversation-list"]',
      title: 'Priority Thread Feed',
      body: 'Sort by recent activity, unread messages, or assigned agent with realtime status badges.',
      placement: 'right',
      route: '/conversations',
    },
    {
      id: 'inbox-copilot-panel',
      target: '[data-tour="inbox-copilot-panel"]',
      title: 'AI Copilot Assistant',
      body: 'Let AI draft context-aware replies, generate quick summaries of long conversations, or suggest next steps.',
      placement: 'left',
      route: '/conversations',
    },
    {
      id: 'inbox-composer',
      target: '[data-tour="inbox-composer"]',
      title: 'Rich Omnichannel Composer',
      body: 'Send messages instantly, use canned responses, attach media files, and schedule future follow-ups.',
      placement: 'top',
      route: '/conversations',
    },
  ],
};
