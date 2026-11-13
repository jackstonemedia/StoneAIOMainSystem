/**
 * Contact search — regression test.
 *
 * Found by the Phase 4 eval smoke run (2026-11-13): searching for a
 * full name ("Alex Rivera") returned ZERO rows even though the contact
 * existed. The old query matched the whole string against each field
 * with `contains` — "Alex" does not contain "Alex Rivera" — so every
 * full-name search failed and the assistant burned tool rounds
 * re-searching ("Evalworks", "a"). The fix splits the query into
 * terms: every term must appear in some field (name, email, phone,
 * company), case-insensitive.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listContacts } from '../services/crm.service.js';

const { fakeDb } = vi.hoisted(() => ({
  fakeDb: {
    contact: { findMany: vi.fn(), count: vi.fn() },
  },
}));

vi.mock('../../infrastructure/database/client.js', () => ({ db: fakeDb }));

const ROW = {
  id: 'ct_1',
  workspaceId: 'ws_1',
  firstName: 'Alex',
  lastName: 'Rivera',
  email: 'alex.rivera@evalworks.test',
  phone: '+1 (555) 100-1001',
  status: 'active',
  leadScore: 0,
  source: 'manual',
  color: '#fff',
  tagsJson: '[]',
  createdAt: new Date(),
  updatedAt: new Date(),
  company: { id: 'co_1', name: 'Evalworks Inc' },
};

describe('listContacts search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakeDb.contact.findMany.mockResolvedValue([ROW]);
    fakeDb.contact.count.mockResolvedValue(1);
  });

  it('splits a full name into terms — every term must match some field', async () => {
    await listContacts('ws_1', { search: 'Alex Rivera' });
    const where = fakeDb.contact.findMany.mock.calls[0][0].where;
    expect(where.workspaceId).toBe('ws_1');
    expect(where.AND).toHaveLength(2);
    for (const termClause of where.AND) {
      const ors = termClause.OR;
      expect(ors).toContainEqual({ firstName: { contains: expect.any(String), mode: 'insensitive' } });
      expect(ors).toContainEqual({ lastName: { contains: expect.any(String), mode: 'insensitive' } });
      expect(ors).toContainEqual({ email: { contains: expect.any(String), mode: 'insensitive' } });
    }
    expect(where.AND[0].OR[0].firstName.contains).toBe('Alex');
    expect(where.AND[1].OR[0].firstName.contains).toBe('Rivera');
    // Same where clause drives the count.
    expect(fakeDb.contact.count).toHaveBeenCalledWith({ where });
  });

  it('matches a single term case-insensitively across name, email, phone and company', async () => {
    await listContacts('ws_1', { search: 'evalworks' });
    const where = fakeDb.contact.findMany.mock.calls[0][0].where;
    expect(where.AND).toHaveLength(1);
    const ors = where.AND[0].OR;
    expect(ors).toContainEqual({ company: { name: { contains: 'evalworks', mode: 'insensitive' } } });
    expect(ors).toContainEqual({ phone: { contains: 'evalworks' } });
  });

  it('returns the mapped contacts and total', async () => {
    const res = await listContacts('ws_1', { search: 'Alex Rivera' });
    expect(res.total).toBe(1);
    expect(res.contacts[0].name).toBe('Alex Rivera');
    expect(res.contacts[0].businessName).toBe('Evalworks Inc');
  });

  it('no search means no AND clause', async () => {
    await listContacts('ws_1', {});
    const where = fakeDb.contact.findMany.mock.calls[0][0].where;
    expect(where.AND).toBeUndefined();
    expect(where.OR).toBeUndefined();
  });
});
