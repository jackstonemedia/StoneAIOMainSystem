// Clarify-and-refuse rule — pins eval failure classes #3/#4 (2026-11-03).
import { describe, it, expect } from 'vitest';
import { CLARIFY_AND_REFUSE_RULE } from '../service';

describe('CLARIFY_AND_REFUSE_RULE', () => {
  it('instructs the model to clarify instead of guessing', () => {
    expect(CLARIFY_AND_REFUSE_RULE).toContain('ask which one');
    expect(CLARIFY_AND_REFUSE_RULE).toContain('do not pick one');
    expect(CLARIFY_AND_REFUSE_RULE).toContain('Name the options you found');
  });

  it('instructs the model to refuse plainly and never claim the action', () => {
    expect(CLARIFY_AND_REFUSE_RULE).toContain('refuse plainly');
    expect(CLARIFY_AND_REFUSE_RULE).toContain('never claim');
  });

  it('keeps queueing distinct from refusal', () => {
    expect(CLARIFY_AND_REFUSE_RULE).toContain('queueing is not a substitute for a plain refusal');
  });
});
