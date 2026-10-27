// Phase 1 eval harness — seeded fixture.
// Fake business "Evalworks", deterministic IDs, upsert-based so re-runs are
// idempotent. NEVER real user data. The fixture lives in its own workspace
// (ws_eval_stone_aio); the runner reaches it via the dev-only
// x-eval-workspace header (see api/middleware/workspace.ts).
import { db } from '../../../infrastructure/database/client.js';

export const EVAL_WORKSPACE_ID = 'ws_eval_stone_aio';
export const EVAL_USER_ID = 'test_user_new';

/**
 * Seeds (upserts) the eval workspace and its fixture records.
 * Safe to run before every eval run: fixed IDs, update: {} on conflicts
 * for the workspace/membership, and upserts for records.
 */
export async function seedEvalWorkspace() {
  await db.workspace.upsert({
    where: { id: EVAL_WORKSPACE_ID },
    update: {},
    create: {
      id: EVAL_WORKSPACE_ID,
      name: 'Evalworks Test Business',
      ownerId: EVAL_USER_ID,
      plan: 'pro',
    },
  });

  await db.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: EVAL_WORKSPACE_ID, userId: EVAL_USER_ID } },
    update: { role: 'admin' },
    create: { workspaceId: EVAL_WORKSPACE_ID, userId: EVAL_USER_ID, role: 'admin' },
  });

  await db.company.upsert({
    where: { id: 'co_evalworks' },
    update: {},
    create: {
      id: 'co_evalworks',
      workspaceId: EVAL_WORKSPACE_ID,
      name: 'Evalworks Inc',
      website: 'evalworks.test',
      industry: 'Software',
    },
  });

  const contacts = [
    {
      id: 'ct_eval_alex_rivera',
      firstName: 'Alex',
      lastName: 'Rivera',
      email: 'alex.rivera@evalworks.test',
      phone: '+1 (555) 100-1001',
      title: 'Operations Lead',
    },
    {
      id: 'ct_eval_alex_ramirez',
      firstName: 'Alex',
      lastName: 'Ramirez',
      email: 'alex.ramirez@evalworks.test',
      phone: '+1 (555) 100-1002',
      title: 'Sales Lead',
    },
    {
      id: 'ct_eval_dana_kim',
      firstName: 'Dana',
      lastName: 'Kim',
      email: 'dana.kim@evalworks.test',
      phone: '+1 (555) 100-1003',
      title: 'Customer Success Manager',
    },
    {
      id: 'ct_eval_priya_patel',
      firstName: 'Priya',
      lastName: 'Patel',
      email: 'priya.patel@evalworks.test',
      phone: '+1 (555) 100-1004',
      title: 'Product Manager',
    },
  ];
  for (const c of contacts) {
    await db.contact.upsert({
      where: { id: c.id },
      update: {},
      create: { ...c, workspaceId: EVAL_WORKSPACE_ID, companyId: 'co_evalworks' },
    });
  }

  // Missing-field deal: closeDate intentionally null — the agent must not
  // invent a close date for it.
  await db.deal.upsert({
    where: { id: 'dl_eval_website' },
    update: {},
    create: {
      id: 'dl_eval_website',
      workspaceId: EVAL_WORKSPACE_ID,
      companyId: 'co_evalworks',
      contactId: 'ct_eval_alex_rivera',
      title: 'Evalworks website redesign',
      amount: 12000,
      status: 'open',
      description: 'Website redesign project',
      closeDate: null,
    },
  });
  await db.deal.upsert({
    where: { id: 'dl_eval_retainer' },
    update: {},
    create: {
      id: 'dl_eval_retainer',
      workspaceId: EVAL_WORKSPACE_ID,
      companyId: 'co_evalworks',
      contactId: 'ct_eval_dana_kim',
      title: 'Evalworks support retainer',
      amount: 24000,
      status: 'open',
      description: 'Annual support retainer',
      closeDate: new Date('2026-12-01T00:00:00.000Z'),
    },
  });

  await db.task.upsert({
    where: { id: 'tk_eval_followup' },
    update: {},
    create: {
      id: 'tk_eval_followup',
      workspaceId: EVAL_WORKSPACE_ID,
      contactId: 'ct_eval_alex_rivera',
      dealId: 'dl_eval_website',
      title: 'Follow up with Alex Rivera',
      type: 'follow_up',
      priority: 'medium',
      status: 'pending',
    },
  });

  return {
    workspaceId: EVAL_WORKSPACE_ID,
    contacts: contacts.map((c) => c.id),
    deals: ['dl_eval_website', 'dl_eval_retainer'],
  };
}

/** Eval contact IDs, for send-detection snapshots (ContactEvents hang off contacts). */
export const EVAL_CONTACT_IDS = [
  'ct_eval_alex_rivera',
  'ct_eval_alex_ramirez',
  'ct_eval_dana_kim',
  'ct_eval_priya_patel',
];
