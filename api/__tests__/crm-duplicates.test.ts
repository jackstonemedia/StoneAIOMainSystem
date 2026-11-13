/**
 * Duplicate detection + merge — Tier 2 Fix 7.
 * The Contacts page detected duplicates client-side from the current
 * paginated page only, with exact-match email/phone, a Scan button with no
 * onClick, and no merge endpoint at all (the merge modal was dead code).
 * Detection is now a workspace-wide server scan with normalized email/phone,
 * and merging moves every linked record to the kept contact in one
 * transaction before deleting the duplicates.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

process.env.CHANNEL_ENCRYPTION_KEY = 'ab'.repeat(32);

function matchWhere(row: any, where: any): boolean {
  if (!where) return true;
  for (const [key, cond] of Object.entries(where)) {
    if (key === 'OR') {
      if (!(cond as any[]).some((w) => matchWhere(row, w))) return false;
      continue;
    }
    if (cond && typeof cond === 'object' && 'in' in (cond as any)) {
      if (!(cond as any).in.includes(row[key])) return false;
    } else if (row[key] !== cond) {
      return false;
    }
  }
  return true;
}

function table(rows: any[]) {
  return {
    findMany: vi.fn(async ({ where }: any = {}) => rows.filter((r) => matchWhere(r, where))),
    findFirst: vi.fn(async ({ where }: any = {}) => rows.find((r) => matchWhere(r, where)) ?? null),
    update: vi.fn(async ({ where, data }: any) => {
      const row = rows.find((r) => matchWhere(r, where));
      if (row) Object.assign(row, data);
      return row ?? null;
    }),
    updateMany: vi.fn(async ({ where, data }: any) => {
      let count = 0;
      for (const row of rows) {
        if (matchWhere(row, where)) { Object.assign(row, data); count++; }
      }
      return { count };
    }),
    delete: vi.fn(async ({ where }: any) => {
      const idx = rows.findIndex((r) => matchWhere(r, where));
      if (idx >= 0) return rows.splice(idx, 1)[0];
      return null;
    }),
    deleteMany: vi.fn(async ({ where }: any = {}) => {
      let count = 0;
      for (let i = rows.length - 1; i >= 0; i--) {
        if (matchWhere(rows[i], where)) { rows.splice(i, 1); count++; }
      }
      return { count };
    }),
  };
}

const state = vi.hoisted(() => ({
  contacts: [] as any[],
  deals: [] as any[],
  tasks: [] as any[],
  contactEvents: [] as any[],
  activities: [] as any[],
  smartListItems: [] as any[],
  contactRelations: [] as any[],
  contactListMemberships: [] as any[],
  recipientStates: [] as any[],
}));

const tables = vi.hoisted(() => ({} as Record<string, any>));

// The fake tables close over the state arrays by reference, so tests must
// mutate the arrays in place (splice), never reassign them.
function setRows(key: string, rows: any[]) {
  const arr = (state as any)[key] as any[];
  arr.splice(0, arr.length, ...rows);
}

vi.mock('../../infrastructure/database/client.js', () => {
  const db: any = {
    $transaction: vi.fn(async (fn: any) => fn(db)),
  };
  const bind = (name: string, rows: any[]) => { db[name] = table(rows); tables[name] = db[name]; };
  // Bound lazily at import time from the live state arrays.
  bind('contact', state.contacts);
  bind('deal', state.deals);
  bind('task', state.tasks);
  bind('contactEvent', state.contactEvents);
  bind('activity', state.activities);
  bind('smartListItem', state.smartListItems);
  bind('contactRelation', state.contactRelations);
  bind('contactListMembership', state.contactListMemberships);
  bind('recipientState', state.recipientStates);
  // Move-only models with no rows in these tests — still need delegates.
  for (const m of ['appointment', 'conversation', 'campaignRecipient', 'automationEnrollment', 'emailEvent', 'sdrLeadDossier']) {
    db[m] = table([]);
  }
  return { db };
});

import router from '../routes/crm.routes.js';

const app = express();
app.use(express.json());
app.use((req: any, _res, next) => {
  req.workspaceId = 'ws_test';
  req.userId = 'user_test';
  next();
});
app.use('/api/crm', router);

function seedContacts() {
  setRows('contacts', [
    { id: 'ct_keep', workspaceId: 'ws_test', firstName: 'Alice', lastName: 'Freeman', email: 'alice@acmecorp.com', phone: '+1 (555) 123-4567', tagsJson: '["VIP"]', emailsJson: '[]', phonesJson: '[]', adLeadId: null, createdAt: new Date('2026-01-10') },
    { id: 'ct_dup_email', workspaceId: 'ws_test', firstName: 'Alice', lastName: 'F.', email: 'ALICE@AcmeCorp.com', phone: '+1 (555) 999-0000', tagsJson: '["Cold Lead"]', emailsJson: '[]', phonesJson: '[]', adLeadId: null, createdAt: new Date('2026-03-02') },
    { id: 'ct_dup_phone', workspaceId: 'ws_test', firstName: 'Alicia', lastName: 'Freeman', email: 'alicia@other.com', phone: '5551234567', tagsJson: '[]', emailsJson: '[]', phonesJson: '[]', adLeadId: null, createdAt: new Date('2026-02-15') },
    { id: 'ct_other', workspaceId: 'ws_test', firstName: 'Bob', lastName: 'Smith', email: 'bob@example.com', phone: '+1 (555) 777-8888', tagsJson: '[]', emailsJson: '[]', phonesJson: '[]', adLeadId: null, createdAt: new Date('2026-01-05') },
    { id: 'ct_other_ws', workspaceId: 'ws_other', firstName: 'Alice', lastName: 'Freeman', email: 'alice@acmecorp.com', phone: '+1 (555) 123-4567', tagsJson: '[]', emailsJson: '[]', phonesJson: '[]', adLeadId: null, createdAt: new Date('2026-01-10') },
  ]);
}

describe('GET /api/crm/contacts/duplicates (Tier 2 Fix 7)', () => {
  beforeEach(() => { seedContacts(); });

  it('finds duplicates workspace-wide with normalized email and phone', async () => {
    const res = await request(app).get('/api/crm/contacts/duplicates');
    expect(res.status).toBe(200);
    // Email group: ct_keep + ct_dup_email (case-insensitive).
    const emailGroup = res.body.find((g: any) => g.matchOn === 'email');
    expect(emailGroup).toBeTruthy();
    expect(emailGroup.contacts.map((c: any) => c.id).sort()).toEqual(['ct_dup_email', 'ct_keep']);
    // Phone group: ct_keep + ct_dup_phone (different formatting, same digits).
    const phoneGroup = res.body.find((g: any) => g.matchOn === 'phone');
    expect(phoneGroup).toBeTruthy();
    expect(phoneGroup.contacts.map((c: any) => c.id).sort()).toEqual(['ct_dup_phone', 'ct_keep']);
    // Bob is in no group; the other workspace's Alice is invisible.
    const allIds = res.body.flatMap((g: any) => g.contacts.map((c: any) => c.id));
    expect(allIds).not.toContain('ct_other');
    expect(allIds).not.toContain('ct_other_ws');
  });

  it('returns an empty list when there are no duplicates', async () => {
    setRows('contacts', [state.contacts[3]]); // Bob only
    const res = await request(app).get('/api/crm/contacts/duplicates');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('POST /api/crm/contacts/:id/merge (Tier 2 Fix 7)', () => {
  beforeEach(() => {
    seedContacts();
    setRows('deals', [{ id: 'dl_1', contactId: 'ct_dup_email', title: 'Dup deal' }]);
    setRows('tasks', [{ id: 'tk_1', contactId: 'ct_dup_phone', title: 'Dup task' }]);
    setRows('contactEvents', [{ id: 'ev_1', contactId: 'ct_dup_email', type: 'note' }]);
    setRows('activities', [{ id: 'ac_1', contactId: 'ct_dup_phone', type: 'call' }]);
    setRows('smartListItems', [
      { id: 'sl_1', smartListId: 'list_a', contactId: 'ct_keep' },
      { id: 'sl_2', smartListId: 'list_a', contactId: 'ct_dup_email' },
      { id: 'sl_3', smartListId: 'list_b', contactId: 'ct_dup_email' },
    ]);
    setRows('contactRelations', []);
    setRows('contactListMemberships', []);
    setRows('recipientStates', []);
  });

  it('moves the duplicates’ deals/tasks/events/activities, unions tags, keeps earliest createdAt, deletes the duplicates', async () => {
    const res = await request(app)
      .post('/api/crm/contacts/ct_keep/merge')
      .send({ duplicateIds: ['ct_dup_email', 'ct_dup_phone'] });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ keptId: 'ct_keep', mergedIds: ['ct_dup_email', 'ct_dup_phone'] });
    // Linked records moved to the kept contact.
    expect(state.deals[0].contactId).toBe('ct_keep');
    expect(state.tasks[0].contactId).toBe('ct_keep');
    expect(state.contactEvents[0].contactId).toBe('ct_keep');
    expect(state.activities[0].contactId).toBe('ct_keep');
    // Duplicates deleted; kept remains.
    expect(state.contacts.map((c: any) => c.id).sort()).toEqual(['ct_keep', 'ct_other', 'ct_other_ws']);
    const kept = state.contacts.find((c: any) => c.id === 'ct_keep');
    // Tags unioned; earliest createdAt (2026-01-10) kept, not the dups' later dates.
    expect(JSON.parse(kept.tagsJson).sort()).toEqual(['Cold Lead', 'VIP']);
    expect(new Date(kept.createdAt).toISOString()).toBe('2026-01-10T00:00:00.000Z');
    // The duplicates' distinct addresses are preserved in the multi-value fields.
    expect(JSON.parse(kept.emailsJson)).toContain('alicia@other.com');
    expect(JSON.parse(kept.phonesJson)).toContain('+1 (555) 999-0000');
  });

  it('dedupes unique-constrained list rows instead of colliding', async () => {
    const res = await request(app)
      .post('/api/crm/contacts/ct_keep/merge')
      .send({ duplicateIds: ['ct_dup_email'] });
    expect(res.status).toBe(200);
    // list_a: kept already had an item, so the dup's colliding item is dropped.
    // list_b: the dup's item moves over.
    const remaining = state.smartListItems.map((r: any) => [r.smartListId, r.contactId]);
    expect(remaining).toContainEqual(['list_a', 'ct_keep']);
    expect(remaining).toContainEqual(['list_b', 'ct_keep']);
    expect(remaining).toHaveLength(2);
  });

  it('400s when a listed contact is not actually a duplicate', async () => {
    const res = await request(app)
      .post('/api/crm/contacts/ct_keep/merge')
      .send({ duplicateIds: ['ct_other'] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not a duplicate/);
    expect(state.contacts).toHaveLength(5);
  });

  it('400s when the kept contact is listed as its own duplicate', async () => {
    const res = await request(app)
      .post('/api/crm/contacts/ct_keep/merge')
      .send({ duplicateIds: ['ct_keep'] });
    expect(res.status).toBe(400);
    expect(state.contacts).toHaveLength(5);
  });

  it('400s on an unknown duplicate id', async () => {
    const res = await request(app)
      .post('/api/crm/contacts/ct_keep/merge')
      .send({ duplicateIds: ['ct_nope'] });
    expect(res.status).toBe(400);
    expect(state.contacts).toHaveLength(5);
  });

  it('drops relations internal to the merge set instead of creating self-relations', async () => {
    setRows('contactRelations', [
      { id: 'rel_1', sourceContactId: 'ct_dup_email', targetContactId: 'ct_keep', relationshipType: 'colleague' },
      { id: 'rel_2', sourceContactId: 'ct_dup_email', targetContactId: 'ct_other', relationshipType: 'colleague' },
    ]);
    const res = await request(app)
      .post('/api/crm/contacts/ct_keep/merge')
      .send({ duplicateIds: ['ct_dup_email'] });
    expect(res.status).toBe(200);
    // rel_1 was between the kept and the duplicate: gone. rel_2 moved to the kept contact.
    expect(state.contactRelations.map((r: any) => r.id)).toEqual(['rel_2']);
    expect(state.contactRelations[0].sourceContactId).toBe('ct_keep');
    expect(state.contactRelations[0].targetContactId).toBe('ct_other');
  });
});
