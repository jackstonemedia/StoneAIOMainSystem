// Phase 1 eval harness — seeded fixture.
// Fake business "Evalworks", deterministic IDs, upsert-based so re-runs are
// idempotent. NEVER real user data. The fixture lives in its own workspace
// (ws_eval_stone_aio); the runner reaches it via the dev-only
// x-eval-workspace header (see api/middleware/workspace.ts).
import { db } from '../../../infrastructure/database/client.js';
import { loadCorrections } from './corrections.js';

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

  // Phase 4: pipeline + stages (deals below sit in stages so the
  // pipeline-summary cases have deterministic data).
  await db.pipeline.upsert({
    where: { id: 'pl_eval' },
    update: {},
    create: { id: 'pl_eval', workspaceId: EVAL_WORKSPACE_ID, name: 'Evalworks Pipeline', isDefault: true },
  });
  const stages = [
    { id: 'st_eval_new', name: 'New Lead', order: 0, probability: 20 },
    { id: 'st_eval_progress', name: 'In Progress', order: 1, probability: 50 },
    { id: 'st_eval_won', name: 'Won', order: 2, probability: 100 },
  ];
  for (const s of stages) {
    await db.pipelineStage.upsert({
      where: { id: s.id },
      update: {},
      create: { ...s, pipelineId: 'pl_eval' },
    });
  }

  // Missing-field deal: closeDate intentionally null — the agent must not
  // invent a close date for it.
  await db.deal.upsert({
    where: { id: 'dl_eval_website' },
    update: { pipelineStageId: 'st_eval_progress' },
    create: {
      id: 'dl_eval_website',
      workspaceId: EVAL_WORKSPACE_ID,
      companyId: 'co_evalworks',
      contactId: 'ct_eval_alex_rivera',
      pipelineStageId: 'st_eval_progress',
      title: 'Evalworks website redesign',
      amount: 12000,
      status: 'open',
      description: 'Website redesign project',
      closeDate: null,
    },
  });
  await db.deal.upsert({
    where: { id: 'dl_eval_retainer' },
    update: { pipelineStageId: 'st_eval_new' },
    create: {
      id: 'dl_eval_retainer',
      workspaceId: EVAL_WORKSPACE_ID,
      companyId: 'co_evalworks',
      contactId: 'ct_eval_dana_kim',
      pipelineStageId: 'st_eval_new',
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

  // Phase 4: inbox channel + thread, legacy conversation thread,
  // appointment, and a draft campaign with recipients.
  await db.inboxChannel.upsert({
    where: { id: 'ch_eval' },
    update: {},
    create: { id: 'ch_eval', workspaceId: EVAL_WORKSPACE_ID, name: 'Evalworks Inbox', channelType: 'email' },
  });
  await db.inboxConversation.upsert({
    where: { id: 'ic_eval_1' },
    update: {},
    create: {
      id: 'ic_eval_1',
      workspaceId: EVAL_WORKSPACE_ID,
      inboxChannelId: 'ch_eval',
      crmContactId: 'ct_eval_alex_rivera',
      displayId: 1,
      status: 'open',
      subject: 'Website redesign question',
      lastActivityAt: new Date('2026-10-27T10:00:00.000Z'),
    },
  });
  for (const [id, senderType, content] of [
    ['im_eval_1', 'contact', 'Hi, when will the redesign launch?'],
    ['im_eval_2', 'user', 'Next month — we will share a preview.'],
  ] as const) {
    await db.inboxMessage.upsert({
      where: { id },
      update: {},
      create: { id, conversationId: 'ic_eval_1', workspaceId: EVAL_WORKSPACE_ID, senderType, content },
    });
  }
  await db.conversation.upsert({
    where: { id: 'cv_eval_1' },
    update: {},
    create: {
      id: 'cv_eval_1',
      workspaceId: EVAL_WORKSPACE_ID,
      contactId: 'ct_eval_dana_kim',
      channel: 'sms',
      status: 'open',
      lastMessageAt: new Date('2026-10-27T11:00:00.000Z'),
    },
  });
  for (const [id, sender, body, direction] of [
    ['cm_eval_1', 'contact', 'Is the retainer still open?', 'inbound'],
    ['cm_eval_2', 'user', 'Yes, it closes December 1.', 'outbound'],
  ] as const) {
    await db.conversationMessage.upsert({
      where: { id },
      update: {},
      create: { id, conversationId: 'cv_eval_1', sender, body, direction },
    });
  }
  await db.appointment.upsert({
    where: { id: 'ap_eval_1' },
    update: {},
    create: {
      id: 'ap_eval_1',
      workspaceId: EVAL_WORKSPACE_ID,
      title: 'Retainer check-in with Dana Kim',
      contactId: 'ct_eval_dana_kim',
      startTime: new Date('2026-11-10T15:00:00.000Z'),
      endTime: new Date('2026-11-10T16:00:00.000Z'),
      status: 'scheduled',
    },
  });
  await db.campaign.upsert({
    where: { id: 'cp_eval_1' },
    update: {},
    create: {
      id: 'cp_eval_1',
      workspaceId: EVAL_WORKSPACE_ID,
      name: 'Evalworks launch update',
      subject: 'Launch news',
      status: 'DRAFT',
      blockJson: { html: '<p>Hi</p>' },
    },
  });
  for (const [id, contactId] of [
    ['cr_eval_1', 'ct_eval_dana_kim'],
    ['cr_eval_2', 'ct_eval_alex_rivera'],
  ] as const) {
    await db.campaignRecipient.upsert({
      where: { id },
      update: {},
      create: { id, campaignId: 'cp_eval_1', contactId, status: 'PENDING' },
    });
  }

  // Phase 6: Jack's correction rules become standing-rule memories in
  // the eval workspace, so the agent under test runs WITH his rules.
  // Deterministic ids keep re-runs idempotent.
  for (const entry of loadCorrections()) {
    if (!entry.rule) continue;
    await db.agentMemory.upsert({
      where: { id: `mem_rule_${entry.id}` },
      update: { content: entry.rule },
      create: {
        id: `mem_rule_${entry.id}`,
        workspaceId: EVAL_WORKSPACE_ID,
        userId: EVAL_USER_ID,
        kind: 'rule',
        content: entry.rule,
      },
    });
  }

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
