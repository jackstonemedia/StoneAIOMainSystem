/**
 * Pure helpers for the Automation canvas config (complete-platform item 1).
 * Kept pure so they are unit-testable without rendering the canvas.
 *
 * Two honest trims live here, with the reason recorded next to each:
 * - LIST_JOINED / API_EVENT are not offered as triggers: Segments are
 *   filter-based (no membership store to "join"), and there is no inbound
 *   API endpoint for automation events. Offering them would let a business
 *   build an automation that can never fire.
 * - ADD_TO_LIST / REMOVE_FROM_LIST are not offered as steps: there is no
 *   List model (only filter-based Segments), so there is nothing to add a
 *   contact to. The runner has no honest implementation for them.
 */

export const FIREABLE_TRIGGER_TYPES = [
  'CONTACT_CREATED',
  'TAG_ADDED',
  'TAG_REMOVED',
  'FORM_SUBMITTED',
  'DEAL_STAGE_CHANGED',
  'CUSTOM_FIELD_CHANGED',
  'DATE_BASED',
  'EMAIL_OPENED',
  'EMAIL_LINK_CLICKED',
  'MANUAL_ENROLLMENT',
] as const;

export const RUNNABLE_STEP_TYPES = [
  'SEND_EMAIL',
  'WAIT',
  'CONDITION_BRANCH',
  'ADD_TAG',
  'REMOVE_TAG',
  'UPDATE_FIELD',
  'WEBHOOK_CALL',
  'GOAL_CHECK',
  'EXIT_AUTOMATION',
] as const;

export const CONDITION_FIELDS: { value: string; label: string }[] = [
  { value: 'tag', label: 'Has tag' },
  { value: 'email', label: 'Email' },
  { value: 'firstName', label: 'First name' },
  { value: 'phone', label: 'Phone' },
  { value: 'status', label: 'Status' },
  { value: 'source', label: 'Source' },
  { value: 'company', label: 'Company' },
  { value: 'dealStage', label: 'Deal stage' },
  { value: 'customField', label: 'Custom field' },
];

export const CONDITION_OPERATORS: { value: string; label: string }[] = [
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'does not equal' },
  { value: 'exists', label: 'is set' },
  { value: 'not_exists', label: 'is not set' },
];

export const UPDATE_FIELDS: { value: string; label: string }[] = [
  { value: 'firstName', label: 'First name' },
  { value: 'lastName', label: 'Last name' },
  { value: 'phone', label: 'Phone' },
  { value: 'location', label: 'Location' },
  { value: 'title', label: 'Title' },
  { value: 'status', label: 'Status' },
  { value: 'source', label: 'Source' },
  { value: 'about', label: 'About' },
  { value: 'customField', label: 'Custom field' },
];

export const WAIT_UNITS = ['seconds', 'minutes', 'hours', 'days'] as const;

export function defaultStepConfig(stepType: string): Record<string, unknown> {
  switch (stepType) {
    case 'SEND_EMAIL':
      return { subject: '', body: '', fromName: '' };
    case 'WAIT':
      return { amount: 1, unit: 'days' };
    case 'CONDITION_BRANCH':
      return { field: 'tag', operator: 'contains', value: '', customFieldName: '' };
    case 'ADD_TAG':
      return { tag: '' };
    case 'REMOVE_TAG':
      return { tag: '' };
    case 'UPDATE_FIELD':
      return { field: 'firstName', value: '', customFieldName: '' };
    case 'WEBHOOK_CALL':
      return { url: '', method: 'POST' };
    case 'GOAL_CHECK':
      return { field: 'tag', operator: 'contains', value: '', customFieldName: '' };
    case 'EXIT_AUTOMATION':
      return {};
    default:
      return {};
  }
}

export function defaultTriggerConfig(triggerType: string): Record<string, unknown> {
  switch (triggerType) {
    case 'TAG_ADDED':
    case 'TAG_REMOVED':
      return { tag: '' };
    case 'DEAL_STAGE_CHANGED':
      return { stageId: '' };
    case 'EMAIL_OPENED':
    case 'EMAIL_LINK_CLICKED':
      return { campaignId: '' };
    case 'DATE_BASED':
      return { dateField: 'dateOfBirth' };
    case 'FORM_SUBMITTED':
      return { pageId: '' };
    case 'CUSTOM_FIELD_CHANGED':
      return { field: '' };
    default:
      return {};
  }
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** One-line summary of a step's config, shown on the canvas node. '' when unset. */
export function configSummary(stepType: string, config: Record<string, unknown> | undefined): string {
  if (!config) return '';
  switch (stepType) {
    case 'SEND_EMAIL': {
      const s = str(config.subject);
      return s ? `Email: ${s}` : 'Email — no subject yet';
    }
    case 'WAIT': {
      const a = num(config.amount);
      const u = str(config.unit) || 'days';
      return a !== null ? `Wait ${a} ${u}` : 'Wait — no duration yet';
    }
    case 'CONDITION_BRANCH':
    case 'GOAL_CHECK': {
      const field = str(config.field) || 'tag';
      const op = str(config.operator) || 'contains';
      const value = str(config.value);
      const shown = field === 'customField' ? `custom field “${str(config.customFieldName) || '?' }”` : field;
      const verb = stepType === 'GOAL_CHECK' ? 'Goal: ' : 'If ';
      if (op === 'exists' || op === 'not_exists') return `${verb}${shown} ${op === 'exists' ? 'is set' : 'is not set'}`;
      return value ? `${verb}${shown} ${op} “${value}”` : `${verb}${shown} ${op} — no value yet`;
    }
    case 'ADD_TAG': {
      const t = str(config.tag);
      return t ? `Add tag “${t}”` : 'Add tag — no tag yet';
    }
    case 'REMOVE_TAG': {
      const t = str(config.tag);
      return t ? `Remove tag “${t}”` : 'Remove tag — no tag yet';
    }
    case 'UPDATE_FIELD': {
      const field = str(config.field) || 'firstName';
      const shown = field === 'customField' ? `custom field “${str(config.customFieldName) || '?' }”` : field;
      const value = str(config.value);
      return value ? `Set ${shown} = “${value}”` : `Set ${shown} — no value yet`;
    }
    case 'WEBHOOK_CALL': {
      const u = str(config.url);
      return u ? `${str(config.method) || 'POST'} ${u}` : 'Webhook — no URL yet';
    }
    case 'EXIT_AUTOMATION':
      return 'Exit';
    default:
      return '';
  }
}
