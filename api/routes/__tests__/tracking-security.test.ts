import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { handleUnsubscribeGet, handleTrackClick } from '../email-marketing.routes.js';
import { createUnsubscribeToken, createClickTrackingSignature } from '../../lib/crypto-tokens.js';

const mockUnsubscribeByEmail = vi.fn().mockResolvedValue(undefined);

vi.mock('../../services/email-marketing/audience.service.js', () => ({
  unsubscribeByEmail: (...args: any[]) => mockUnsubscribeByEmail(...args),
  createEmailList: vi.fn(),
  getEmailLists: vi.fn(),
  getEmailList: vi.fn(),
  updateEmailList: vi.fn(),
  deleteEmailList: vi.fn(),
  addContactToList: vi.fn(),
  removeContactFromList: vi.fn(),
  getListMemberships: vi.fn(),
  importContactsCsv: vi.fn(),
  exportListAsCsv: vi.fn(),
  createSegment: vi.fn(),
  getSegments: vi.fn(),
  updateSegment: vi.fn(),
  deleteSegment: vi.fn(),
  evaluateSegment: vi.fn(),
  getSuppressionList: vi.fn(),
  addToSuppressionList: vi.fn(),
  removeFromSuppressionList: vi.fn(),
}));

vi.mock('../../../infrastructure/database/client.js', () => ({
  db: {
    contact: {
      findFirst: vi.fn().mockImplementation(({ where }) => {
        if (where.id === 'contact-valid' && where.workspaceId === 'ws-1') {
          return Promise.resolve({ id: 'contact-valid', email: 'user@example.com', workspaceId: 'ws-1' });
        }
        return Promise.resolve(null);
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    emailEvent: {
      create: vi.fn().mockResolvedValue({ id: 'event-1' }),
    },
    contactEvent: {
      create: vi.fn().mockResolvedValue({ id: 'ce-1' }),
    },
    campaign: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
}));

function createApp() {
  const app = express();
  app.use(express.json());
  app.get('/unsubscribe/:token', handleUnsubscribeGet);
  app.get('/api/email-marketing/track/click', handleTrackClick);
  return app;
}

describe('Tracking & Unsubscribe Security (C4)', () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Unsubscribe HMAC verification', () => {
    it('rejects unauthenticated plain base64 or forged tokens with 400', async () => {
      // Legacy unsigned base64 format "ws-1:contact-valid"
      const legacyToken = Buffer.from('ws-1:contact-valid').toString('base64url');
      const res = await request(app).get(`/unsubscribe/${legacyToken}`);

      expect(res.status).toBe(400);
      expect(res.text).toContain('Invalid or expired unsubscribe link');
      expect(mockUnsubscribeByEmail).not.toHaveBeenCalled();
    });

    it('rejects tampered signature with 400', async () => {
      const validToken = createUnsubscribeToken('ws-1', 'contact-valid');
      const [payload, sig] = validToken.split('.');
      const tamperedToken = `${payload}.${sig.slice(0, -4)}0000`;

      const res = await request(app).get(`/unsubscribe/${tamperedToken}`);
      expect(res.status).toBe(400);
      expect(mockUnsubscribeByEmail).not.toHaveBeenCalled();
    });

    it('successfully unsubscribes when token is validly HMAC-signed', async () => {
      const validToken = createUnsubscribeToken('ws-1', 'contact-valid');
      const res = await request(app).get(`/unsubscribe/${validToken}`);

      expect(res.status).toBe(200);
      expect(res.text).toContain("You've been unsubscribed");
      expect(mockUnsubscribeByEmail).toHaveBeenCalledWith('ws-1', 'user@example.com');
    });
  });

  describe('Click Tracking Open Redirect Prevention', () => {
    it('rejects unsigned external redirect URLs with 400', async () => {
      const res = await request(app)
        .get('/api/email-marketing/track/click')
        .query({
          url: 'https://evil-phishing.com/login',
          w: 'ws-1',
          c: 'contact-valid',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Untrusted or unsigned');
    });

    it('rejects dangerous protocols (javascript:, data:) with 400', async () => {
      const res = await request(app)
        .get('/api/email-marketing/track/click')
        .query({
          url: 'javascript:alert(1)',
          w: 'ws-1',
          c: 'contact-valid',
        });

      expect(res.status).toBe(400);
    });

    it('rejects protocol-relative URLs with 400', async () => {
      const res = await request(app)
        .get('/api/email-marketing/track/click')
        .query({
          url: '//evil-phishing.com',
          w: 'ws-1',
          c: 'contact-valid',
        });

      expect(res.status).toBe(400);
    });

    it('allows signed external redirects (302 redirect)', async () => {
      const externalUrl = 'https://client-landing.com/promo';
      const sig = createClickTrackingSignature({
        url: externalUrl,
        workspaceId: 'ws-1',
        contactId: 'contact-valid',
      });

      const res = await request(app)
        .get('/api/email-marketing/track/click')
        .query({
          url: externalUrl,
          w: 'ws-1',
          c: 'contact-valid',
          sig,
        });

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(externalUrl);
    });

    it('allows relative path redirects without signature (302 redirect)', async () => {
      const relativeUrl = '/dashboard';

      const res = await request(app)
        .get('/api/email-marketing/track/click')
        .query({
          url: relativeUrl,
          w: 'ws-1',
          c: 'contact-valid',
        });

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(relativeUrl);
    });
  });
});
