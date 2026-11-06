/**
 * Stage S2: Mode Enforcement & Tool Authorization Tests
 * Spec Section 2.9
 */

import { describe, it, expect } from 'vitest';
import { evaluateModeGate, hasMinimumRole, getEffectiveMode } from '../services/assistant/modes.js';
import { crmTools } from '../services/assistant/tools/crm.tools.js';

describe('Role Hierarchy & Mode Resolution', () => {
  it('enforces role levels: owner >= admin >= member', () => {
    expect(hasMinimumRole('owner', 'admin')).toBe(true);
    expect(hasMinimumRole('admin', 'admin')).toBe(true);
    expect(hasMinimumRole('member', 'admin')).toBe(false);
    expect(hasMinimumRole('owner', 'member')).toBe(true);
    expect(hasMinimumRole('member', 'member')).toBe(true);
  });

  it('caps effective mode to workspaceMaxMode', () => {
    expect(getEffectiveMode('full', 'draft')).toBe('draft');
    expect(getEffectiveMode('draft', 'full')).toBe('draft');
    expect(getEffectiveMode('full', 'read_only')).toBe('read_only');
    expect(getEffectiveMode('read_only', 'full')).toBe('read_only');
  });

  it('caps effective mode to draft if member is not allowed full autonomy', () => {
    expect(getEffectiveMode('full', 'full', false)).toBe('draft');
    expect(getEffectiveMode('full', 'full', true)).toBe('full');
  });
});

describe('Mode Gate Table-Driven Enforcement for CRM Tools', () => {
  const readTools = crmTools.filter((t) => t.risk === 'read');
  const writeTools = crmTools.filter((t) => t.risk === 'write');

  describe('Read-Only Mode', () => {
    it.each(readTools.map((t) => [t.name, t]))(
      'allows read tool "%s" to execute',
      (_name, tool) => {
        const decision = evaluateModeGate({
          chatMode: 'read_only',
          workspaceMaxMode: 'full',
          userRole: 'member',
          toolRisk: tool.risk,
          minimumRole: tool.minimumRole,
        });

        expect(decision.action).toBe('execute');
      }
    );

    it.each(writeTools.map((t) => [t.name, t]))(
      'blocks write tool "%s"',
      (_name, tool) => {
        const decision = evaluateModeGate({
          chatMode: 'read_only',
          workspaceMaxMode: 'full',
          userRole: 'member',
          toolRisk: tool.risk,
          minimumRole: tool.minimumRole,
        });

        expect(decision.action).toBe('blocked');
        if (decision.action === 'blocked') {
          expect(decision.reason).toContain('Read-only');
        }
      }
    );
  });

  describe('Draft Mode', () => {
    it.each(readTools.map((t) => [t.name, t]))(
      'allows read tool "%s" to execute',
      (_name, tool) => {
        const decision = evaluateModeGate({
          chatMode: 'draft',
          workspaceMaxMode: 'full',
          userRole: 'member',
          toolRisk: tool.risk,
          minimumRole: tool.minimumRole,
        });

        expect(decision.action).toBe('execute');
      }
    );

    it.each(writeTools.map((t) => [t.name, t]))(
      'proposes write tool "%s"',
      (_name, tool) => {
        const decision = evaluateModeGate({
          chatMode: 'draft',
          workspaceMaxMode: 'full',
          userRole: 'member',
          toolRisk: tool.risk,
          minimumRole: tool.minimumRole,
        });

        expect(decision.action).toBe('proposal');
      }
    );
  });

  describe('Full Autonomy Mode', () => {
    it.each(writeTools.map((t) => [t.name, t]))(
      'allows write tool "%s" to execute automatically for admin/owner',
      (_name, tool) => {
        const decision = evaluateModeGate({
          chatMode: 'full',
          workspaceMaxMode: 'full',
          userRole: 'admin',
          toolRisk: tool.risk,
          minimumRole: tool.minimumRole,
        });

        expect(decision.action).toBe('execute');
      }
    );

    it('requires explicit approval if affected records exceed bulk threshold', () => {
      const decision = evaluateModeGate({
        chatMode: 'full',
        workspaceMaxMode: 'full',
        userRole: 'admin',
        toolRisk: 'write',
        minimumRole: 'member',
        affectedRecordsCount: 50,
        bulkThreshold: 25,
      });

      expect(decision.action).toBe('needs_approval');
    });

    it('requires approval for hardstop tools even in full autonomy', () => {
      const decision = evaluateModeGate({
        chatMode: 'full',
        workspaceMaxMode: 'full',
        userRole: 'owner',
        toolRisk: 'hardstop',
        minimumRole: 'owner',
      });

      expect(decision.action).toBe('needs_approval');
    });
  });

  describe('Unset Mode', () => {
    it('executes read tools silently', () => {
      const decision = evaluateModeGate({
        chatMode: 'unset',
        userRole: 'member',
        toolRisk: 'read',
        minimumRole: 'member',
      });

      expect(decision.action).toBe('execute');
    });

    it('prompts user to pick mode on first write tool attempt', () => {
      const decision = evaluateModeGate({
        chatMode: 'unset',
        userRole: 'member',
        toolRisk: 'write',
        minimumRole: 'member',
      });

      expect(decision.action).toBe('mode_prompt');
    });
  });

  describe('Role-based Permission Guard', () => {
    it('returns no_permission when user role does not satisfy minimum role', () => {
      const decision = evaluateModeGate({
        chatMode: 'full',
        userRole: 'member',
        toolRisk: 'write',
        minimumRole: 'admin',
      });

      expect(decision.action).toBe('no_permission');
      if (decision.action === 'no_permission') {
        expect(decision.requiredRole).toBe('admin');
        expect(decision.currentRole).toBe('member');
      }
    });
  });

  describe('Untrusted Content Gate (Prompt Injection Defense)', () => {
    it('forces needs_approval in Full autonomy if untrusted content was read in the turn', () => {
      const decision = evaluateModeGate({
        chatMode: 'full',
        workspaceMaxMode: 'full',
        userRole: 'admin',
        toolRisk: 'send',
        minimumRole: 'member',
        hasUntrustedContent: true,
      });

      expect(decision.action).toBe('needs_approval');
      if (decision.action === 'needs_approval') {
        expect(decision.reason).toContain('untrusted content');
      }
    });

    it('still allows read tools to execute when untrusted content is present', () => {
      const decision = evaluateModeGate({
        chatMode: 'full',
        workspaceMaxMode: 'full',
        userRole: 'admin',
        toolRisk: 'read',
        minimumRole: 'member',
        hasUntrustedContent: true,
      });

      expect(decision.action).toBe('execute');
    });
  });

  describe('Paused Assistant Governance', () => {
    it('blocks all non-read actions when workspace assistant is paused', () => {
      const decision = evaluateModeGate({
        chatMode: 'full',
        workspaceMaxMode: 'full',
        userRole: 'admin',
        toolRisk: 'write',
        minimumRole: 'member',
        isPaused: true,
      });

      expect(decision.action).toBe('blocked');
      if (decision.action === 'blocked') {
        expect(decision.reason).toContain('paused by a workspace administrator');
      }
    });

    it('allows read tools to execute even when workspace assistant is paused', () => {
      const decision = evaluateModeGate({
        chatMode: 'full',
        workspaceMaxMode: 'full',
        userRole: 'admin',
        toolRisk: 'read',
        minimumRole: 'member',
        isPaused: true,
      });

      expect(decision.action).toBe('execute');
    });
  });

  describe('Capability & Daily Limit Gating in Full Autonomy', () => {
    it('proposes action if capability is disabled in workspace settings', () => {
      const decision = evaluateModeGate({
        chatMode: 'full',
        workspaceMaxMode: 'full',
        userRole: 'admin',
        toolRisk: 'send',
        minimumRole: 'member',
        capability: 'send_sms',
        capabilityEnabled: false,
      });

      expect(decision.action).toBe('proposal');
      if (decision.action === 'proposal') {
        expect(decision.reason).toContain('send_sms');
      }
    });

    it('requires approval if daily outreach limit is exceeded', () => {
      const decision = evaluateModeGate({
        chatMode: 'full',
        workspaceMaxMode: 'full',
        userRole: 'admin',
        toolRisk: 'send',
        minimumRole: 'member',
        capability: 'send_email',
        capabilityEnabled: true,
        dailyLimitExceeded: true,
      });

      expect(decision.action).toBe('needs_approval');
      if (decision.action === 'needs_approval') {
        expect(decision.reason).toContain('Daily outreach limit reached');
      }
    });
  });
});
