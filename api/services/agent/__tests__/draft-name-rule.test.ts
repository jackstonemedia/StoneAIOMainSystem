// Draft full-name rule — pins the Alex Rivera / Ramirez trap (2026-11-05).
// Combined eval on merged main (125/142, 88%) showed drafting as the
// weakest category (15/23): all 8 fails are the same trap — the agent
// looks the contact up correctly, then greets "Hi Alex," and drops the
// last name the reply needs. The prompts are unambiguous, so the
// clarify rule never fires; this rule covers that gap.
import { describe, it, expect } from 'vitest';
import { DRAFT_NAME_RULE } from '../service';

describe('DRAFT_NAME_RULE', () => {
  it('instructs the model to use the full name in the greeting', () => {
    expect(DRAFT_NAME_RULE).toContain('full name');
    expect(DRAFT_NAME_RULE).toContain('Hi Alex Ramirez,');
    expect(DRAFT_NAME_RULE).toContain('in the greeting');
  });

  it('forbids shortening to first name only when another contact shares it', () => {
    expect(DRAFT_NAME_RULE).toContain('first name only');
    expect(DRAFT_NAME_RULE).toContain('shares that first name');
  });

  it('extends the full-name rule to tasks, reminders and notes', () => {
    expect(DRAFT_NAME_RULE).toContain('task descriptions');
    expect(DRAFT_NAME_RULE).toContain('reminders');
  });
});
