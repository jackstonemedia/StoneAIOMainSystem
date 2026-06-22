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
