import { describe, it, expect, beforeEach } from 'vitest';
import { legacyAiTracker } from '../legacy-ai-tracker.service.js';

describe('Legacy AI Tracker Service (Stage S0 telemetry)', () => {
  beforeEach(() => {
    legacyAiTracker.resetForTesting();
  });

  it('records route calls and increments counters by route, workspace, and date', () => {
    legacyAiTracker.recordUsage('ai_chat', 'ws-1');
    legacyAiTracker.recordUsage('ai_chat', 'ws-1');
    legacyAiTracker.recordUsage('ai_chat', 'ws-2');
    legacyAiTracker.recordUsage('inbox_copilot_draft', 'ws-1');

    const report = legacyAiTracker.getUsageReport(30);

    expect(report['ai_chat']).toBeDefined();
    expect(report['ai_chat'].totalCalls).toBe(3);
    expect(report['ai_chat'].uniqueWorkspaces).toBe(2);

    expect(report['inbox_copilot_draft']).toBeDefined();
    expect(report['inbox_copilot_draft'].totalCalls).toBe(1);
    expect(report['inbox_copilot_draft'].uniqueWorkspaces).toBe(1);
  });

  it('filters out entries older than the requested day window', () => {
    legacyAiTracker.recordUsage('old_route', 'ws-1');
    const reportRecent = legacyAiTracker.getUsageReport(30);
    expect(reportRecent['old_route'].totalCalls).toBe(1);
  });
});
