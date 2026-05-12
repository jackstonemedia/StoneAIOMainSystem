import { createAction, Property } from '@activepieces/pieces-framework';
import { stoneAIOAuth, callStoneAIOAPI } from '../common';

export const createLead = createAction({
  name: 'create_lead',
  displayName: 'Create Lead / Contact',
  description: 'Create a new lead or contact in Stone AIO CRM',
  auth: stoneAIOAuth,
  props: {
    firstName: Property.ShortText({
      displayName: 'First Name',
      required: true,
    }),
    lastName: Property.ShortText({
      displayName: 'Last Name',
      required: true,
    }),
    email: Property.ShortText({
      displayName: 'Email',
      required: false,
    }),
    phone: Property.ShortText({
      displayName: 'Phone',
      required: false,
    }),
    source: Property.StaticDropdown({
      displayName: 'Lead Source',
      required: false,
      options: {
        options: [
          { label: 'Web', value: 'web' },
          { label: 'Referral', value: 'referral' },
          { label: 'Social Media', value: 'social' },
          { label: 'Paid Ad', value: 'paid_ad' },
          { label: 'Cold Outreach', value: 'cold_outreach' },
          { label: 'Event', value: 'event' },
          { label: 'Other', value: 'other' },
        ],
      },
    }),
  },
  async run(context) {
    const { firstName, lastName, email, phone, source } = context.propsValue;
    const contact = await callStoneAIOAPI(
      context.auth,
      'POST',
      '/crm/contacts',
      {
        firstName,
        lastName,
        email,
        phone,
        source,
      }
    );
    return contact;
  },
});
