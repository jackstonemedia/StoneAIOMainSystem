import type { Contact, SegmentRule } from '../types';

export function evaluateSegment(
  rules: SegmentRule[],
  conjunction: 'AND' | 'OR',
  contacts: Contact[]
): Contact[] {
  if (!rules || rules.length === 0) return contacts;

  return contacts.filter((contact) => {
    const matches = rules.map((rule) => {
      let fieldValue: any;
      if (rule.field.startsWith('customFields.')) {
        const customField = rule.field.split('.')[1];
        fieldValue = contact.customFields?.[customField];
      } else {
        fieldValue = (contact as any)[rule.field];
      }

      const val = String(fieldValue || '').toLowerCase();
      const target = String(rule.value || '').toLowerCase();

      switch (rule.operator) {
        case 'is':
          return val === target;
        case 'is_not':
          return val !== target;
        case 'contains':
          return val.includes(target);
        case 'not_contains':
          return !val.includes(target);
        case 'greater_than':
          return Number(val) > Number(target);
        case 'less_than':
          return Number(val) < Number(target);
        case 'is_empty':
          return !val;
        case 'is_not_empty':
          return !!val;
        case 'before':
          return new Date(val) < new Date(target);
        case 'after':
          return new Date(val) > new Date(target);
        default:
          return false;
      }
    });

    if (conjunction === 'AND') {
      return matches.every(Boolean);
    } else {
      return matches.some(Boolean);
    }
  });
}
