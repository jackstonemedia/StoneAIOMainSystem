import { describe, it, expect } from 'vitest';
import {
  FIREABLE_TRIGGER_TYPES,
  RUNNABLE_STEP_TYPES,
  defaultStepConfig,
  defaultTriggerConfig,
  configSummary,
} from '../automationCanvas';

describe('automationCanvas helpers (complete-platform item 1)', () => {
  it('does not offer triggers with no event source', () => {
    expect(FIREABLE_TRIGGER_TYPES).not.toContain('LIST_JOINED');
    expect(FIREABLE_TRIGGER_TYPES).not.toContain('API_EVENT');
    expect(FIREABLE_TRIGGER_TYPES).toContain('CONTACT_CREATED');
    expect(FIREABLE_TRIGGER_TYPES).toContain('FORM_SUBMITTED');
    expect(FIREABLE_TRIGGER_TYPES).toContain('DATE_BASED');
  });

  it('does not offer list steps with no membership store', () => {
    expect(RUNNABLE_STEP_TYPES).not.toContain('ADD_TO_LIST');
    expect(RUNNABLE_STEP_TYPES).not.toContain('REMOVE_FROM_LIST');
    expect(RUNNABLE_STEP_TYPES).toContain('SEND_EMAIL');
    expect(RUNNABLE_STEP_TYPES).toContain('WAIT');
    expect(RUNNABLE_STEP_TYPES).toContain('CONDITION_BRANCH');
  });

  it('defaults WAIT to 1 day', () => {
    expect(defaultStepConfig('WAIT')).toEqual({ amount: 1, unit: 'days' });
  });

  it('defaults SEND_EMAIL to empty subject/body', () => {
    expect(defaultStepConfig('SEND_EMAIL')).toEqual({ subject: '', body: '', fromName: '' });
  });

  it('defaults DATE_BASED to the birthday field', () => {
    expect(defaultTriggerConfig('DATE_BASED')).toEqual({ dateField: 'dateOfBirth' });
  });

  it('defaults TAG_ADDED to an empty tag', () => {
    expect(defaultTriggerConfig('TAG_ADDED')).toEqual({ tag: '' });
  });

  it('summarizes a configured WAIT step', () => {
    expect(configSummary('WAIT', { amount: 3, unit: 'days' })).toBe('Wait 3 days');
  });

  it('says plainly when a WAIT has no duration', () => {
    expect(configSummary('WAIT', {})).toBe('Wait — no duration yet');
  });

  it('summarizes a SEND_EMAIL step by subject', () => {
    expect(configSummary('SEND_EMAIL', { subject: 'Welcome!' })).toBe('Email: Welcome!');
    expect(configSummary('SEND_EMAIL', {})).toBe('Email — no subject yet');
  });

  it('summarizes a tag condition', () => {
    expect(configSummary('CONDITION_BRANCH', { field: 'tag', operator: 'contains', value: 'vip' })).toBe(
      'If tag contains “vip”',
    );
  });

  it('summarizes an exists condition without a value', () => {
    expect(configSummary('CONDITION_BRANCH', { field: 'email', operator: 'exists', value: '' })).toBe(
      'If email is set',
    );
  });

  it('summarizes ADD_TAG and webhook steps', () => {
    expect(configSummary('ADD_TAG', { tag: 'vip' })).toBe('Add tag “vip”');
    expect(configSummary('WEBHOOK_CALL', { url: 'https://example.com/hook', method: 'POST' })).toBe(
      'POST https://example.com/hook',
    );
  });
});
