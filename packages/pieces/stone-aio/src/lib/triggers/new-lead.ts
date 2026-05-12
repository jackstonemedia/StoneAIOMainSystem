import { createTrigger, TriggerStrategy, Property } from '@activepieces/pieces-framework';
import { stoneAIOAuth, callStoneAIOAPI } from '../common';

export const newLeadTrigger = createTrigger({
  name: 'new_lead',
  displayName: 'New Lead Created',
  description: 'Triggers when a new contact/lead is created in Stone AIO',
  auth: stoneAIOAuth,
  type: TriggerStrategy.POLLING,
  props: {
    source: Property.StaticDropdown({
      displayName: 'Filter by Source (optional)',
      required: false,
      options: {
        options: [
          { label: 'Any Source', value: '' },
          { label: 'Web', value: 'web' },
          { label: 'Referral', value: 'referral' },
        ],
      },
    }),
  },
  sampleData: {
    id: 'contact_123',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    source: 'web',
    createdAt: new Date().toISOString(),
  },
  async onEnable(context) {
    await context.store.put('lastPollTime', new Date().toISOString());
  },
  async onDisable() {},
  async run(context) {
    const lastPollTime = await context.store.get<string>('lastPollTime') ?? new Date(0).toISOString();
    const now = new Date().toISOString();

    // In a real implementation this would fetch from /crm/contacts?createdAfter=...
    // We are mocking the API call for demonstration of the piece structure
    const contacts: any[] = []; 

    await context.store.put('lastPollTime', now);

    const filtered = (context.propsValue.source)
      ? contacts.filter((c: any) => c.source === context.propsValue.source)
      : contacts;

    return filtered;
  },
});
