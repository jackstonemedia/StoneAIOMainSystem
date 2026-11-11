/**
 * Twilio number search + provisioning — Tier 1 Fix 11.
 * GET /sms/available-numbers returned 4 hardcoded 555 numbers regardless of
 * whether Twilio was even connected, and POST /sms/provision created a
 * connection with credentials literally 'PROVISIONED' — SMS could never
 * send from it. Both now use the workspace's real connected Twilio account:
 * search lists live available numbers, provision buys the number from
 * Twilio and stores the real credentials.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

process.env.CHANNEL_ENCRYPTION_KEY = 'ab'.repeat(32);

const state = vi.hoisted(() => ({
  twilioConn: null as any,
  created: [] as any[],
}));

const twilioMock = vi.hoisted(() => ({
  listAvailable: vi.fn(),
  createIncoming: vi.fn(),
  listIncoming: vi.fn(),
}));

vi.mock('../../infrastructure/database/client.js', () => ({
  db: {
    channelConnection: {
      findFirst: vi.fn(async () => state.twilioConn),
      upsert: vi.fn(async ({ create }: any) => {
        const row = { id: 'cc_new', ...create };
        state.created.push(row);
        return row;
      }),
      create: vi.fn(async ({ data }: any) => {
        const row = { id: 'cc_new', ...data };
        state.created.push(row);
        return row;
      }),
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () => null),
      update: vi.fn(async () => ({})),
      delete: vi.fn(async () => ({})),
    },
  },
}));

vi.mock('twilio', () => ({
  default: vi.fn(() => ({
    availablePhoneNumbers: (_country: string) => ({
      local: { list: twilioMock.listAvailable },
    }),
    incomingPhoneNumbers: {
      create: twilioMock.createIncoming,
      list: twilioMock.listIncoming,
    },
  })),
}));

import { encryptJson, decryptJson } from '../services/channels/encryption.js';
import router from '../routes/channels.routes.js';

const app = express();
app.use(express.json());
app.use((req: any, _res, next) => {
  req.workspaceId = 'ws_test';
  req.userId = 'user_admin';
  next();
});
app.use(router);

describe('Twilio number search + provisioning (Tier 1 Fix 11)', () => {
  beforeEach(() => {
    state.created = [];
    twilioMock.listAvailable.mockReset();
    twilioMock.createIncoming.mockReset();
    state.twilioConn = {
      id: 'cc_twilio',
      provider: 'twilio',
      isActive: true,
      credentialsJson: encryptJson({ accountSid: 'AC_real_sid', authToken: 'real_token' }),
    };
  });

  it('available-numbers without a Twilio connection is 400 and never calls Twilio', async () => {
    state.twilioConn = null;
    const res = await request(app).get('/sms/available-numbers?areaCode=415');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Connect Twilio first/);
    expect(twilioMock.listAvailable).not.toHaveBeenCalled();
  });

  it('available-numbers searches live Twilio and returns real numbers (no 555 fakes)', async () => {
    twilioMock.listAvailable.mockResolvedValue([
      { phoneNumber: '+14155550100', friendlyName: '(415) 555-0100', locality: 'San Francisco', region: 'CA' },
      { phoneNumber: '+14155550101', friendlyName: '(415) 555-0101', locality: 'San Francisco', region: 'CA' },
    ]);
    const res = await request(app).get('/sms/available-numbers?areaCode=415');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({ phoneNumber: '+14155550100', locality: 'San Francisco' });
    expect(twilioMock.listAvailable).toHaveBeenCalledWith({ areaCode: 415, limit: 10 });
  });

  it('available-numbers surfaces a Twilio failure as 502', async () => {
    twilioMock.listAvailable.mockRejectedValue(new Error('Twilio 20003: authenticate failed'));
    const res = await request(app).get('/sms/available-numbers?areaCode=415');
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/20003/);
  });

  it('provision without a Twilio connection is 400 and buys nothing', async () => {
    state.twilioConn = null;
    const res = await request(app).post('/sms/provision').send({ phoneNumber: '+14155550100' });
    expect(res.status).toBe(400);
    expect(twilioMock.createIncoming).not.toHaveBeenCalled();
    expect(state.created).toHaveLength(0);
  });

  it('provision buys the number from Twilio and stores the REAL credentials', async () => {
    twilioMock.createIncoming.mockResolvedValue({ phoneNumber: '+14155550100', sid: 'PN123' });
    const res = await request(app).post('/sms/provision').send({ phoneNumber: '+14155550100' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(twilioMock.createIncoming).toHaveBeenCalledWith({ phoneNumber: '+14155550100' });
    expect(state.created).toHaveLength(1);
    const stored = decryptJson(state.created[0].credentialsJson) as any;
    expect(stored).toMatchObject({ accountSid: 'AC_real_sid', authToken: 'real_token' });
    expect(JSON.stringify(stored)).not.toContain('PROVISIONED');
    expect(state.created[0].twilioPhoneNumber).toBe('+14155550100');
  });

  it('provision surfaces a Twilio failure as 502 and stores nothing', async () => {
    twilioMock.createIncoming.mockRejectedValue(new Error('Twilio 21422: number not available'));
    const res = await request(app).post('/sms/provision').send({ phoneNumber: '+14155550100' });
    expect(res.status).toBe(502);
    expect(state.created).toHaveLength(0);
  });
});
