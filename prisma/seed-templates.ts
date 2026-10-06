import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

const templates = [
  {
    id: 'tpl_welcome_email',
    name: 'New Contact Welcome Email',
    description: 'Automatically send a welcome email when a new contact is created.',
    category: 'CRM',
    tags: JSON.stringify(['email', 'onboarding', 'contacts']),
    isSystem: true,
    workspaceId: null,
    definitionJson: JSON.stringify({
      nodes: [
        {
          id: 'trigger_1',
          type: 'trigger.crm_event',
          data: { config: { event: 'contact.created' } },
          position: { x: 250, y: 50 }
        },
        {
          id: 'email_1',
          type: 'communication.send_email',
          data: { config: { to: '{{$trigger.data.email}}', subject: 'Welcome, {{$trigger.data.firstName}}!', body: '<p>Hi {{$trigger.data.firstName}},</p><p>Thank you for joining us. We\'re excited to have you!</p>', html: true } },
          position: { x: 250, y: 220 }
        }
      ],
      edges: [
        { id: 'e1', source: 'trigger_1', target: 'email_1', animated: true }
      ]
    })
  },
  {
    id: 'tpl_deal_won_notification',
    name: 'Deal Won Notification',
    description: 'Send an internal notification and SMS when a deal is marked as won.',
    category: 'CRM',
    tags: JSON.stringify(['deals', 'notification', 'sms']),
    isSystem: true,
    workspaceId: null,
    definitionJson: JSON.stringify({
      nodes: [
        {
          id: 'trigger_1',
          type: 'trigger.crm_event',
          data: { config: { event: 'deal.won' } },
          position: { x: 250, y: 50 }
        },
        {
          id: 'notif_1',
          type: 'notification.send_internal',
          data: { config: { title: '🎉 Deal Won!', body: 'Deal {{$trigger.data.title}} has been won.', type: 'success' } },
          position: { x: 100, y: 220 }
        },
        {
          id: 'sms_1',
          type: 'communication.send_sms',
          data: { config: { to: '{{$trigger.data.ownerPhone}}', body: 'Deal won: {{$trigger.data.title}} for ${{$trigger.data.amount}}' } },
          position: { x: 400, y: 220 }
        }
      ],
      edges: [
        { id: 'e1', source: 'trigger_1', target: 'notif_1', animated: true },
        { id: 'e2', source: 'trigger_1', target: 'sms_1', animated: true }
      ]
    })
  },
  {
    id: 'tpl_appointment_reminder',
    name: 'Appointment Reminder SMS',
    description: 'Send an SMS reminder after an appointment is booked.',
    category: 'Appointments',
    tags: JSON.stringify(['appointments', 'sms', 'reminder']),
    isSystem: true,
    workspaceId: null,
    definitionJson: JSON.stringify({
      nodes: [
        {
          id: 'trigger_1',
          type: 'trigger.crm_event',
          data: { config: { event: 'appointment.booked' } },
          position: { x: 250, y: 50 }
        },
        {
          id: 'sms_1',
          type: 'communication.send_sms',
          data: { config: { to: '{{$trigger.data.contactPhone}}', body: 'Your appointment is confirmed for {{$trigger.data.scheduledAt}}. Reply STOP to cancel.' } },
          position: { x: 250, y: 220 }
        }
      ],
      edges: [
        { id: 'e1', source: 'trigger_1', target: 'sms_1', animated: true }
      ]
    })
  },
  {
    id: 'tpl_form_followup',
    name: 'Form Submission Follow-up',
    description: 'Create a contact and send a follow-up email when a form is submitted.',
    category: 'Marketing',
    tags: JSON.stringify(['forms', 'email', 'contacts']),
    isSystem: true,
    workspaceId: null,
    definitionJson: JSON.stringify({
      nodes: [
        {
          id: 'trigger_1',
          type: 'trigger.crm_event',
          data: { config: { event: 'form.submitted' } },
          position: { x: 250, y: 50 }
        },
        {
          id: 'contact_1',
          type: 'crm.create_contact',
          data: { config: { email: '{{$trigger.data.data.email}}', firstName: '{{$trigger.data.data.firstName}}' } },
          position: { x: 250, y: 220 }
        },
        {
          id: 'email_1',
          type: 'communication.send_email',
          data: { config: { to: '{{$trigger.data.data.email}}', subject: 'Thanks for reaching out!', body: '<p>We received your submission and will be in touch soon.</p>', html: true } },
          position: { x: 250, y: 390 }
        }
      ],
      edges: [
        { id: 'e1', source: 'trigger_1', target: 'contact_1', animated: true },
        { id: 'e2', source: 'contact_1', target: 'email_1', animated: true }
      ]
    })
  },
  {
    id: 'tpl_review_alert',
    name: 'New Review Alert',
    description: 'Get an internal notification whenever a new review is received.',
    category: 'Reputation',
    tags: JSON.stringify(['reviews', 'notification']),
    isSystem: true,
    workspaceId: null,
    definitionJson: JSON.stringify({
      nodes: [
        {
          id: 'trigger_1',
          type: 'trigger.crm_event',
          data: { config: { event: 'review.received' } },
          position: { x: 250, y: 50 }
        },
        {
          id: 'notif_1',
          type: 'notification.send_internal',
          data: { config: { title: '⭐ New Review ({{$trigger.data.rating}}/5)', body: '{{$trigger.data.reviewerName}}: {{$trigger.data.body}}', type: 'info' } },
          position: { x: 250, y: 220 }
        }
      ],
      edges: [
        { id: 'e1', source: 'trigger_1', target: 'notif_1', animated: true }
      ]
    })
  },
  {
    id: 'tpl_weekly_task_reminder',
    name: 'Weekly Task Reminder',
    description: 'Send an internal notification every Monday at 9am.',
    category: 'Scheduling',
    tags: JSON.stringify(['schedule', 'notification', 'tasks']),
    isSystem: true,
    workspaceId: null,
    definitionJson: JSON.stringify({
      nodes: [
        {
          id: 'trigger_1',
          type: 'trigger.schedule',
          data: { config: { cronExpression: '0 9 * * 1', timezone: 'America/New_York' } },
          position: { x: 250, y: 50 }
        },
        {
          id: 'notif_1',
          type: 'notification.send_internal',
          data: { config: { title: '📋 Weekly Tasks Reminder', body: "It's Monday — review your open tasks and plan for the week.", type: 'info' } },
          position: { x: 250, y: 220 }
        }
      ],
      edges: [
        { id: 'e1', source: 'trigger_1', target: 'notif_1', animated: true }
      ]
    })
  },
  {
    id: 'tpl_deal_stale_alert',
    name: 'Deal Stale Alert',
    description: 'Daily check that sends an internal notification for workflows needing attention.',
    category: 'CRM',
    tags: JSON.stringify(['schedule', 'deals', 'notification']),
    isSystem: true,
    workspaceId: null,
    definitionJson: JSON.stringify({
      nodes: [
        {
          id: 'trigger_1',
          type: 'trigger.schedule',
          data: { config: { cronExpression: '0 8 * * *', timezone: 'America/New_York' } },
          position: { x: 250, y: 50 }
        },
        {
          id: 'notif_1',
          type: 'notification.send_internal',
          data: { config: { title: '⚠️ Daily Deal Review', body: 'Check your pipeline for stale deals that need follow-up.', type: 'warning' } },
          position: { x: 250, y: 220 }
        }
      ],
      edges: [
        { id: 'e1', source: 'trigger_1', target: 'notif_1', animated: true }
      ]
    })
  },
  {
    id: 'tpl_webhook_to_sms',
    name: 'Inbound Webhook to SMS',
    description: 'Send an SMS to a phone number from an external webhook POST.',
    category: 'Integration',
    tags: JSON.stringify(['webhook', 'sms', 'integration']),
    isSystem: true,
    workspaceId: null,
    definitionJson: JSON.stringify({
      nodes: [
        {
          id: 'trigger_1',
          type: 'trigger.webhook',
          data: { config: { method: 'POST' } },
          position: { x: 250, y: 50 }
        },
        {
          id: 'sms_1',
          type: 'communication.send_sms',
          data: { config: { to: '{{$trigger.body.phone}}', body: '{{$trigger.body.message}}' } },
          position: { x: 250, y: 220 }
        }
      ],
      edges: [
        { id: 'e1', source: 'trigger_1', target: 'sms_1', animated: true }
      ]
    })
  },
  {
    id: 'tpl_cold_outreach_3step',
    name: '3-Step Cold Outreach Sequence',
    description: 'Automated 3-touch sequence with intelligent delay spacing (Day 1, Day 4, Day 8) and stop-on-reply protection.',
    category: 'Marketing',
    tags: JSON.stringify(['outreach', 'email', 'cold-email', 'sales', 'sequences']),
    isSystem: true,
    workspaceId: null,
    definitionJson: JSON.stringify({
      nodes: [
        {
          id: 'trigger_1',
          type: 'trigger.crm_event',
          data: { config: { event: 'contact.created' } },
          position: { x: 250, y: 50 }
        },
        {
          id: 'email_1',
          type: 'communication.send_email',
          data: { config: { to: '{{$trigger.data.email}}', subject: 'Quick question for {{$trigger.data.firstName}}', body: '<p>Hi {{$trigger.data.firstName}},</p><p>Noticed what your team has been doing recently and wanted to reach out directly.</p><p>Are you currently open to exploring ways to increase pipeline velocity this quarter?</p><p>Best regards,<br/>Stone AIO</p>', html: true } },
          position: { x: 250, y: 190 }
        },
        {
          id: 'wait_1',
          type: 'logic.wait',
          data: { config: { waitAmount: 3, waitUnit: 'days' } },
          position: { x: 250, y: 330 }
        },
        {
          id: 'email_2',
          type: 'communication.send_email',
          data: { config: { to: '{{$trigger.data.email}}', subject: 'Re: Quick question for {{$trigger.data.firstName}}', body: '<p>Hi {{$trigger.data.firstName}},</p><p>Wanted to follow up on my note from a few days ago in case it got buried.</p><p>We helped similar companies streamline their outreach and save 15+ hours weekly.</p><p>Would you have 10 minutes for a brief chat this week?</p>', html: true } },
          position: { x: 250, y: 470 }
        },
        {
          id: 'wait_2',
          type: 'logic.wait',
          data: { config: { waitAmount: 4, waitUnit: 'days' } },
          position: { x: 250, y: 610 }
        },
        {
          id: 'email_3',
          type: 'communication.send_email',
          data: { config: { to: '{{$trigger.data.email}}', subject: 'Final note / permission to close file', body: '<p>Hi {{$trigger.data.firstName}},</p><p>I know you are busy, so I will assume the timing is not right at the moment.</p><p>Feel free to reach back out anytime if priorities shift down the road.</p>', html: true } },
          position: { x: 250, y: 750 }
        },
        {
          id: 'tag_1',
          type: 'crm.add_tag',
          data: { config: { entityType: 'contact', entityId: '{{$trigger.data.id}}', tag: 'cold-outreach-completed' } },
          position: { x: 250, y: 890 }
        }
      ],
      edges: [
        { id: 'e1', source: 'trigger_1', target: 'email_1', animated: true },
        { id: 'e2', source: 'email_1', target: 'wait_1', animated: true },
        { id: 'e3', source: 'wait_1', target: 'email_2', animated: true },
        { id: 'e4', source: 'email_2', target: 'wait_2', animated: true },
        { id: 'e5', source: 'wait_2', target: 'email_3', animated: true },
        { id: 'e6', source: 'email_3', target: 'tag_1', animated: true }
      ]
    })
  },
  {
    id: 'tpl_lead_magnet_nurture',
    name: 'Lead Magnet Follow-Up & Call Booking',
    description: 'Instant resource delivery on form submission followed by a multi-day nurture and calendar booking link invitation.',
    category: 'Marketing',
    tags: JSON.stringify(['lead-magnet', 'nurture', 'calendar', 'email']),
    isSystem: true,
    workspaceId: null,
    definitionJson: JSON.stringify({
      nodes: [
        {
          id: 'trigger_1',
          type: 'trigger.crm_event',
          data: { config: { event: 'form.submitted' } },
          position: { x: 250, y: 50 }
        },
        {
          id: 'contact_1',
          type: 'crm.create_contact',
          data: { config: { email: '{{$trigger.data.data.email}}', firstName: '{{$trigger.data.data.firstName}}' } },
          position: { x: 250, y: 190 }
        },
        {
          id: 'email_1',
          type: 'communication.send_email',
          data: { config: { to: '{{$trigger.data.data.email}}', subject: 'Here is your requested guide, {{$trigger.data.data.firstName}}!', body: '<p>Hi {{$trigger.data.data.firstName}},</p><p>Thank you for requesting our guide. You can access the resource immediately using the link below:</p><p><a href="https://stoneaio.com/resources" style="color: #2563eb; font-weight: bold;">Download Your Guide &rarr;</a></p><p>Let us know if you have any questions!</p>', html: true } },
          position: { x: 250, y: 330 }
        },
        {
          id: 'wait_1',
          type: 'logic.wait',
          data: { config: { waitAmount: 2, waitUnit: 'days' } },
          position: { x: 250, y: 470 }
        },
        {
          id: 'email_2',
          type: 'communication.send_email',
          data: { config: { to: '{{$trigger.data.data.email}}', subject: 'Did you have a chance to look over the guide?', body: '<p>Hi {{$trigger.data.data.firstName}},</p><p>Just checking in to see if you had a chance to look through the guide and if anything sparked ideas for your business.</p><p>If you would like to walk through a tailored strategy together, you can pick a convenient time on my calendar here:</p><p><a href="/book/default" style="display:inline-block;padding:10px 18px;background:#2563eb;color:#ffffff;border-radius:6px;text-decoration:none;font-weight:600;">Book a 15-Minute Strategy Session</a></p>', html: true } },
          position: { x: 250, y: 610 }
        }
      ],
      edges: [
        { id: 'e1', source: 'trigger_1', target: 'contact_1', animated: true },
        { id: 'e2', source: 'contact_1', target: 'email_1', animated: true },
        { id: 'e3', source: 'email_1', target: 'wait_1', animated: true },
        { id: 'e4', source: 'wait_1', target: 'email_2', animated: true }
      ]
    })
  },
  {
    id: 'tpl_stop_on_reply_outreach',
    name: 'Stop-on-Reply Cold Outreach & Hot Lead Alert',
    description: 'Paced outbound sequence that automatically halts on reply and notifies your sales team immediately when a lead responds.',
    category: 'CRM',
    tags: JSON.stringify(['outreach', 'stop-on-reply', 'sales-alert', 'hot-lead']),
    isSystem: true,
    workspaceId: null,
    definitionJson: JSON.stringify({
      nodes: [
        {
          id: 'trigger_1',
          type: 'trigger.crm_event',
          data: { config: { event: 'contact.created' } },
          position: { x: 250, y: 50 }
        },
        {
          id: 'email_1',
          type: 'communication.send_email',
          data: { config: { to: '{{$trigger.data.email}}', subject: 'Introduction & quick question', body: '<p>Hi {{$trigger.data.firstName}},</p><p>Wanted to connect and share how we are helping businesses in your space automate lead engagement.</p><p>Are you open to seeing a 2-minute demo?</p>', html: true } },
          position: { x: 250, y: 190 }
        },
        {
          id: 'wait_1',
          type: 'logic.wait',
          data: { config: { waitAmount: 3, waitUnit: 'days' } },
          position: { x: 250, y: 330 }
        },
        {
          id: 'email_2',
          type: 'communication.send_email',
          data: { config: { to: '{{$trigger.data.email}}', subject: 'Quick follow-up for {{$trigger.data.firstName}}', body: '<p>Hi {{$trigger.data.firstName}},</p><p>Following up on my message. Happy to send over some recent benchmark results if helpful.</p>', html: true } },
          position: { x: 250, y: 470 }
        },
        {
          id: 'wait_2',
          type: 'logic.wait',
          data: { config: { waitAmount: 4, waitUnit: 'days' } },
          position: { x: 250, y: 610 }
        },
        {
          id: 'notif_1',
          type: 'notification.send_internal',
          data: { config: { title: 'Sequence Completed for Contact', body: 'Contact {{$trigger.data.email}} completed sequence without reply.', type: 'info' } },
          position: { x: 250, y: 750 }
        }
      ],
      edges: [
        { id: 'e1', source: 'trigger_1', target: 'email_1', animated: true },
        { id: 'e2', source: 'email_1', target: 'wait_1', animated: true },
        { id: 'e3', source: 'wait_1', target: 'email_2', animated: true },
        { id: 'e4', source: 'email_2', target: 'wait_2', animated: true },
        { id: 'e5', source: 'wait_2', target: 'notif_1', animated: true }
      ]
    })
  }
];

async function main() {
  console.log('Seeding workflow templates...');
  for (const tpl of templates) {
    await db.workflowTemplate.upsert({
      where: { id: tpl.id },
      update: tpl,
      create: tpl,
    });
    console.log(`  ✓ ${tpl.name}`);
  }
  console.log('Done.');
}

main().catch(console.error).finally(() => db.$disconnect());
