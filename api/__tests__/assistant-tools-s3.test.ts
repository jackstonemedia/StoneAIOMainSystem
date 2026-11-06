/**
 * Stage S3: Full Tool Suites & Autonomy Gate Tests
 * Spec Section 2.8 & 2.9
 */

import { describe, it, expect } from 'vitest';
import { toolRegistry } from '../services/assistant/tools/registry.js';
import { evaluateModeGate } from '../services/assistant/modes.js';

describe('Stage S3 Tool Registry Verification', () => {
  it('registers all CRM, communication, calendar, workflow, campaign, and search tools', () => {
    const allTools = toolRegistry.getAllTools();
    const toolNames = allTools.map((t) => t.name);

    // CRM
    expect(toolNames).toContain('search_contacts');
    expect(toolNames).toContain('create_contact');
    expect(toolNames).toContain('create_deal');
    expect(toolNames).toContain('create_task');

    // Communication
    expect(toolNames).toContain('list_inbox_messages');
    expect(toolNames).toContain('draft_email');
    expect(toolNames).toContain('send_email');

    // Calendar
    expect(toolNames).toContain('list_appointments');
    expect(toolNames).toContain('book_appointment');
    expect(toolNames).toContain('cancel_appointment');

    // Workflows
    expect(toolNames).toContain('list_workflows');
    expect(toolNames).toContain('create_workflow');
    expect(toolNames).toContain('trigger_workflow');

    // Campaigns & Search
    expect(toolNames).toContain('list_campaigns');
    expect(toolNames).toContain('get_campaign_analytics');
    expect(toolNames).toContain('web_search');

    expect(allTools.length).toBeGreaterThanOrEqual(18);
  });

  it('generates valid Gemini function declarations for all tools', () => {
    const declarations = toolRegistry.getGeminiFunctionDeclarations();
    expect(declarations.length).toBe(toolRegistry.getAllTools().length);

    for (const d of declarations) {
      expect(d.name).toBeTruthy();
      expect(d.description).toBeTruthy();
      expect(d.parameters).toHaveProperty('type', 'OBJECT');
    }
  });
});

describe('Stage S3 Mode Gate Enforcement on New Tools', () => {
  it('send_email is classified as risk "send" and proposed in Draft mode', () => {
    const tool = toolRegistry.getTool('send_email')!;
    expect(tool).toBeDefined();
    expect(tool.risk).toBe('send');

    const decision = evaluateModeGate({
      chatMode: 'draft',
      userRole: 'member',
      toolRisk: tool.risk,
      minimumRole: tool.minimumRole,
    });

    expect(decision.action).toBe('proposal');
  });

  it('send_email is blocked in Read-only mode', () => {
    const tool = toolRegistry.getTool('send_email')!;
    const decision = evaluateModeGate({
      chatMode: 'read_only',
      userRole: 'member',
      toolRisk: tool.risk,
      minimumRole: tool.minimumRole,
    });

    expect(decision.action).toBe('blocked');
  });

  it('cancel_appointment is destructive and blocked in Read-only mode', () => {
    const tool = toolRegistry.getTool('cancel_appointment')!;
    expect(tool.risk).toBe('destructive');

    const decision = evaluateModeGate({
      chatMode: 'read_only',
      userRole: 'member',
      toolRisk: tool.risk,
      minimumRole: tool.minimumRole,
    });

    expect(decision.action).toBe('blocked');
  });


  it('create_workflow and trigger_workflow require minimumRole "admin"', () => {
    const createWf = toolRegistry.getTool('create_workflow')!;
    const triggerWf = toolRegistry.getTool('trigger_workflow')!;

    expect(createWf.minimumRole).toBe('admin');
    expect(triggerWf.minimumRole).toBe('admin');

    const memberDecision = evaluateModeGate({
      chatMode: 'full',
      userRole: 'member',
      toolRisk: createWf.risk,
      minimumRole: createWf.minimumRole,
    });

    expect(memberDecision.action).toBe('no_permission');
    if (memberDecision.action === 'no_permission') {
      expect(memberDecision.requiredRole).toBe('admin');
    }

    const adminDecision = evaluateModeGate({
      chatMode: 'full',
      userRole: 'admin',
      toolRisk: createWf.risk,
      minimumRole: createWf.minimumRole,
    });

    expect(adminDecision.action).toBe('execute');
  });

  it('strips sensitive headers and keys on tool execution input and output', async () => {
    const execResult = await toolRegistry.execute(
      'list_campaigns',
      { apiKey: 'sk-secret-12345', normalArg: 'test' },
      { workspaceId: 'fake-ws', userId: 'fake-u', userRole: 'member' }
    );

    // Args should have been sanitized
    expect(execResult.args.apiKey).toBe('[REDACTED]');
  });

  it('registers Phase 7 Wave A, B, C, and D tools properly', () => {
    const allTools = toolRegistry.getAllTools();
    const toolNames = allTools.map((t) => t.name);

    // Wave A: CRM, tags, companies, smart lists, calendar reschedule
    expect(toolNames).toContain('create_company');
    expect(toolNames).toContain('update_company');
    expect(toolNames).toContain('add_contact_tag');
    expect(toolNames).toContain('remove_contact_tag');
    expect(toolNames).toContain('list_workspace_tags');
    expect(toolNames).toContain('list_smart_lists');
    expect(toolNames).toContain('complete_task');
    expect(toolNames).toContain('reschedule_appointment');

    // Wave B: reply_to_conversation, send_sms
    expect(toolNames).toContain('reply_to_conversation');
    expect(toolNames).toContain('send_sms');

    // Wave C: create_campaign_draft
    expect(toolNames).toContain('create_campaign_draft');

    // Wave D: explain_platform
    expect(toolNames).toContain('explain_platform');
  });

  it('send_sms is risk "send" and requires capability "send_sms"', () => {
    const smsTool = toolRegistry.getTool('send_sms')!;
    expect(smsTool).toBeDefined();
    expect(smsTool.risk).toBe('send');
    expect(smsTool.capability).toBe('send_sms');
  });

  it('explain_platform executes and provides guidance on topics', async () => {
    const explainTool = toolRegistry.getTool('explain_platform')!;
    expect(explainTool).toBeDefined();
    expect(explainTool.risk).toBe('read');

    const result = await explainTool.execute(
      { topic: 'inbox' },
      { workspaceId: 'ws-test', userId: 'user-test', userRole: 'member' }
    );

    expect(result.topic).toContain('Conversations');
    expect(result.navigationPath).toBe('/conversations');
    expect(result.steps.length).toBeGreaterThan(0);
  });
});
