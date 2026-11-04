// Approve-mode queue rule — pins the narrate-vs-queue fix (2026-11-03).
import { describe, it, expect } from 'vitest';
import { APPROVE_MODE_RULE } from '../service';

describe('APPROVE_MODE_RULE', () => {
  it('instructs the model to call the tool so it is queued', () => {
    expect(APPROVE_MODE_RULE).toContain('CALL the tool');
    expect(APPROVE_MODE_RULE).toContain('queued for approval');
  });

  it('forbids substituting a written plan for the tool call', () => {
    expect(APPROVE_MODE_RULE).toContain('Do not write out a plan instead of calling the tool');
  });

  it('keeps the approval guarantees', () => {
    expect(APPROVE_MODE_RULE).toContain('do exactly what was approved and nothing more');
    expect(APPROVE_MODE_RULE).toContain('Every mutating or outbound action waits for approval');
  });
});
