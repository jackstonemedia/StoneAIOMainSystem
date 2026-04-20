import 'dotenv/config';
import express from 'express';
import { z } from 'zod';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import workflowAiRouter from './api/workflow-ai.js';
import chatRouter from './api/chat.js';
import agentsRouter from './api/agents.js';
import voiceAgentsRouter from './api/voice-agents.js';
import crmActionsRouter from './api/crm-actions.js';
import integrationsRouter from './api/integrations.js';
import { db } from './src/lib/db.js';

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT WORKSPACE ID (dev) — matches the seed script
// ─────────────────────────────────────────────────────────────────────────────
const DEV_WORKSPACE_ID = 'ws_default_stone_aio';

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA — used as fallback when DB is unavailable
// ─────────────────────────────────────────────────────────────────────────────
const mockDB = {
  contacts: [
    { id: 'ct_alice', firstName: 'Alice',  lastName: 'Freeman', name: 'Alice Freeman',  email: 'alice@acmecorp.com',  phone: '+1 (555) 123-4567', businessName: 'Acme Corp',     leadScore: 98, status: 'hot',     tagsJson: '["enterprise","vip"]', color: '#7dd3fc', createdAt: new Date(Date.now()-2*86400000).toISOString() },
    { id: 'ct_bob',   firstName: 'Bob',    lastName: 'Smith',   name: 'Bob Smith',      email: 'bob@techstart.io',   phone: '+1 (555) 987-6543', businessName: 'TechStart',     leadScore: 74, status: 'warm',    tagsJson: '["smb"]',              color: '#c4b5fd', createdAt: new Date(Date.now()-5*86400000).toISOString() },
    { id: 'ct_carol', firstName: 'Carol',  lastName: 'Nguyen',  name: 'Carol Nguyen',   email: 'carol@globalsol.com', phone: '+1 (555) 234-5678', businessName: 'Global Sol.',   leadScore: 92, status: 'hot',     tagsJson: '["enterprise","ceo"]', color: '#86efac', createdAt: new Date(Date.now()-1*86400000).toISOString() },
    { id: 'ct_david', firstName: 'David',  lastName: 'Park',    name: 'David Park',     email: 'david@nexusllc.com', phone: '+1 (555) 345-6789', businessName: 'Nexus LLC',     leadScore: 61, status: 'warm',    tagsJson: '["mid-market"]',       color: '#fde68a', createdAt: new Date(Date.now()-3*86400000).toISOString() },
    { id: 'ct_elena', firstName: 'Elena',  lastName: 'Torres',  name: 'Elena Torres',   email: 'elena@brightco.com', phone: '+1 (555) 456-7890', businessName: 'BrightCo',      leadScore: 55, status: 'neutral', tagsJson: '["marketing"]',        color: '#93c5fd', createdAt: new Date(Date.now()-14*86400000).toISOString() },
    { id: 'ct_frank', firstName: 'Frank',  lastName: 'Muller',  name: 'Frank Muller',   email: 'frank@apex.com',      phone: '+1 (555) 567-8901', businessName: 'Apex Systems',  leadScore: 88, status: 'hot',     tagsJson: '["enterprise","cto"]', color: '#d1d5db', createdAt: new Date(Date.now()-1*86400000).toISOString() },
  ],
  companies: [
    { id: 'co_acme',     name: 'Acme Corp',        website: 'acmecorp.com',  industry: 'Manufacturing', location: 'San Francisco, CA', employees: '1,000-5,000', revenue: '$100M-$500M' },
    { id: 'co_techstart',name: 'TechStart',         website: 'techstart.io', industry: 'Software',      location: 'Austin, TX',        employees: '50-200',      revenue: '$10M-$50M' },
    { id: 'co_global',   name: 'Global Solutions',  website: 'globalsol.com', industry: 'Consulting',   location: 'Chicago, IL',       employees: '500-1,000',   revenue: '$50M-$100M' },
    { id: 'co_nexus',    name: 'Nexus LLC',         website: 'nexusllc.com', industry: 'Logistics',     location: 'Seattle, WA',       employees: '200-500',     revenue: '$20M-$50M' },
    { id: 'co_bright',   name: 'BrightCo',          website: 'brightco.com', industry: 'Marketing',     location: 'Miami, FL',         employees: '10-50',       revenue: '$1M-$5M' },
  ],
  deals: [
    { id: 'dl_1', title: 'Q3 Enterprise License',   amount: 120000, priority: 'high',   probability: 60,  pipelineStage: { name: 'Proposal' },    company: { name: 'Acme Corp' },    contactId: 'ct_alice', closeDate: '2026-09-30' },
    { id: 'dl_2', title: 'Infrastructure Upgrade',  amount:  45000, priority: 'medium', probability: 30,  pipelineStage: { name: 'Qualified' },   company: { name: 'TechStart' },    contactId: 'ct_bob',   closeDate: '2026-10-15' },
    { id: 'dl_3', title: 'Marketing Automation',    amount:  28000, priority: 'high',   probability: 75,  pipelineStage: { name: 'Negotiation' }, company: { name: 'BrightCo' },     contactId: 'ct_elena', closeDate: '2026-08-31' },
    { id: 'dl_4', title: 'Consulting Retainer',     amount:  72000, priority: 'high',   probability: 100, pipelineStage: { name: 'Won' },         company: { name: 'Global Sol.' },  contactId: 'ct_carol', closeDate: '2026-07-01' },
    { id: 'dl_5', title: 'Logistics Platform',      amount:  95000, priority: 'low',    probability: 15,  pipelineStage: { name: 'Lead' },        company: { name: 'Nexus LLC' },    contactId: 'ct_david', closeDate: '2026-11-30' },
    { id: 'dl_7', title: 'Enterprise Expansion',    amount: 240000, priority: 'high',   probability: 55,  pipelineStage: { name: 'Proposal' },    company: { name: 'Acme Corp' },    contactId: 'ct_frank', closeDate: '2026-10-01' },
    { id: 'dl_8', title: 'SMB Starter Pack',        amount:   8400, priority: 'low',    probability: 100, pipelineStage: { name: 'Won' },         company: { name: 'BrightCo' },     contactId: 'ct_elena', closeDate: '2026-06-15' },
  ],
  pipelines: [
    { id: 'pl_standard', name: 'Standard Sales', isDefault: true, stages: [
      { id: 'ps_lead',        name: 'Lead',        color: '#64748b', order: 0, probability: 10  },
      { id: 'ps_qualified',   name: 'Qualified',   color: '#818cf8', order: 1, probability: 30  },
      { id: 'ps_proposal',    name: 'Proposal',    color: '#fbbf24', order: 2, probability: 60  },
      { id: 'ps_negotiation', name: 'Negotiation', color: '#a78bfa', order: 3, probability: 80  },
      { id: 'ps_won',         name: 'Won',         color: '#34d399', order: 4, probability: 100 },
      { id: 'ps_lost',        name: 'Lost',        color: '#ef4444', order: 5, probability: 0   },
    ]}
  ],
  tasks: [
    { id: 'tk_1', contactId: 'ct_alice', title: 'Follow up on enterprise proposal', type: 'follow_up', priority: 'high',   status: 'pending', dueDate: new Date().toISOString() },
    { id: 'tk_2', contactId: 'ct_bob',   title: 'Send revised contract',            type: 'email',     priority: 'high',   status: 'overdue', dueDate: new Date(Date.now()-86400000).toISOString() },
    { id: 'tk_3', contactId: 'ct_carol', title: 'Initial discovery call',           type: 'call',      priority: 'medium', status: 'pending', dueDate: new Date(Date.now()+86400000).toISOString() },
  ],
  activities: [
    { id: 'ac_1', type: 'email',   title: 'Sent Q3 proposal email',        contactId: 'ct_alice', target: 'Alice Freeman',  date: new Date(Date.now()-2*3600000).toISOString(),   createdAt: new Date(Date.now()-2*3600000).toISOString() },
    { id: 'ac_2', type: 'call',    title: 'Discovery call completed',       contactId: 'ct_bob',   target: 'Bob Smith',      date: new Date(Date.now()-5*3600000).toISOString(),   createdAt: new Date(Date.now()-5*3600000).toISOString() },
    { id: 'ac_3', type: 'meeting', title: 'Product demo — Enterprise tier', contactId: 'ct_carol', target: 'Carol Nguyen',   date: new Date(Date.now()-86400000).toISOString(),    createdAt: new Date(Date.now()-86400000).toISOString() },
    { id: 'ac_4', type: 'note',    title: 'Added follow-up note',           contactId: 'ct_david', target: 'David Park',     date: new Date(Date.now()-2*86400000).toISOString(),  createdAt: new Date(Date.now()-2*86400000).toISOString() },
    { id: 'ac_5', type: 'call',    title: 'Negotiation call',               contactId: 'ct_elena', target: 'Elena Torres',   date: new Date(Date.now()-3*86400000).toISOString(),  createdAt: new Date(Date.now()-3*86400000).toISOString() },
  ],
  campaigns: [
    { id: 'cm_1', name: 'Black Friday VIP Early Access',   type: 'email', status: 'sent',      audienceJson: '{"count":14500}', metricsJson: '{"openRate":42.5,"clickRate":18.2}', updatedAt: new Date(Date.now()-2*86400000).toISOString() },
    { id: 'cm_2', name: 'Abandoned Cart Recovery Series', type: 'email', status: 'sending',   audienceJson: '{"count":320}',   metricsJson: '{"openRate":0,"clickRate":0}',       updatedAt: new Date(Date.now()-3600000).toISOString() },
    { id: 'cm_3', name: 'Flash Sale SMS Blast',            type: 'sms',   status: 'scheduled', audienceJson: '{"count":5800}',  metricsJson: '{"openRate":0,"clickRate":0}',       updatedAt: new Date(Date.now()-4*3600000).toISOString() },
    { id: 'cm_4', name: 'Q4 Product Update Newsletter',    type: 'email', status: 'draft',     audienceJson: '{"count":22000}', metricsJson: '{"openRate":0,"clickRate":0}',       updatedAt: new Date(Date.now()-30*60000).toISOString() },
  ],
  forms: [
    { id: 'fm_1', name: 'Contact Us',              schema: '[]', visits: 1240, submissions: Array(9).fill({}),   updatedAt: new Date(Date.now()-86400000).toISOString() },
    { id: 'fm_2', name: 'Lead Magnet Download',    schema: '[]', visits: 3820, submissions: Array(438).fill({}), updatedAt: new Date(Date.now()-3*86400000).toISOString() },
    { id: 'fm_3', name: 'Event RSVP — Q4 Summit', schema: '[]', visits: 890,  submissions: Array(124).fill({}), updatedAt: new Date(Date.now()-7*86400000).toISOString() },
  ],
  reviews: [
    { id: 'rv_1', author: 'Sarah Mitchell',  rating: 5, source: 'google',   text: 'Absolutely outstanding platform. The automation features have saved our team 20hrs/week.', date: new Date(Date.now()-86400000).toISOString(),    replied: false },
    { id: 'rv_2', author: 'James OBrien',    rating: 4, source: 'google',   text: 'Very impressed with the CRM features. The pipeline view is intuitive and the reporting is solid.', date: new Date(Date.now()-3*86400000).toISOString(),  replied: true },
    { id: 'rv_3', author: 'Priya Sharma',    rating: 5, source: 'facebook', text: 'Made the switch from GoHighLevel and never looked back. The AI assistant alone is worth the price.', date: new Date(Date.now()-5*86400000).toISOString(),  replied: false },
    { id: 'rv_4', author: 'Marcus Webb',     rating: 2, source: 'yelp',     text: 'Had some connectivity issues during onboarding. Support was helpful but took 2 days to resolve.', date: new Date(Date.now()-7*86400000).toISOString(),  replied: true },
    { id: 'rv_5', author: 'Lisa Tanaka',     rating: 5, source: 'google',   text: 'The campaign builder is incredible. Open rates jumped from 18% to 38% after switching.', date: new Date(Date.now()-10*86400000).toISOString(), replied: false },
    { id: 'rv_6', author: 'Derek Johnson',   rating: 4, source: 'google',   text: 'Solid enterprise tool. Integration with Twilio works flawlessly.', date: new Date(Date.now()-12*86400000).toISOString(), replied: true },
    { id: 'rv_7', author: 'Amanda Foster',   rating: 1, source: 'yelp',     text: 'Initial setup was confusing and documentation is lacking.', date: new Date(Date.now()-14*86400000).toISOString(), replied: false },
    { id: 'rv_8', author: 'Chris Reynolds',  rating: 5, source: 'facebook', text: 'Best investment we made this year. The AI deal scoring alone increased our close rate by 22%.', date: new Date(Date.now()-18*86400000).toISOString(), replied: false },
  ],
  appointments: (() => {
    const now = new Date();
    return [0,1,2,3,4].flatMap(d => {
      const day = new Date(now); day.setDate(day.getDate() - day.getDay() + 1 + d);
      return [
        { id: `apt-${d}-1`, title: 'Discovery Call', type: 'call',    status: 'scheduled', startTime: new Date(new Date(day).setHours(10,0,0,0)).toISOString(), endTime: new Date(new Date(day).setHours(11,0,0,0)).toISOString(), contact: { name: 'Alice Freeman' }, location: 'Zoom' },
        { id: `apt-${d}-2`, title: 'Product Demo',   type: 'meeting', status: 'scheduled', startTime: new Date(new Date(day).setHours(14,0,0,0)).toISOString(), endTime: new Date(new Date(day).setHours(15,0,0,0)).toISOString(), contact: { name: 'Bob Smith' },    location: 'Google Meet' },
      ];
    });
  })(),
  conversations: [
    { id: 'c1', channel: 'email', status: 'open',   updatedAt: new Date(Date.now()-5*60000).toISOString(),    unreadCount: 2, contact: { name: 'Alice Freeman', email: 'alice@acmecorp.com', id: 'ct_alice' } },
    { id: 'c2', channel: 'sms',   status: 'open',   updatedAt: new Date(Date.now()-25*60000).toISOString(),   unreadCount: 1, contact: { name: 'Bob Smith',    email: 'bob@techstart.io',   id: 'ct_bob'   } },
    { id: 'c3', channel: 'chat',  status: 'closed', updatedAt: new Date(Date.now()-2*3600000).toISOString(), unreadCount: 0, contact: { name: 'Carol Nguyen', email: 'carol@globalsol.com', id: 'ct_carol' } },
    { id: 'c4', channel: 'email', status: 'open',   updatedAt: new Date(Date.now()-3*3600000).toISOString(), unreadCount: 3, contact: { name: 'David Park',   email: 'david@nexusllc.com',  id: 'ct_david' } },
    { id: 'c5', channel: 'sms',   status: 'open',   updatedAt: new Date(Date.now()-86400000).toISOString(),  unreadCount: 0, contact: { name: 'Elena Torres', email: 'elena@brightco.com',  id: 'ct_elena' } },
  ],
  messages: {
    'c1': [
      { id: 'm1', body: 'Hi! I wanted to follow up on the proposal you sent last week.', direction: 'inbound',  createdAt: new Date(Date.now()-2*3600000).toISOString() },
      { id: 'm2', body: 'Of course! The Q3 Enterprise License proposal covers 500 seats. Happy to walk you through the pricing breakdown on a call?', direction: 'outbound', createdAt: new Date(Date.now()-105*60000).toISOString() },
      { id: 'm3', body: 'That would be great. Can we schedule for Thursday at 2pm?', direction: 'inbound',  createdAt: new Date(Date.now()-60*60000).toISOString() },
      { id: 'm4', body: 'Thursday 2pm works perfectly. Sending over a calendar invite now!', direction: 'outbound', createdAt: new Date(Date.now()-55*60000).toISOString() },
      { id: 'm5', body: 'One more thing — can you include the API add-on pricing as well?', direction: 'inbound',  createdAt: new Date(Date.now()-5*60000).toISOString() },
    ],
    'c2': [
      { id: 'm6', body: 'Hey, saw your SMS blast about the Black Friday sale. What are the enterprise discounts?', direction: 'inbound',  createdAt: new Date(Date.now()-30*60000).toISOString() },
      { id: 'm7', body: 'Hey Bob! Enterprise gets 25% off annual plans + dedicated support. Want me to send details?', direction: 'outbound', createdAt: new Date(Date.now()-25*60000).toISOString() },
    ],
    'c3': [], 'c4': [
      { id: 'm8', body: 'Following up on our conversation from the conference. Ready to move forward with procurement?', direction: 'outbound', createdAt: new Date(Date.now()-4*3600000).toISOString() },
      { id: 'm9', body: 'Yes, we need a formal quote sent to our procurement team.', direction: 'inbound',  createdAt: new Date(Date.now()-3*3600000).toISOString() },
    ], 'c5': [],
  },
  smartLists: [] as any[],
};

// Helper: format currency
function formatCurrency(n: number) {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000)    return `$${Math.round(n / 1000)}k`;
  return `$${n.toLocaleString()}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────
const ContactSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
  email: z.union([z.string().email(), z.literal('')]).optional().nullable(),
  phone: z.string().optional().nullable(),
  companyId: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  tagsJson: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  about: z.string().optional().nullable(),
});

const CompanySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  domain: z.string().optional().nullable(),
  industry: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  employees: z.string().optional().nullable(),
  revenue: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

const DealSchema = z.object({
  title: z.string().min(1, "Title is required"),
  amount: z.number().optional().nullable(),
  priority: z.enum(['low', 'medium', 'high']).optional().nullable(),
  probability: z.number().min(0).max(100).optional().nullable(),
  closeDate: z.string().optional().nullable(),
  pipelineStageId: z.string().min(1, "Stage ID is required"),
  companyId: z.string().optional().nullable(),
  contactId: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

const TaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().nullable(),
  dueDate: z.union([z.string(), z.literal('')]).optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  contactId: z.string().optional().nullable(),
  status: z.enum(['pending', 'completed']).optional().nullable(),
  priority: z.enum(['low', 'medium', 'high']).optional().nullable(),
  type: z.string().optional().nullable(),
});

// ─────────────────────────────────────────────────────────────────────────────
// SERVER
// ─────────────────────────────────────────────────────────────────────────────
async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // ── AI / Agent Routes ─────────────────────────────────────────────────────
  app.use('/api/workflow-ai', workflowAiRouter);
  app.use('/api/conversations', chatRouter);
  app.use('/api/crm/actions', crmActionsRouter);
  app.use('/api/agents', agentsRouter);
  app.use('/api/voice-agents', voiceAgentsRouter);
  app.use('/api/integrations', integrationsRouter);

  // ── Health Check ──────────────────────────────────────────────────────────
  app.get('/api/health', async (req, res) => {
    try {
      await db.$queryRaw`SELECT 1`;
      res.json({ status: 'ok', db: 'connected' });
    } catch (e) {
      res.json({ status: 'degraded', db: 'mock', error: String(e) });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CRM — CONTACTS
  // ─────────────────────────────────────────────────────────────────────────
  app.get('/api/crm/contacts', async (req, res) => {
    try {
      const contacts = await db.contact.findMany({
        where: { workspaceId: DEV_WORKSPACE_ID },
        include: { company: true },
        orderBy: { createdAt: 'desc' },
      });
      // Normalize to component-compatible shape
      const normalized = contacts.map(c => ({
        ...c,
        name: `${c.firstName} ${c.lastName}`.trim(),
        businessName: c.company?.name ?? '',
        tags: JSON.parse(c.tagsJson || '[]'),
      }));
      res.json(normalized);
    } catch (e) {
      console.error('[contacts:get]', e);
      res.setHeader('X-Mock-Data', 'true');
      res.json(mockDB.contacts);
    }
  });

  app.get('/api/crm/contacts/:id', async (req, res) => {
    try {
      const contact = await db.contact.findUnique({
        where: { id: req.params.id },
        include: { company: true, events: { orderBy: { createdAt: 'desc' } }, deals: { include: { pipelineStage: true } } },
      });
      if (!contact) return res.status(404).json({ error: 'Not found' });
      res.json({ ...contact, name: `${contact.firstName} ${contact.lastName}`.trim(), tags: JSON.parse(contact.tagsJson || '[]') });
    } catch (e) {
      console.error('[contacts:get-one]', e);
      res.setHeader('X-Mock-Data', 'true');
      res.json(mockDB.contacts.find(c => c.id === req.params.id) || mockDB.contacts[0]);
    }
  });

  app.post('/api/crm/contacts', async (req, res) => {
    try {
      const validated = ContactSchema.parse(req.body);
      const { firstName, lastName, email, phone, companyId, title, tagsJson, color, source, status, about } = validated;
      const contact = await db.contact.create({
        data: {
          workspaceId: DEV_WORKSPACE_ID,
          firstName: firstName || '',
          lastName: lastName || '',
          email: email || null,
          phone: phone || null,
          companyId: companyId || null,
          title: title || null,
          tagsJson: tagsJson || '[]',
          color: color || '#7dd3fc',
          source: source || null,
          status: status || null,
          about: about || null,
        },
      });
      res.json({ ...contact, name: `${contact.firstName} ${contact.lastName}`.trim(), tags: JSON.parse(contact.tagsJson) });
    } catch (e) {
      console.error('[contacts:post]', e);
      res.setHeader('X-Mock-Data', 'true');
      res.json({ ...req.body, id: `ct_${Date.now()}`, createdAt: new Date().toISOString() });
    }
  });

  app.put('/api/crm/contacts/:id', async (req, res) => {
    try {
      const { name, tags, businessName, company, ...data } = req.body; // strip computed fields
      if (data.tagsJson && Array.isArray(data.tagsJson)) data.tagsJson = JSON.stringify(data.tagsJson);
      const contact = await db.contact.update({ where: { id: req.params.id }, data });
      res.json({ ...contact, name: `${contact.firstName} ${contact.lastName}`.trim(), tags: JSON.parse(contact.tagsJson || '[]') });
    } catch (e) {
      console.error('[contacts:put]', e);
      res.setHeader('X-Mock-Data', 'true');
      res.json({ ...req.body, id: req.params.id });
    }
  });

  app.delete('/api/crm/contacts/:id', async (req, res) => {
    try {
      await db.contact.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (e) {
      console.error('[contacts:delete]', e);
      res.json({ success: true }); // graceful fallback
    }
  });

  // Contact Events
  app.get('/api/crm/contacts/:id/events', async (req, res) => {
    try {
      const events = await db.contactEvent.findMany({
        where: { contactId: req.params.id },
        orderBy: { createdAt: 'desc' },
      });
      res.json(events);
    } catch (e) {
      res.json([]);
    }
  });
  app.post('/api/crm/contacts/:id/events', async (req, res) => {
    try {
      const event = await db.contactEvent.create({
        data: { contactId: req.params.id, type: req.body.type || 'note', title: req.body.title || 'Note', content: req.body.content || null, metadataJson: req.body.metadata ? JSON.stringify(req.body.metadata) : null },
      });
      res.json(event);
    } catch (e) {
      res.json({ id: `ev_${Date.now()}`, ...req.body, createdAt: new Date().toISOString() });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CRM — COMPANIES
  // ─────────────────────────────────────────────────────────────────────────
  app.get('/api/crm/companies', async (req, res) => {
    try {
      const companies = await db.company.findMany({
        where: { workspaceId: DEV_WORKSPACE_ID },
        include: { _count: { select: { contacts: true, deals: true } } },
      });
      res.json(companies);
    } catch (e) {
      console.error('[companies:get]', e);
      res.setHeader('X-Mock-Data', 'true');
      res.json(mockDB.companies);
    }
  });

  app.get('/api/crm/companies/:id', async (req, res) => {
    try {
      const company = await db.company.findUnique({ where: { id: req.params.id }, include: { contacts: true, deals: true } });
      if (!company) return res.status(404).json({ error: 'Not found' });
      res.json(company);
    } catch (e) {
      res.setHeader('X-Mock-Data', 'true');
      res.json(mockDB.companies.find(c => c.id === req.params.id) || mockDB.companies[0]);
    }
  });

  app.post('/api/crm/companies', async (req, res) => {
    try {
      const validated = CompanySchema.parse(req.body);
      const company = await db.company.create({ data: { ...validated, workspaceId: DEV_WORKSPACE_ID } });
      res.json(company);
    } catch (e) {
      res.setHeader('X-Mock-Data', 'true');
      res.json({ ...req.body, id: `co_${Date.now()}`, createdAt: new Date().toISOString() });
    }
  });

  app.put('/api/crm/companies/:id', async (req, res) => {
    try {
      const { _count, contacts, deals, ...data } = req.body;
      const company = await db.company.update({ where: { id: req.params.id }, data });
      res.json(company);
    } catch (e) {
      res.json({ ...req.body, id: req.params.id });
    }
  });

  app.delete('/api/crm/companies/:id', async (req, res) => {
    try {
      await db.company.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (e) {
      res.json({ success: true });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CRM — DEALS
  // ─────────────────────────────────────────────────────────────────────────
  app.get('/api/crm/deals', async (req, res) => {
    try {
      const deals = await db.deal.findMany({
        where: { workspaceId: DEV_WORKSPACE_ID },
        include: { company: true, contact: true, pipelineStage: true },
        orderBy: { createdAt: 'desc' },
      });
      res.json(deals);
    } catch (e) {
      console.error('[deals:get]', e);
      res.setHeader('X-Mock-Data', 'true');
      res.json(mockDB.deals);
    }
  });

  app.get('/api/crm/deals/:id', async (req, res) => {
    try {
      const deal = await db.deal.findUnique({ where: { id: req.params.id }, include: { company: true, contact: true, pipelineStage: true, activities: true } });
      if (!deal) return res.status(404).json({ error: 'Not found' });
      res.json(deal);
    } catch (e) {
      res.setHeader('X-Mock-Data', 'true');
      res.json(mockDB.deals.find(d => d.id === req.params.id) || mockDB.deals[0]);
    }
  });

  app.post('/api/crm/deals', async (req, res) => {
    try {
      const validated = DealSchema.parse(req.body);
      const { title, amount, priority, probability, closeDate, pipelineStageId, companyId, contactId, description } = validated;
      const deal = await db.deal.create({
        data: {
          workspaceId: DEV_WORKSPACE_ID,
          title: title || 'New Deal',
          amount: parseFloat(amount) || 0,
          priority: priority || 'medium',
          probability: parseInt(probability) || 0,
          closeDate: closeDate ? new Date(closeDate) : null,
          pipelineStageId: pipelineStageId || null,
          companyId: companyId || null,
          contactId: contactId || null,
          description: description || null,
          ownerId: DEV_WORKSPACE_ID,
        },
        include: { company: true, pipelineStage: true },
      });
      res.json(deal);
    } catch (e) {
      console.error('[deals:post]', e);
      res.setHeader('X-Mock-Data', 'true');
      res.json({ ...req.body, id: `dl_${Date.now()}`, createdAt: new Date().toISOString() });
    }
  });

  app.put('/api/crm/deals/:id', async (req, res) => {
    try {
      const { company, contact, pipelineStage, activities, ...data } = req.body;
      if (data.amount) data.amount = parseFloat(data.amount);
      if (data.probability) data.probability = parseInt(data.probability);
      if (data.closeDate) data.closeDate = new Date(data.closeDate);
      const deal = await db.deal.update({ where: { id: req.params.id }, data, include: { company: true, pipelineStage: true } });
      res.json(deal);
    } catch (e) {
      res.json({ ...req.body, id: req.params.id });
    }
  });

  app.delete('/api/crm/deals/:id', async (req, res) => {
    try {
      await db.deal.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (e) {
      res.json({ success: true });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CRM — PIPELINES
  // ─────────────────────────────────────────────────────────────────────────
  app.get('/api/crm/pipelines', async (req, res) => {
    try {
      const pipelines = await db.pipeline.findMany({
        where: { workspaceId: DEV_WORKSPACE_ID },
        include: { stages: { orderBy: { order: 'asc' } } },
      });
      res.json(pipelines);
    } catch (e) {
      console.error('[pipelines:get]', e);
      res.setHeader('X-Mock-Data', 'true');
      res.json(mockDB.pipelines);
    }
  });

  app.put('/api/crm/pipelines/:id', async (req, res) => {
    try {
      const { stages, ...data } = req.body;
      const pipeline = await db.pipeline.update({ where: { id: req.params.id }, data, include: { stages: { orderBy: { order: 'asc' } } } });
      res.json(pipeline);
    } catch (e) {
      res.json({ ...req.body, id: req.params.id });
    }
  });

  app.put('/api/crm/pipelines/:pipelineId/stages/:stageId', async (req, res) => {
    try {
      const stage = await db.pipelineStage.update({ where: { id: req.params.stageId }, data: req.body });
      res.json(stage);
    } catch (e) {
      res.json({ ...req.body, id: req.params.stageId });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CRM — TASKS
  // ─────────────────────────────────────────────────────────────────────────
  app.get('/api/crm/tasks', async (req, res) => {
    try {
      const tasks = await db.task.findMany({
        where: { workspaceId: DEV_WORKSPACE_ID },
        include: { contact: true },
        orderBy: { dueDate: 'asc' },
      });
      res.json(tasks);
    } catch (e) {
      console.error('[tasks:get]', e);
      res.setHeader('X-Mock-Data', 'true');
      res.json(mockDB.tasks);
    }
  });

  app.post('/api/crm/tasks', async (req, res) => {
    try {
      const validated = TaskSchema.parse(req.body);
      const { title, type, priority, status, dueDate, contactId, description, assigneeId } = validated;
      const task = await db.task.create({
        data: {
          workspaceId: DEV_WORKSPACE_ID,
          title: title || 'New Task',
          type: type || 'follow_up',
          priority: priority || 'medium',
          status: status || 'pending',
          dueDate: dueDate ? new Date(dueDate) : null,
          contactId: contactId || null,
          description: description || null,
          assigneeId: assigneeId || null,
        },
        include: { contact: true },
      });
      res.json(task);
    } catch (e) {
      console.error('[tasks:post]', e);
      res.setHeader('X-Mock-Data', 'true');
      res.json({ ...req.body, id: `tk_${Date.now()}`, createdAt: new Date().toISOString() });
    }
  });

  app.put('/api/crm/tasks/:id', async (req, res) => {
    try {
      const { contact, ...data } = req.body;
      if (data.dueDate) data.dueDate = new Date(data.dueDate);
      const task = await db.task.update({ where: { id: req.params.id }, data, include: { contact: true } });
      res.json(task);
    } catch (e) {
      res.json({ ...req.body, id: req.params.id });
    }
  });

  app.delete('/api/crm/tasks/:id', async (req, res) => {
    try {
      await db.task.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (e) {
      res.json({ success: true });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CRM — ACTIVITIES
  // ─────────────────────────────────────────────────────────────────────────
  app.get('/api/crm/activities', async (req, res) => {
    try {
      const activities = await db.activity.findMany({
        where: { workspaceId: DEV_WORKSPACE_ID },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      res.json(activities);
    } catch (e) {
      res.setHeader('X-Mock-Data', 'true');
      res.json(mockDB.activities);
    }
  });

  app.post('/api/crm/activities', async (req, res) => {
    try {
      const activity = await db.activity.create({ data: { ...req.body, workspaceId: DEV_WORKSPACE_ID } });
      res.json(activity);
    } catch (e) {
      res.json({ ...req.body, id: `ac_${Date.now()}`, createdAt: new Date().toISOString() });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CRM — SMART LISTS
  // ─────────────────────────────────────────────────────────────────────────
  app.get('/api/crm/smart-lists', async (req, res) => {
    try {
      const lists = await db.smartList.findMany({
        where: { workspaceId: DEV_WORKSPACE_ID },
        include: { _count: { select: { items: true } } },
      });
      res.json(lists);
    } catch (e) {
      res.setHeader('X-Mock-Data', 'true');
      res.json(mockDB.smartLists);
    }
  });

  app.post('/api/crm/smart-lists', async (req, res) => {
    try {
      const list = await db.smartList.create({
        data: { workspaceId: DEV_WORKSPACE_ID, name: req.body.name, filtersJson: JSON.stringify(req.body.filters || []) },
      });
      res.json(list);
    } catch (e) {
      res.setHeader('X-Mock-Data', 'true');
      const mock = { id: `sl_${Date.now()}`, name: req.body.name, filtersJson: JSON.stringify(req.body.filters || []), contacts: [] };
      mockDB.smartLists.push(mock);
      res.json(mock);
    }
  });

  app.delete('/api/crm/smart-lists/:id', async (req, res) => {
    try {
      await db.smartList.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (e) {
      mockDB.smartLists = mockDB.smartLists.filter(l => l.id !== req.params.id);
      res.json({ success: true });
    }
  });

  app.put('/api/crm/smart-lists/:id', async (req, res) => {
    try {
      const list = await db.smartList.update({
        where: { id: req.params.id },
        data: { name: req.body.name, filtersJson: JSON.stringify(req.body.filters || []) },
      });
      res.json(list);
    } catch (e) {
      res.setHeader('X-Mock-Data', 'true');
      const idx = mockDB.smartLists.findIndex(l => l.id === req.params.id);
      if (idx !== -1) Object.assign(mockDB.smartLists[idx], req.body);
      res.json(mockDB.smartLists[idx] || {});
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CRM — DASHBOARD (single, authoritative version)
  // ─────────────────────────────────────────────────────────────────────────
  app.get('/api/crm/dashboard', async (req, res) => {
    try {
      const [totalContacts, allDeals, activitiesToday, recentActivities, topContacts] = await Promise.all([
        db.contact.count({ where: { workspaceId: DEV_WORKSPACE_ID } }),
        db.deal.findMany({ where: { workspaceId: DEV_WORKSPACE_ID }, include: { pipelineStage: true } }),
        db.activity.count({ where: { workspaceId: DEV_WORKSPACE_ID, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
        db.activity.findMany({ where: { workspaceId: DEV_WORKSPACE_ID }, orderBy: { createdAt: 'desc' }, take: 5 }),
        db.contact.findMany({ where: { workspaceId: DEV_WORKSPACE_ID }, orderBy: { leadScore: 'desc' }, take: 5, include: { company: true } }),
      ]);

      const openDeals = allDeals.filter(d => d.pipelineStage?.name !== 'Won' && d.pipelineStage?.name !== 'Lost');
      const wonDeals  = allDeals.filter(d => d.pipelineStage?.name === 'Won');

      res.json({
        stats: {
          totalContacts,
          openDeals: openDeals.length,
          openDealsValue: formatCurrency(openDeals.reduce((s, d) => s + d.amount, 0)),
          wonDeals: wonDeals.length,
          wonDealsValue: formatCurrency(wonDeals.reduce((s, d) => s + d.amount, 0)),
          activitiesToday,
        },
        recentActivities: recentActivities.map(a => ({
          ...a,
          target: a.contactId ? 'Contact' : 'Internal',
          date: formatTimeAgo(a.createdAt),
        })),
        topContacts: topContacts.map(c => ({
          ...c,
          name: `${c.firstName} ${c.lastName}`.trim(),
          company: c.company?.name ?? '',
        })),
      });
    } catch (e) {
      console.error('[dashboard:get]', e);
      res.setHeader('X-Mock-Data', 'true');
      res.json({
        stats: { totalContacts: 2847, openDeals: 28, openDealsValue: '$240k', wonDeals: 18, wonDealsValue: '$210k', activitiesToday: 8 },
        recentActivities: mockDB.activities.slice(0, 5).map(a => ({ ...a, date: formatTimeAgo(new Date(a.date)) })),
        topContacts: mockDB.contacts.slice(0, 5).map(c => ({ ...c, company: c.businessName })),
      });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // BUSINESS — METRICS
  // ─────────────────────────────────────────────────────────────────────────
  app.get('/api/business/metrics', async (req, res) => {
    try {
      const [allDeals, totalContacts, allCampaigns] = await Promise.all([
        db.deal.findMany({ where: { workspaceId: DEV_WORKSPACE_ID }, include: { pipelineStage: true } }),
        db.contact.count({ where: { workspaceId: DEV_WORKSPACE_ID } }),
        db.campaign.findMany({ where: { workspaceId: DEV_WORKSPACE_ID } }),
      ]);

      const wonDeals  = allDeals.filter(d => d.pipelineStage?.name === 'Won');
      const openDeals = allDeals.filter(d => d.pipelineStage?.name !== 'Won' && d.pipelineStage?.name !== 'Lost');
      const revenue   = wonDeals.reduce((s, d) => s + d.amount, 0);
      const pipeline  = openDeals.reduce((s, d) => s + d.amount, 0);

      const stageGroups = ['Lead','Qualified','Proposal','Negotiation','Won'].map(name => {
        const stageDeals = allDeals.filter(d => d.pipelineStage?.name === name);
        const colors: Record<string, string> = { Lead: '#64748b', Qualified: '#818cf8', Proposal: '#fbbf24', Negotiation: '#a78bfa', Won: '#34d399' };
        return { name, count: stageDeals.length, value: stageDeals.reduce((s, d) => s + d.amount, 0), color: colors[name] || '#52677D' };
      });

      res.json({
        revenue:  { current: revenue  || 48250,  trend: [38,42,41,55,52,62,58,71,68,78,82,Math.round((revenue|48250)/1000)] },
        pipeline: { value:   pipeline || 182400, trend: [120,130,118,145,140,160,155,175,170,185,195,Math.round((pipeline|182400)/1000)] },
        contacts: { total: totalContacts || 2847 },
        pipeline_stages: stageGroups,
        campaigns: allCampaigns.map(c => {
          const metrics = c.metricsJson ? JSON.parse(c.metricsJson) : {};
          const audience = c.audienceJson ? JSON.parse(c.audienceJson) : {};
          return { name: c.name, sent: audience.count || 0, opens: metrics.openRate || 0, clicks: metrics.clickRate || 0, conversions: metrics.conversionRate || 0 };
        }),
        agentPerformance: [
          { name: 'Lead Scorer',      runs: 1420, success: 98.2, avgTime: '1.2s', credits: 2840 },
          { name: 'Email Drafter',    runs: 842,  success: 96.8, avgTime: '3.4s', credits: 5890 },
          { name: 'SEO Analyzer',     runs: 320,  success: 94.1, avgTime: '12.1s',credits: 9600 },
          { name: 'Sentiment Tagger', runs: 2100, success: 99.1, avgTime: '0.8s', credits: 1680 },
        ],
      });
    } catch (e) {
      console.error('[metrics:get]', e);
      res.setHeader('X-Mock-Data', 'true');
      res.json({
        revenue: { current: 48250, trend: [38,42,41,55,52,62,58,71,68,78,82,92] },
        pipeline: { value: 182400, trend: [120,130,118,145,140,160,155,175,170,185,195,210] },
        contacts: { total: 2847 },
        pipeline_stages: [
          { name: 'Lead', count: 45, value: 120000, color: '#64748b' },
          { name: 'Qualified', count: 28, value: 240000, color: '#818cf8' },
          { name: 'Proposal', count: 15, value: 180000, color: '#fbbf24' },
          { name: 'Negotiation', count: 8, value: 305000, color: '#a78bfa' },
          { name: 'Won', count: 18, value: 210000, color: '#34d399' },
        ],
        agentPerformance: [
          { name: 'Lead Scorer', runs: 1420, success: 98.2, avgTime: '1.2s', credits: 2840 },
          { name: 'Email Drafter', runs: 842, success: 96.8, avgTime: '3.4s', credits: 5890 },
          { name: 'SEO Analyzer', runs: 320, success: 94.1, avgTime: '12.1s', credits: 9600 },
          { name: 'Sentiment Tagger', runs: 2100, success: 99.1, avgTime: '0.8s', credits: 1680 },
        ],
        campaigns: [],
      });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // BUSINESS — CAMPAIGNS
  // ─────────────────────────────────────────────────────────────────────────
  app.get('/api/business/campaigns', async (req, res) => {
    try {
      const campaigns = await db.campaign.findMany({ where: { workspaceId: DEV_WORKSPACE_ID }, orderBy: { updatedAt: 'desc' } });
      res.json(campaigns);
    } catch (e) {
      res.setHeader('X-Mock-Data', 'true');
      res.json(mockDB.campaigns);
    }
  });

  app.post('/api/business/campaigns', async (req, res) => {
    try {
      const { name, type, status, subject, previewText, content, audienceJson, scheduledFor } = req.body;
      const campaign = await db.campaign.create({
        data: {
          workspaceId: DEV_WORKSPACE_ID,
          name: name || 'New Campaign',
          type: type || 'email',
          status: status || 'draft',
          subject: subject || null,
          previewText: previewText || null,
          content: content || null,
          audienceJson: audienceJson ? JSON.stringify(audienceJson) : '{}',
          metricsJson: '{"openRate":0,"clickRate":0}',
          scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        },
      });
      res.json(campaign);
    } catch (e) {
      res.setHeader('X-Mock-Data', 'true');
      res.json({ ...req.body, id: `cm_${Date.now()}`, updatedAt: new Date().toISOString() });
    }
  });

  app.put('/api/business/campaigns/:id', async (req, res) => {
    try {
      const { id, workspaceId, ...data } = req.body;
      if (data.scheduledFor) data.scheduledFor = new Date(data.scheduledFor);
      const campaign = await db.campaign.update({ where: { id: req.params.id }, data });
      res.json(campaign);
    } catch (e) {
      res.json({ ...req.body, id: req.params.id });
    }
  });

  app.delete('/api/business/campaigns/:id', async (req, res) => {
    try {
      await db.campaign.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (e) {
      res.json({ success: true });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // BUSINESS — FORMS
  // ─────────────────────────────────────────────────────────────────────────
  app.get('/api/business/forms', async (req, res) => {
    try {
      const forms = await db.form.findMany({
        where: { workspaceId: DEV_WORKSPACE_ID },
        include: { _count: { select: { submissions: true } } },
        orderBy: { createdAt: 'desc' },
      });
      res.json(forms.map(f => ({ ...f, submissions: Array(f._count.submissions).fill({}) })));
    } catch (e) {
      res.setHeader('X-Mock-Data', 'true');
      res.json(mockDB.forms);
    }
  });

  app.post('/api/business/forms', async (req, res) => {
    try {
      const form = await db.form.create({
        data: {
          workspaceId: DEV_WORKSPACE_ID,
          name: req.body.name || 'New Form',
          description: req.body.description || null,
          schema: Array.isArray(req.body.schema) ? JSON.stringify(req.body.schema) : (req.body.schema || '[]'),
        },
      });
      res.json({ ...form, submissions: [] });
    } catch (e) {
      res.setHeader('X-Mock-Data', 'true');
      res.json({ ...req.body, id: `fm_${Date.now()}`, visits: 0, submissions: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
  });

  app.delete('/api/business/forms/:id', async (req, res) => {
    try {
      await db.form.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (e) {
      res.json({ success: true });
    }
  });

  app.get('/api/business/forms/:id/submissions', async (req, res) => {
    try {
      const submissions = await db.formSubmission.findMany({ where: { formId: req.params.id }, orderBy: { submittedAt: 'desc' } });
      res.json(submissions.map(s => ({ ...s, data: JSON.parse(s.data || '{}') })));
    } catch (e) {
      res.json([]);
    }
  });

  app.post('/api/business/forms/:id/submissions', async (req, res) => {
    try {
      const submission = await db.formSubmission.create({ data: { formId: req.params.id, data: JSON.stringify(req.body) } });
      await db.form.update({ where: { id: req.params.id }, data: { visits: { increment: 1 } } }).catch(() => {});
      res.json(submission);
    } catch (e) {
      res.json({ id: `sub_${Date.now()}`, submittedAt: new Date().toISOString() });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // BUSINESS — REVIEWS (REPUTATION)
  // ─────────────────────────────────────────────────────────────────────────
  app.post('/api/business/reviews/request', async (req, res) => {
    try {
      // Simulate sending review requests
      await db.activity.create({
        data: {
          workspaceId: DEV_WORKSPACE_ID,
          type: 'email',
          title: 'Review Request Campaign Sent',
          description: `Sent review request to recently active customers. Message: ${req.body.message || ''}`,
          date: new Date().toISOString(),
          icon: 'Mail',
          hex: '#3B82F6',
        }
      });
      res.json({ success: true, sent: 142 });
    } catch (e) {
      res.status(500).json({ error: 'Failed to send review requests' });
    }
  });

  app.get('/api/business/reviews', async (req, res) => {
    try {
      const reviews = await db.review.findMany({ where: { workspaceId: DEV_WORKSPACE_ID }, orderBy: { date: 'desc' } });
      res.json(reviews);
    } catch (e) {
      res.setHeader('X-Mock-Data', 'true');
      res.json(mockDB.reviews);
    }
  });

  app.put('/api/business/reviews/:id', async (req, res) => {
    try {
      const review = await db.review.update({ where: { id: req.params.id }, data: req.body });
      res.json(review);
    } catch (e) {
      res.json({ ...req.body, id: req.params.id });
    }
  });

  app.delete('/api/business/reviews/:id', async (req, res) => {
    try {
      await db.review.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (e) {
      res.json({ success: true });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // BUSINESS — APPOINTMENTS (CALENDAR)
  // ─────────────────────────────────────────────────────────────────────────
  app.get('/api/business/appointments', async (req, res) => {
    try {
      const appointments = await db.appointment.findMany({
        where: { workspaceId: DEV_WORKSPACE_ID },
        include: { contact: true },
        orderBy: { startTime: 'asc' },
      });
      res.json(appointments);
    } catch (e) {
      res.setHeader('X-Mock-Data', 'true');
      res.json(mockDB.appointments);
    }
  });

  app.post('/api/business/appointments', async (req, res) => {
    try {
      const { title, description, type, location, contactId, startTime, endTime, status } = req.body;
      const apt = await db.appointment.create({
        data: {
          workspaceId: DEV_WORKSPACE_ID,
          title: title || 'Meeting',
          description: description || null,
          type: type || 'meeting',
          location: location || null,
          contactId: contactId || null,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          status: status || 'scheduled',
        },
        include: { contact: true },
      });
      res.json(apt);
    } catch (e) {
      console.error('[appointments:post]', e);
      res.setHeader('X-Mock-Data', 'true');
      res.json({ ...req.body, id: `apt_${Date.now()}`, createdAt: new Date().toISOString() });
    }
  });

  app.put('/api/business/appointments/:id', async (req, res) => {
    try {
      const { contact, ...data } = req.body;
      if (data.startTime) data.startTime = new Date(data.startTime);
      if (data.endTime)   data.endTime   = new Date(data.endTime);
      const apt = await db.appointment.update({ where: { id: req.params.id }, data, include: { contact: true } });
      res.json(apt);
    } catch (e) {
      res.json({ ...req.body, id: req.params.id });
    }
  });

  app.delete('/api/business/appointments/:id', async (req, res) => {
    try {
      await db.appointment.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (e) {
      res.json({ success: true });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // BUSINESS — CONVERSATIONS (INBOX)
  // ─────────────────────────────────────────────────────────────────────────
  app.get('/api/business/conversations', async (req, res) => {
    try {
      const convos = await db.conversation.findMany({
        where: { workspaceId: DEV_WORKSPACE_ID },
        include: { contact: { include: { company: true } }, messages: { take: 1, orderBy: { createdAt: 'desc' } } },
        orderBy: { updatedAt: 'desc' },
      });
      res.json(convos);
    } catch (e) {
      res.setHeader('X-Mock-Data', 'true');
      res.json(mockDB.conversations);
    }
  });

  app.get('/api/business/conversations/:id/messages', async (req, res) => {
    try {
      const messages = await db.conversationMessage.findMany({
        where: { conversationId: req.params.id },
        orderBy: { createdAt: 'asc' },
      });
      res.json(messages);
    } catch (e) {
      res.setHeader('X-Mock-Data', 'true');
      res.json((mockDB.messages as any)[req.params.id] || []);
    }
  });

  app.post('/api/business/conversations/:id/messages', async (req, res) => {
    try {
      const msg = await db.conversationMessage.create({
        data: { conversationId: req.params.id, sender: req.body.sender || 'user', body: req.body.body, direction: req.body.direction || 'outbound' },
      });
      await db.conversation.update({ where: { id: req.params.id }, data: { updatedAt: new Date() } }).catch(() => {});
      res.json(msg);
    } catch (e) {
      console.error('[messages:post]', e);
      res.status(500).json({ error: 'Failed to send message' });
    }
  });

  app.post('/api/business/conversations', async (req, res) => {
    try {
      const convo = await db.conversation.create({ data: { ...req.body, workspaceId: DEV_WORKSPACE_ID } });
      res.json(convo);
    } catch (e) {
      res.json({ ...req.body, id: `cv_${Date.now()}`, updatedAt: new Date().toISOString() });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DEV — Database Seed Trigger
  // ─────────────────────────────────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    app.post('/api/dev/seed', async (req, res) => {
      try {
        const { execSync } = await import('child_process');
        execSync('npx tsx prisma/seed.ts', { stdio: 'inherit' });
        res.json({ success: true, message: 'Database seeded successfully' });
      } catch (e) {
        res.status(500).json({ error: String(e) });
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VITE MIDDLEWARE
  // ─────────────────────────────────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => console.log(`✅ Server running on http://localhost:${PORT}`));
}

function formatTimeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  if (diff < 60000)      return 'Just now';
  if (diff < 3600000)    return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000)   return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000)  return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString();
}

startServer();
