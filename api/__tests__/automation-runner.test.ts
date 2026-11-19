import { describe, it, expect, vi, beforeEach } from 'vitest';

const fakeDb = vi.hoisted(() => {
  const workspaces: any[] = [{ id: 'ws1', plan: 'complete', subscriptionStatus: 'active' }];
  const automations: any[] = [];
  const enrollments: any[] = [];
  const contacts: any[] = [];
  const companies: any[] = [];
  const emailEvents: any[] = [];
  const contactEvents: any[] = [];
  let seq = 0;
  const nextId = () => `id-${++seq}`;
  const match = (row: any, where: any): boolean => {
    if (!where) return true;
    return Object.entries(where).every(([k, v]) => {
      if (v !== null && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v)) {
        if ('lte' in (v as any)) {
          return row[k] != null && new Date(row[k]).getTime() <= new Date((v as any).lte).getTime();
        }
        return false;
      }
      return row[k] === v;
    });
  };
  const db = {
    workspace: {
      findUnique: async ({ where }: any) => workspaces.find((w) => w.id === where.id) ?? null,
    },
    automation: {
      findMany: async ({ where }: any = {}) => automations.filter((a) => match(a, where)),
      findFirst: async ({ where }: any = {}) => automations.find((a) => match(a, where)) ?? null,
      findUnique: async ({ where }: any) => automations.find((a) => a.id === where.id) ?? null,
      create: async ({ data }: any) => {
        const row = { id: nextId(), ...data };
        automations.push(row);
        return row;
      },
    },
    automationEnrollment: {
      findMany: async ({ where, orderBy, take }: any = {}) => {
        let rows = enrollments.filter((e) => match(e, where));
        if (orderBy?.enrolledAt === 'desc') {
          rows = [...rows].sort((a, b) => +new Date(b.enrolledAt) - +new Date(a.enrolledAt));
        }
        return take ? rows.slice(0, take) : rows;
      },
      findUnique: async ({ where }: any) => enrollments.find((e) => e.id === where.id) ?? null,
      create: async ({ data }: any) => {
        const row = {
          id: nextId(), currentStepId: null, resumeAt: null, lastError: null,
          attempts: 0, enrolledAt: new Date(), exitedAt: null, exitReason: null, ...data,
        };
        enrollments.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = enrollments.find((e) => e.id === where.id);
        Object.assign(row, data);
        return row;
      },
    },
    contact: {
      findUnique: async ({ where }: any) => contacts.find((c) => c.id === where.id) ?? null,
      findFirst: async ({ where }: any = {}) => contacts.find((c) => match(c, where)) ?? null,
      findMany: async ({ where }: any = {}) => contacts.filter((c) => match(c, where)),
      update: async ({ where, data }: any) => {
        const row = contacts.find((c) => c.id === where.id);
        Object.assign(row, data);
        return row;
      },
    },
    company: {
      findUnique: async ({ where }: any) => companies.find((c) => c.id === where.id) ?? null,
    },
    emailEvent: {
      findFirst: async ({ where }: any = {}) => emailEvents.find((e) => match(e, where)) ?? null,
      create: async ({ data }: any) => {
        const row = { id: nextId(), ...data };
        emailEvents.push(row);
        return row;
      },
    },
    contactEvent: {
      create: async ({ data }: any) => {
        const row = { id: nextId(), ...data };
        contactEvents.push(row);
        return row;
      },
    },
    suppressionEntry: { findFirst: async () => null },
  };
  return { db, workspaces, automations, enrollments, contacts, companies, emailEvents, contactEvents };
});

vi.mock('../../infrastructure/database/client.js', () => ({ db: fakeDb.db }));

const mailCtl = vi.hoisted(() => ({
  mailbox: { id: 'mb1', provider: 'gmail', email: 'outreach@example.com' } as any,
}));
vi.mock('../services/email-marketing/mailbox-pool.service.js', () => ({
  selectNextMailbox: vi.fn(async () => mailCtl.mailbox),
  recordSendSuccess: vi.fn(async () => undefined),
  recordSendAuthError: vi.fn(async () => undefined),
}));

const gmailCtl = vi.hoisted(() => ({ calls: [] as any[][] }));
vi.mock('../services/channels/gmail.service.js', () => ({
  sendGmailMessage: vi.fn(async (...args: any[]) => {
    gmailCtl.calls.push(args);
    return { messageId: 'msg-1', threadId: null };
  }),
}));

const audCtl = vi.hoisted(() => ({ suppressed: false }));
vi.mock('../services/email-marketing/audience.service.js', () => ({
  isEmailSuppressed: vi.fn(async () => audCtl.suppressed),
}));

vi.mock('../services/channels/outlook.service.js', () => ({
  sendOutlookEmail: vi.fn(async () => undefined),
}));

import {
  evaluateAutomationTrigger,
  enrollContactManually,
  advanceEnrollment,
  resumeDueEnrollments,
  evaluateDateBasedAutomations,
  renderAutomationTemplate,
  evaluateAutomationCondition,
} from '../services/email-marketing/automation-runner.service';
import { sendGmailMessage } from '../services/channels/gmail.service.js';

function seedContact(overrides: Record<string, unknown> = {}) {
  const c = {
    id: 'ct1', workspaceId: 'ws1', firstName: 'Alice', lastName: 'Freeman',
    email: 'alice@example.com', phone: null, tagsJson: '[]', customFieldsJson: '{}',
    status: 'lead', source: 'web', deals: [], companyId: null, dateOfBirth: null,
    createdAt: new Date('2026-01-15T10:00:00Z'), ...overrides,
  };
  fakeDb.contacts.push(c);
  return c;
}

function seedAutomation(overrides: Record<string, unknown> = {}) {
  const a = {
    id: 'au1', workspaceId: 'ws1', name: 'Test', status: 'ACTIVE',
    triggerType: 'CONTACT_CREATED', triggerConfig: {}, canvasJson: { nodes: [], edges: [] },
    reentryAllowed: false, reentryCooldownDays: 0, ...overrides,
  };
  fakeDb.automations.push(a);
  return a;
}

function node(id: string, stepType: string, config: Record<string, unknown> = {}) {
  return { id, type: 'automationNode', data: { stepType, label: stepType, config } };
}

describe('automation runner (complete-platform item 1)', () => {
  beforeEach(() => {
    for (const k of ['automations', 'enrollments', 'contacts', 'companies', 'emailEvents', 'contactEvents'] as const) {
      fakeDb[k].splice(0);
    }
    fakeDb.workspaces[0].plan = 'complete';
    fakeDb.workspaces[0].subscriptionStatus = 'active';
    mailCtl.mailbox = { id: 'mb1', provider: 'gmail', email: 'outreach@example.com' };
    audCtl.suppressed = false;
    gmailCtl.calls.splice(0);
    vi.clearAllMocks();
  });

  it('enrolls on CONTACT_CREATED and sends the templated email + adds the tag', async () => {
    const contact = seedContact();
    seedAutomation({
      canvasJson: {
        nodes: [
          node('n1', 'SEND_EMAIL', { subject: 'Welcome {{firstName}}!', body: 'Hi {{firstName}}, welcome.' }),
          node('n2', 'ADD_TAG', { tag: 'welcomed' }),
        ],
        edges: [{ source: 'n1', target: 'n2' }],
      },
    });
    await evaluateAutomationTrigger('ws1', { type: 'contact.created', contactId: contact.id });
    expect(fakeDb.enrollments).toHaveLength(1);
    expect(fakeDb.enrollments[0].exitReason).toBe('COMPLETED_ALL_STEPS');
    expect(fakeDb.enrollments[0].exitedAt).not.toBeNull();
    expect((sendGmailMessage as any).mock.calls).toHaveLength(1);
    const [, to, subject] = (sendGmailMessage as any).mock.calls[0];
    expect(to).toBe('alice@example.com');
    expect(subject).toBe('Welcome Alice!');
    expect(JSON.parse(contact.tagsJson)).toEqual(['welcomed']);
    expect(fakeDb.emailEvents).toHaveLength(1);
    expect(fakeDb.emailEvents[0].eventType).toBe('SENT');
  });

  it('does not enroll twice when reentry is off', async () => {
    const contact = seedContact();
    seedAutomation({ canvasJson: { nodes: [node('n1', 'ADD_TAG', { tag: 'x' })], edges: [] } });
    await evaluateAutomationTrigger('ws1', { type: 'contact.created', contactId: contact.id });
    await evaluateAutomationTrigger('ws1', { type: 'contact.created', contactId: contact.id });
    expect(fakeDb.enrollments).toHaveLength(1);
  });

  it('honors the reentry cooldown', async () => {
    const contact = seedContact();
    seedAutomation({
      reentryAllowed: true, reentryCooldownDays: 7,
      canvasJson: { nodes: [node('n1', 'ADD_TAG', { tag: 'x' })], edges: [] },
    });
    await evaluateAutomationTrigger('ws1', { type: 'contact.created', contactId: contact.id });
    expect(fakeDb.enrollments).toHaveLength(1);
    // Exited 1 day ago: still inside the 7-day cooldown.
    fakeDb.enrollments[0].exitedAt = new Date(Date.now() - 86_400_000);
    await evaluateAutomationTrigger('ws1', { type: 'contact.created', contactId: contact.id });
    expect(fakeDb.enrollments).toHaveLength(1);
    // Exited 8 days ago: cooldown passed.
    fakeDb.enrollments[0].exitedAt = new Date(Date.now() - 8 * 86_400_000);
    await evaluateAutomationTrigger('ws1', { type: 'contact.created', contactId: contact.id });
    expect(fakeDb.enrollments).toHaveLength(2);
  });

  it('TAG_ADDED only fires for the configured tag', async () => {
    const contact = seedContact();
    seedAutomation({
      triggerType: 'TAG_ADDED', triggerConfig: { tag: 'vip' },
      canvasJson: { nodes: [node('n1', 'ADD_TAG', { tag: 'nurture' })], edges: [] },
    });
    await evaluateAutomationTrigger('ws1', { type: 'contact.tag_added', contactId: contact.id, tag: 'cold' });
    expect(fakeDb.enrollments).toHaveLength(0);
    await evaluateAutomationTrigger('ws1', { type: 'contact.tag_added', contactId: contact.id, tag: 'vip' });
    expect(fakeDb.enrollments).toHaveLength(1);
  });

  it('parks at WAIT with resumeAt and resumes after it to run the next step', async () => {
    const contact = seedContact();
    seedAutomation({
      canvasJson: {
        nodes: [
          node('n1', 'WAIT', { amount: 1, unit: 'days' }),
          node('n2', 'SEND_EMAIL', { subject: 'Day 2', body: 'Hello' }),
        ],
        edges: [{ source: 'n1', target: 'n2' }],
      },
    });
    await evaluateAutomationTrigger('ws1', { type: 'contact.created', contactId: contact.id });
    const enr = fakeDb.enrollments[0];
    expect(enr.exitedAt).toBeNull();
    expect(enr.currentStepId).toBe('n1');
    expect(enr.resumeAt).not.toBeNull();
    expect(new Date(enr.resumeAt).getTime()).toBeGreaterThan(Date.now());
    expect((sendGmailMessage as any).mock.calls).toHaveLength(0);

    // Not due yet: the cron leaves it alone.
    expect(await resumeDueEnrollments()).toBe(0);
    // Due: the cron resumes AFTER the wait node.
    enr.resumeAt = new Date(Date.now() - 1000);
    expect(await resumeDueEnrollments()).toBe(1);
    expect((sendGmailMessage as any).mock.calls).toHaveLength(1);
    expect(fakeDb.enrollments[0].exitReason).toBe('COMPLETED_ALL_STEPS');
  });

  it('CONDITION_BRANCH follows the true path and skips the false path', async () => {
    const contact = seedContact({ tagsJson: JSON.stringify(['vip']) });
    seedAutomation({
      canvasJson: {
        nodes: [
          node('n1', 'CONDITION_BRANCH', { field: 'tag', operator: 'contains', value: 'vip' }),
          node('n2', 'ADD_TAG', { tag: 'hot' }),
          node('n3', 'ADD_TAG', { tag: 'cold' }),
        ],
        edges: [
          { source: 'n1', target: 'n2', sourceHandle: 'TRUE_PATH' },
          { source: 'n1', target: 'n3', sourceHandle: 'FALSE_PATH' },
        ],
      },
    });
    await evaluateAutomationTrigger('ws1', { type: 'contact.created', contactId: contact.id });
    expect(JSON.parse(contact.tagsJson)).toEqual(['vip', 'hot']);
  });

  it('CONDITION_BRANCH follows the false path when the condition fails', async () => {
    const contact = seedContact();
    seedAutomation({
      canvasJson: {
        nodes: [
          node('n1', 'CONDITION_BRANCH', { field: 'tag', operator: 'contains', value: 'vip' }),
          node('n2', 'ADD_TAG', { tag: 'hot' }),
          node('n3', 'ADD_TAG', { tag: 'cold' }),
        ],
        edges: [
          { source: 'n1', target: 'n2', sourceHandle: 'TRUE_PATH' },
          { source: 'n1', target: 'n3', sourceHandle: 'FALSE_PATH' },
        ],
      },
    });
    await evaluateAutomationTrigger('ws1', { type: 'contact.created', contactId: contact.id });
    expect(JSON.parse(contact.tagsJson)).toEqual(['cold']);
  });

  it('GOAL_CHECK exits with GOAL_MET when the goal is met', async () => {
    const contact = seedContact({ tagsJson: JSON.stringify(['buyer']) });
    seedAutomation({
      canvasJson: {
        nodes: [
          node('n1', 'GOAL_CHECK', { field: 'tag', operator: 'contains', value: 'buyer' }),
          node('n2', 'ADD_TAG', { tag: 'after-goal' }),
        ],
        edges: [{ source: 'n1', target: 'n2' }],
      },
    });
    await evaluateAutomationTrigger('ws1', { type: 'contact.created', contactId: contact.id });
    expect(fakeDb.enrollments[0].exitReason).toBe('GOAL_MET');
    expect(JSON.parse(contact.tagsJson)).toEqual(['buyer']);
  });

  it('EXIT_AUTOMATION exits with EXITED_BY_STEP', async () => {
    const contact = seedContact();
    seedAutomation({
      canvasJson: { nodes: [node('n1', 'EXIT_AUTOMATION')], edges: [] },
    });
    await evaluateAutomationTrigger('ws1', { type: 'contact.created', contactId: contact.id });
    expect(fakeDb.enrollments[0].exitReason).toBe('EXITED_BY_STEP');
  });

  it('an unknown step stops the enrollment with lastError and no exit', async () => {
    const contact = seedContact();
    seedAutomation({
      canvasJson: { nodes: [node('n1', 'ADD_TO_LIST', {})], edges: [] },
    });
    await evaluateAutomationTrigger('ws1', { type: 'contact.created', contactId: contact.id });
    const enr = fakeDb.enrollments[0];
    expect(enr.exitedAt).toBeNull();
    expect(enr.lastError).toMatch(/Unknown automation step type/);
    expect(enr.attempts).toBe(1);
  });

  it('does not enroll when the workspace plan is below Complete', async () => {
    fakeDb.workspaces[0].plan = 'free';
    const contact = seedContact();
    seedAutomation({ canvasJson: { nodes: [node('n1', 'ADD_TAG', { tag: 'x' })], edges: [] } });
    await evaluateAutomationTrigger('ws1', { type: 'contact.created', contactId: contact.id });
    expect(fakeDb.enrollments).toHaveLength(0);
  });

  it('DATE_BASED enrolls contacts whose birthday is today, and no one else', async () => {
    const today = new Date();
    const birthday = seedContact({
      dateOfBirth: new Date(Date.UTC(1990, today.getUTCMonth(), today.getUTCDate(), 12)),
    });
    seedContact({ dateOfBirth: new Date(Date.UTC(1990, 0, 1, 12)) });
    seedAutomation({
      triggerType: 'DATE_BASED', triggerConfig: { dateField: 'dateOfBirth' },
      canvasJson: { nodes: [node('n1', 'ADD_TAG', { tag: 'birthday' })], edges: [] },
    });
    expect(await evaluateDateBasedAutomations()).toBe(1);
    expect(JSON.parse(birthday.tagsJson)).toEqual(['birthday']);
    expect(fakeDb.enrollments).toHaveLength(1);
  });

  it('SEND_EMAIL to a contact with no email skips the send and continues', async () => {
    const contact = seedContact({ email: null });
    seedAutomation({
      canvasJson: {
        nodes: [
          node('n1', 'SEND_EMAIL', { subject: 'Hi', body: 'Hello' }),
          node('n2', 'ADD_TAG', { tag: 'after' }),
        ],
        edges: [{ source: 'n1', target: 'n2' }],
      },
    });
    await evaluateAutomationTrigger('ws1', { type: 'contact.created', contactId: contact.id });
    expect((sendGmailMessage as any).mock.calls).toHaveLength(0);
    expect(JSON.parse(contact.tagsJson)).toEqual(['after']);
    expect(fakeDb.enrollments[0].exitReason).toBe('COMPLETED_ALL_STEPS');
  });

  it('a suppressed contact exits UNSUBSCRIBED without sending', async () => {
    audCtl.suppressed = true;
    const contact = seedContact();
    seedAutomation({
      canvasJson: { nodes: [node('n1', 'SEND_EMAIL', { subject: 'Hi', body: 'Hello' })], edges: [] },
    });
    await evaluateAutomationTrigger('ws1', { type: 'contact.created', contactId: contact.id });
    expect((sendGmailMessage as any).mock.calls).toHaveLength(0);
    expect(fakeDb.enrollments[0].exitReason).toBe('UNSUBSCRIBED');
  });

  it('no mailbox stops the enrollment with lastError', async () => {
    mailCtl.mailbox = null;
    const contact = seedContact();
    seedAutomation({
      canvasJson: { nodes: [node('n1', 'SEND_EMAIL', { subject: 'Hi', body: 'Hello' })], edges: [] },
    });
    await evaluateAutomationTrigger('ws1', { type: 'contact.created', contactId: contact.id });
    expect((sendGmailMessage as any).mock.calls).toHaveLength(0);
    const enr = fakeDb.enrollments[0];
    expect(enr.exitedAt).toBeNull();
    expect(enr.lastError).toMatch(/No available outreach mailboxes/);
  });

  // Slice 1c — manual enrollment.
  it('enrollContactManually enrolls into a MANUAL_ENROLLMENT automation and runs its steps', async () => {
    const contact = seedContact();
    seedAutomation({
      triggerType: 'MANUAL_ENROLLMENT',
      canvasJson: { nodes: [node('n1', 'ADD_TAG', { tag: 'hand-picked' })], edges: [] },
    });
    const enrollment = await enrollContactManually('ws1', 'au1', contact.id);
    expect(enrollment).not.toBeNull();
    expect(fakeDb.enrollments).toHaveLength(1);
    expect(fakeDb.enrollments[0].exitReason).toBe('COMPLETED_ALL_STEPS');
    expect(JSON.parse(contact.tagsJson)).toEqual(['hand-picked']);
  });

  it('enrollContactManually returns null on a second enroll when reentry is off', async () => {
    const contact = seedContact();
    seedAutomation({
      triggerType: 'MANUAL_ENROLLMENT',
      canvasJson: { nodes: [node('n1', 'ADD_TAG', { tag: 'hand-picked' })], edges: [] },
    });
    await enrollContactManually('ws1', 'au1', contact.id);
    const second = await enrollContactManually('ws1', 'au1', contact.id);
    expect(second).toBeNull();
    expect(fakeDb.enrollments).toHaveLength(1);
  });

  it('enrollContactManually refuses a CONTACT_CREATED automation', async () => {
    const contact = seedContact();
    seedAutomation({ triggerType: 'CONTACT_CREATED' });
    await expect(enrollContactManually('ws1', 'au1', contact.id)).rejects.toThrow(
      /Only MANUAL_ENROLLMENT automations/,
    );
    expect(fakeDb.enrollments).toHaveLength(0);
  });

  it('enrollContactManually refuses a DRAFT automation', async () => {
    const contact = seedContact();
    seedAutomation({ triggerType: 'MANUAL_ENROLLMENT', status: 'DRAFT' });
    await expect(enrollContactManually('ws1', 'au1', contact.id)).rejects.toThrow(/DRAFT/);
    expect(fakeDb.enrollments).toHaveLength(0);
  });

  it('enrollContactManually throws for an unknown automation or contact', async () => {
    const contact = seedContact();
    await expect(enrollContactManually('ws1', 'nope', contact.id)).rejects.toThrow(/Automation not found/);
    seedAutomation({ triggerType: 'MANUAL_ENROLLMENT' });
    await expect(enrollContactManually('ws1', 'au1', 'ghost')).rejects.toThrow(/Contact not found/);
    expect(fakeDb.enrollments).toHaveLength(0);
  });

  it('enrollContactManually refuses when the plan is below Complete', async () => {
    fakeDb.workspaces[0].plan = 'basic';
    const contact = seedContact();
    seedAutomation({ triggerType: 'MANUAL_ENROLLMENT' });
    await expect(enrollContactManually('ws1', 'au1', contact.id)).rejects.toThrow(/Complete plan/);
    expect(fakeDb.enrollments).toHaveLength(0);
  });

  it('renderAutomationTemplate substitutes known fields and leaves unknown keys alone', () => {
    expect(
      renderAutomationTemplate('Hi {{firstName}} {{lastName}} ({{email}}) {{bogus}}', {
        firstName: 'Al', lastName: 'Free', email: 'a@x.com',
      }),
    ).toBe('Hi Al Free (a@x.com) {{bogus}}');
  });

  it('evaluateAutomationCondition handles exists / equals / deal stage', () => {
    expect(evaluateAutomationCondition({ field: 'email', operator: 'exists' }, { email: 'a@x.com' })).toBe(true);
    expect(evaluateAutomationCondition({ field: 'phone', operator: 'exists' }, { phone: null })).toBe(false);
    expect(
      evaluateAutomationCondition(
        { field: 'dealStage', operator: 'equals', value: 'Proposal' },
        { deals: [{ pipelineStage: { id: 'st1', name: 'Proposal' } }] },
      ),
    ).toBe(true);
    expect(
      evaluateAutomationCondition(
        { field: 'dealStage', operator: 'equals', value: 'Won' },
        { deals: [{ pipelineStage: { id: 'st1', name: 'Proposal' } }] },
      ),
    ).toBe(false);
  });
});
