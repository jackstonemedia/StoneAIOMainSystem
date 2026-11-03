// Clean email output — pins the single-email format rule (2026-11-02).
import { describe, it, expect } from 'vitest';
import { EMAIL_FORMAT_RULE } from '../service';

describe('EMAIL_FORMAT_RULE', () => {
  it('requires exactly one email with one subject line', () => {
    expect(EMAIL_FORMAT_RULE).toContain('exactly ONE email');
    expect(EMAIL_FORMAT_RULE).toContain('one Subject line');
  });

  it('forbids the old package scaffolding', () => {
    for (const banned of [
      'multiple subject options',
      'preview text',
      'markdown headers',
      'follow-up variants',
      'offers to do more in the CRM',
    ]) {
      expect(EMAIL_FORMAT_RULE).toContain(banned);
    }
  });

  it('forbids invented details, allowing bracketed placeholders', () => {
    expect(EMAIL_FORMAT_RULE).toContain('Do not invent details');
    expect(EMAIL_FORMAT_RULE).toContain('[bracketed placeholder]');
  });
});
