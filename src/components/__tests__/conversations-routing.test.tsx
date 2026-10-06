import { describe, it, expect } from 'vitest';
import { ROUTES } from '../../constants/routes';

describe('Conversations Canonical Routing & Inbox Deprecation', () => {
  it('ROUTES.INBOX points to canonical /conversations paths', () => {
    expect(ROUTES.INBOX.ROOT).toBe('/conversations');
    expect(ROUTES.INBOX.CONVERSATION('conv-123')).toBe('/conversations/conv-123');
    expect(ROUTES.INBOX.REPORTS).toBe('/conversations');
    expect(ROUTES.INBOX.SETTINGS.CHANNELS).toBe('/conversations/settings/channels');
    expect(ROUTES.INBOX.SETTINGS.LABELS).toBe('/conversations/settings/tags');
    expect(ROUTES.INBOX.SETTINGS.CANNED).toBe('/conversations/settings/templates');
  });

  it('ROUTES.CONVERSATIONS defines canonical unified inbox routes', () => {
    expect(ROUTES.CONVERSATIONS.ROOT).toBe('/conversations');
    expect(ROUTES.CONVERSATIONS.CHAT).toBe('/conversations/chat');
    expect(ROUTES.CONVERSATIONS.MANUAL_ACTIONS).toBe('/conversations/manual-actions');
    expect(ROUTES.CONVERSATIONS.SNIPPETS).toBe('/conversations/snippets');
    expect(ROUTES.CONVERSATIONS.TRIGGER_LINKS).toBe('/conversations/trigger-links');
  });
});
