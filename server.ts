import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import workflowAiRouter from './api/workflow-ai.js';
import chatRouter from './api/chat.js';
import agentsRouter from './api/agents.js';
import voiceAgentsRouter from './api/voice-agents.js';
import crmActionsRouter from './api/crm-actions.js';
import { db } from './src/lib/db.js';

// Mock database — rich realistic data
const mockDb: any = {
  contacts: [
    { id: '1', name: 'Alice Freeman',   title: 'VP of Engineering',  company: 'Acme Corp',    companyId: '1', email: 'alice@acmecorp.com',  phone: '+1 (555) 123-4567', location: 'San Francisco, CA', leadScore: 98, status: 'hot',    tags: ['enterprise','vip'],  lastContact: '2 days ago', source: 'Outbound', about: 'Key decision maker for enterprise software purchases.' },
    { id: '2', name: 'Bob Smith',       title: 'Director of IT',     company: 'TechStart',    companyId: '2', email: 'bob@techstart.io',   phone: '+1 (555) 987-6543', location: 'Austin, TX',         leadScore: 74, status: 'warm',   tags: ['smb'],               lastContact: '1 week ago',  source: 'Inbound',  about: 'Looking to upgrade their current infrastructure.' },
    { id: '3', name: 'Carol Nguyen',    title: 'CEO',                company: 'Global Sol.',  companyId: '3', email: 'carol@globalsol.com', phone: '+1 (555) 234-5678', location: 'Chicago, IL',        leadScore: 92, status: 'hot',    tags: ['enterprise','ceo'],  lastContact: 'Today',       source: 'Referral', about: 'Interested in our enterprise tier.' },
    { id: '4', name: 'David Park',      title: 'Head of Procurement',company: 'Nexus LLC',    companyId: '4', email: 'david@nexusllc.com', phone: '+1 (555) 345-6789', location: 'Seattle, WA',        leadScore: 61, status: 'warm',   tags: ['mid-market'],        lastContact: '3 days ago',  source: 'Google',   about: 'Evaluating vendors for Q4 purchase.' },
    { id: '5', name: 'Elena Torres',    title: 'Marketing Director', company: 'BrightCo',    companyId: '5', email: 'elena@brightco.com', phone: '+1 (555) 456-7890', location: 'Miami, FL',          leadScore: 55, status: 'neutral', tags: ['marketing'],         lastContact: '2 weeks ago', source: 'LinkedIn', about: 'Interested in our marketing automation.' },
    { id: '6', name: 'Frank Muller',    title: 'CTO',                company: 'Apex Systems', companyId: '1', email: 'frank@apex.com',      phone: '+1 (555) 567-8901', location: 'New York, NY',       leadScore: 88, status: 'hot',    tags: ['enterprise','cto'],  lastContact: 'Yesterday',   source: 'Conference', about: 'Met at SaaStr. Very interested in API access.' },
    { id: '7', name: 'Grace Kim',       title: 'Product Manager',    company: 'TechStart',    companyId: '2', email: 'grace@techstart.io', phone: '+1 (555) 678-9012', location: 'Austin, TX',         leadScore: 49, status: 'cold',   tags: ['smb'],               lastContact: '1 month ago', source: 'Inbound',  about: 'Evaluated last quarter but no budget then.' },
    { id: '8', name: 'Henry Walsh',     title: 'CFO',                company: 'Acme Corp',    companyId: '1', email: 'henry@acmecorp.com',  phone: '+1 (555) 789-0123', location: 'San Francisco, CA', leadScore: 71, status: 'warm',   tags: ['enterprise','finance'], lastContact: '5 days ago', source: 'Outbound', about: 'Controls budget approvals for Acme.' },
  ],
  companies: [
    { id: '1', name: 'Acme Corp',     website: 'acmecorp.com',    industry: 'Manufacturing', location: 'San Francisco, CA', employees: '1,000-5,000', revenue: '$100M-$500M', description: 'Leading manufacturer of industrial equipment.' },
    { id: '2', name: 'TechStart',     website: 'techstart.io',    industry: 'Software',      location: 'Austin, TX',        employees: '50-200',      revenue: '$10M-$50M',   description: 'Fast-growing B2B software startup.' },
    { id: '3', name: 'Global Sol.',   website: 'globalsol.com',   industry: 'Consulting',    location: 'Chicago, IL',       employees: '500-1,000',   revenue: '$50M-$100M',  description: 'Management consulting firm.' },
    { id: '4', name: 'Nexus LLC',     website: 'nexusllc.com',    industry: 'Logistics',     location: 'Seattle, WA',       employees: '200-500',     revenue: '$20M-$50M',   description: 'Regional logistics and distribution.' },
    { id: '5', name: 'BrightCo',      website: 'brightco.com',    industry: 'Marketing',     location: 'Miami, FL',         employees: '10-50',       revenue: '$1M-$5M',     description: 'Digital marketing agency.' },
  ],
  deals: [
    { id: '1', title: 'Q3 Enterprise License',    amount: 120000, stage: 'Proposal',     probability: 60, closeDate: '2026-09-30', company: { name: 'Acme Corp' },    companyId: '1', contactId: '1', owner: 'Jane Doe',    description: 'Enterprise license for 500 users.' },
    { id: '2', title: 'Infrastructure Upgrade',   amount: 45000,  stage: 'Qualified',    probability: 30, closeDate: '2026-10-15', company: { name: 'TechStart' },    companyId: '2', contactId: '2', owner: 'Jack Stone', description: 'Server infrastructure upgrade bundle.' },
    { id: '3', title: 'Marketing Automation',     amount: 28000,  stage: 'Negotiation',  probability: 75, closeDate: '2026-08-31', company: { name: 'BrightCo' },     companyId: '5', contactId: '5', owner: 'Jack Stone', description: 'Full automation suite implementation.' },
    { id: '4', title: 'Consulting Retainer',      amount: 72000,  stage: 'Won',          probability: 100,closeDate: '2026-07-01', company: { name: 'Global Sol.' },   companyId: '3', contactId: '3', owner: 'Jane Doe',   description: 'Annual consulting retainer.' },
    { id: '5', title: 'Logistics Platform',       amount: 95000,  stage: 'Lead',         probability: 15, closeDate: '2026-11-30', company: { name: 'Nexus LLC' },    companyId: '4', contactId: '4', owner: 'Jack Stone', description: 'Custom logistics tracking platform.' },
    { id: '6', title: 'API Access — Startup',     amount: 12000,  stage: 'Qualified',    probability: 45, closeDate: '2026-09-15', company: { name: 'TechStart' },    companyId: '2', contactId: '7', owner: 'Jack Stone', description: 'Startup plan with full API access.' },
    { id: '7', title: 'Enterprise Expansion',     amount: 240000, stage: 'Proposal',     probability: 55, closeDate: '2026-10-01', company: { name: 'Acme Corp' },    companyId: '1', contactId: '6', owner: 'Jane Doe',   description: 'Expanding existing license to 2,000 users.' },
    { id: '8', title: 'SMB Starter Pack',         amount: 8400,   stage: 'Won',          probability: 100,closeDate: '2026-06-15', company: { name: 'BrightCo' },     companyId: '5', contactId: '5', owner: 'Jack Stone', description: 'SMB starter kit with onboarding.' },
  ],
  activities: [
    { id: '1',  type: 'email',   title: 'Sent Q3 proposal email',         target: 'Alice Freeman',  company: 'Acme Corp',   date: new Date(Date.now()-2*60*60*1000).toISOString() },
    { id: '2',  type: 'call',    title: 'Discovery call completed',        target: 'Bob Smith',      company: 'TechStart',   date: new Date(Date.now()-5*60*60*1000).toISOString() },
    { id: '3',  type: 'meeting', title: 'Product demo — Enterprise tier',  target: 'Carol Nguyen',   company: 'Global Sol.', date: new Date(Date.now()-1*24*60*60*1000).toISOString() },
    { id: '4',  type: 'note',    title: 'Added follow-up note',           target: 'David Park',     company: 'Nexus LLC',   date: new Date(Date.now()-2*24*60*60*1000).toISOString() },
    { id: '5',  type: 'email',   title: 'Contract sent for signature',    target: 'Carol Nguyen',   company: 'Global Sol.', date: new Date(Date.now()-3*24*60*60*1000).toISOString() },
    { id: '6',  type: 'call',    title: 'Negotiation call',               target: 'Elena Torres',   company: 'BrightCo',    date: new Date(Date.now()-4*24*60*60*1000).toISOString() },
    { id: '7',  type: 'stage',   title: 'Deal moved to Won',              target: 'Global Sol.',    company: 'Global Sol.', date: new Date(Date.now()-5*24*60*60*1000).toISOString() },
    { id: '8',  type: 'email',   title: 'Onboarding welcome sent',        target: 'Frank Muller',   company: 'Apex Systems',date: new Date(Date.now()-6*24*60*60*1000).toISOString() },
    { id: '9',  type: 'call',    title: 'Quarterly check-in call',        target: 'Henry Walsh',    company: 'Acme Corp',   date: new Date(Date.now()-7*24*60*60*1000).toISOString() },
    { id: '10', type: 'meeting', title: 'Technical requirements review',  target: 'Grace Kim',      company: 'TechStart',   date: new Date(Date.now()-8*24*60*60*1000).toISOString() },
  ],
  pipelines: [
    { id: '1', name: 'Standard Sales', stages: [
      { id: 'lead', name: 'Lead', order: 0 },
      { id: 'qualified', name: 'Qualified', order: 1 },
      { id: 'proposal', name: 'Proposal', order: 2 },
      { id: 'negotiation', name: 'Negotiation', order: 3 },
      { id: 'won', name: 'Won', order: 4 },
    ]}
  ],
  campaigns: [
    { id: '1', name: 'Black Friday VIP Early Access',   type: 'email', status: 'sent',      audience: JSON.stringify({count:14500}), metrics: JSON.stringify({openRate:42.5,clickRate:18.2,opens:6113,clicks:2639}), updatedAt: new Date(Date.now()-2*24*60*60*1000).toISOString() },
    { id: '2', name: 'Abandoned Cart Recovery Series', type: 'email', status: 'sending',   audience: JSON.stringify({count:320}),   metrics: JSON.stringify({openRate:0,clickRate:0,opens:0,clicks:0}), updatedAt: new Date(Date.now()-1*60*60*1000).toISOString() },
    { id: '3', name: 'Flash Sale SMS Blast',            type: 'sms',   status: 'scheduled', audience: JSON.stringify({count:5800}),  metrics: JSON.stringify({openRate:0,clickRate:0}), scheduledFor: 'Tomorrow, 10:00 AM', updatedAt: new Date(Date.now()-4*60*60*1000).toISOString() },
    { id: '4', name: 'Q4 Product Update Newsletter',    type: 'email', status: 'draft',     audience: JSON.stringify({count:22000}), metrics: JSON.stringify({openRate:0,clickRate:0}), updatedAt: new Date(Date.now()-30*60*1000).toISOString() },
  ],
  forms: [
    { id: '1', name: 'Contact Us',              schema: '{}', visits: 1240, updatedAt: new Date(Date.now()-1*24*60*60*1000).toISOString(), submissions: [{},{},{},{},{},{},{},{},{}] },
    { id: '2', name: 'Lead Magnet Download',    schema: '{}', visits: 3820, updatedAt: new Date(Date.now()-3*24*60*60*1000).toISOString(), submissions: Array(438).fill({}) },
    { id: '3', name: 'Event RSVP — Q4 Summit', schema: '{}', visits: 890,  updatedAt: new Date(Date.now()-7*24*60*60*1000).toISOString(), submissions: Array(124).fill({}) },
  ],
  reviews: [
    { id: '1', author: 'Sarah Mitchell',  rating: 5, source: 'google',   text: 'Absolutely outstanding platform. The automation features have saved our team 20hrs/week. Customer support is world class.', date: new Date(Date.now()-1*24*60*60*1000).toISOString(), replied: false },
    { id: '2', author: 'James OBrien',    rating: 4, source: 'google',   text: 'Very impressed with the CRM features. The pipeline view is intuitive and the reporting is solid. Minor UI quirks but overall excellent.', date: new Date(Date.now()-3*24*60*60*1000).toISOString(), replied: true },
    { id: '3', author: 'Priya Sharma',    rating: 5, source: 'facebook', text: 'Made the switch from GoHighLevel and never looked back. The AI assistant alone is worth the price.', date: new Date(Date.now()-5*24*60*60*1000).toISOString(), replied: false },
    { id: '4', author: 'Marcus Webb',     rating: 2, source: 'yelp',     text: 'Had some connectivity issues during onboarding. Support was helpful but took 2 days to resolve. Product itself is good.', date: new Date(Date.now()-7*24*60*60*1000).toISOString(), replied: true },
    { id: '5', author: 'Lisa Tanaka',     rating: 5, source: 'google',   text: 'The campaign builder is incredible. Open rates jumped from 18% to 38% after switching. Highly recommend for any growth team.', date: new Date(Date.now()-10*24*60*60*1000).toISOString(), replied: false },
    { id: '6', author: 'Derek Johnson',   rating: 4, source: 'google',   text: 'Solid enterprise tool. We use it for our entire sales workflow. Integration with Twilio works flawlessly.', date: new Date(Date.now()-12*24*60*60*1000).toISOString(), replied: true },
    { id: '7', author: 'Amanda Foster',   rating: 1, source: 'yelp',     text: 'Initial setup was confusing and documentation is lacking. Hope they improve the onboarding experience.', date: new Date(Date.now()-14*24*60*60*1000).toISOString(), replied: false },
    { id: '8', author: 'Chris Reynolds',  rating: 5, source: 'facebook', text: 'Best investment we made this year. The AI deal scoring alone increased our close rate by 22%.', date: new Date(Date.now()-18*24*60*60*1000).toISOString(), replied: false },
  ],
  appointments: (() => {
    const now = new Date();
    const week = [0,1,2,3,4];
    return week.flatMap(dayOffset => {
      const day = new Date(now);
      day.setDate(day.getDate() - day.getDay() + 1 + dayOffset);
      return [
        { id: `apt-${dayOffset}-1`, title: 'Discovery Call', type: 'call',    status: 'scheduled', startTime: new Date(day.setHours(10,0,0,0)).toISOString(), endTime: new Date(day.setHours(11,0,0,0)).toISOString(), contact: { name: 'Alice Freeman' }, location: 'Zoom' },
        { id: `apt-${dayOffset}-2`, title: 'Product Demo',   type: 'meeting', status: 'scheduled', startTime: new Date(day.setHours(14,0,0,0)).toISOString(), endTime: new Date(day.setHours(15,0,0,0)).toISOString(), contact: { name: 'Bob Smith' },    location: 'Google Meet' },
      ];
    });
  })(),
  conversations: [
    { id: 'c1', channel: 'email', status: 'open',   updatedAt: new Date(Date.now()-5*60*1000).toISOString(),   unreadCount: 2, contact: { name: 'Alice Freeman', email: 'alice@acmecorp.com' } },
    { id: 'c2', channel: 'sms',   status: 'open',   updatedAt: new Date(Date.now()-25*60*1000).toISOString(),  unreadCount: 1, contact: { name: 'Bob Smith',    email: 'bob@techstart.io'   } },
    { id: 'c3', channel: 'chat',  status: 'closed', updatedAt: new Date(Date.now()-2*60*60*1000).toISOString(), unreadCount: 0, contact: { name: 'Carol Nguyen', email: 'carol@globalsol.com'} },
    { id: 'c4', channel: 'email', status: 'open',   updatedAt: new Date(Date.now()-3*60*60*1000).toISOString(), unreadCount: 3, contact: { name: 'David Park',   email: 'david@nexusllc.com' } },
    { id: 'c5', channel: 'sms',   status: 'open',   updatedAt: new Date(Date.now()-1*24*60*60*1000).toISOString(),unreadCount: 0, contact: { name: 'Elena Torres', email: 'elena@brightco.com' } },
  ],
  messages: {
    'c1': [
      { id: 'm1', body: 'Hi! I wanted to follow up on the proposal you sent last week.', direction: 'inbound',  createdAt: new Date(Date.now()-2*60*60*1000).toISOString() },
      { id: 'm2', body: 'Of course! The Q3 Enterprise License proposal covers 500 seats. Happy to walk you through the pricing breakdown on a call?', direction: 'outbound', createdAt: new Date(Date.now()-105*60*1000).toISOString() },
      { id: 'm3', body: 'That would be great. Can we schedule for Thursday at 2pm?', direction: 'inbound', createdAt: new Date(Date.now()-60*60*1000).toISOString() },
      { id: 'm4', body: 'Thursday 2pm works perfectly. Sending over a calendar invite now!', direction: 'outbound', createdAt: new Date(Date.now()-55*60*1000).toISOString() },
      { id: 'm5', body: 'One more thing — can you include the API add-on pricing as well?', direction: 'inbound', createdAt: new Date(Date.now()-5*60*1000).toISOString() },
    ],
    'c2': [
      { id: 'm6', body: 'Hey, saw your SMS blast about the Black Friday sale. What are the enterprise discounts?', direction: 'inbound',  createdAt: new Date(Date.now()-30*60*1000).toISOString() },
      { id: 'm7', body: 'Hey Bob! Enterprise gets 25% off annual plans + dedicated support. Want me to send details?', direction: 'outbound', createdAt: new Date(Date.now()-25*60*1000).toISOString() },
    ],
    'c3': [],
    'c4': [
      { id: 'm8', body: 'Following up on our conversation from the conference. Ready to move forward with procurement?', direction: 'outbound', createdAt: new Date(Date.now()-4*60*60*1000).toISOString() },
      { id: 'm9', body: 'Yes, we need a formal quote sent to our procurement team.', direction: 'inbound', createdAt: new Date(Date.now()-3*60*60*1000).toISOString() },
    ],
    'c5': [],
  },
};


async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- AI Routes ---
  app.use('/api/workflow-ai', workflowAiRouter);
  app.use('/api/conversations', chatRouter);

  // --- CRM Actions API ---
  app.use('/api/crm/actions', crmActionsRouter);

  // --- API Routes ---

  const MOCK_WORKSPACE_ID = 'workspace_123';

  // Contacts
  app.get('/api/crm/contacts', async (req, res) => {
    try {
      const contacts = await db.contact.findMany({ 
        where: { workspaceId: MOCK_WORKSPACE_ID },
        include: { company: true }
      });
      res.json(contacts);
    } catch (e) {
      res.json(mockDb.contacts);
    }
  });
  
  app.get('/api/crm/contacts/:id', async (req, res) => {
    try {
      const contact = await db.contact.findUnique({ 
        where: { id: req.params.id },
        include: { company: true }
      });
      if (contact) res.json(contact);
      else res.json(mockDb.contacts.find(c => c.id === req.params.id) || mockDb.contacts[0]);
    } catch (e) {
      res.json(mockDb.contacts.find(c => c.id === req.params.id) || mockDb.contacts[0]);
    }
  });

  app.put('/api/crm/contacts/:id', async (req, res) => {
    try {
      const contact = await db.contact.update({
        where: { id: req.params.id },
        data: req.body
      });
      res.json(contact);
    } catch (e) {
      res.json({ ...mockDb.contacts[0], ...req.body, id: req.params.id });
    }
  });

  app.post('/api/crm/contacts', async (req, res) => {
    try {
      const contact = await db.contact.create({
        data: { ...req.body, workspaceId: MOCK_WORKSPACE_ID }
      });
      res.json(contact);
    } catch (e) {
      res.json({ ...req.body, id: Date.now().toString(), createdAt: new Date().toISOString() });
    }
  });

  // Companies
  app.get('/api/crm/companies', async (req, res) => {
    try {
      const companies = await db.company.findMany({ where: { workspaceId: MOCK_WORKSPACE_ID } });
      res.json(companies);
    } catch (e) {
      res.json(mockDb.companies);
    }
  });

  app.get('/api/crm/companies/:id', async (req, res) => {
    try {
      const company = await db.company.findUnique({ where: { id: req.params.id } });
      if (company) res.json(company);
      else res.json(mockDb.companies.find(c => c.id === req.params.id) || mockDb.companies[0]);
    } catch (e) {
      res.json(mockDb.companies.find(c => c.id === req.params.id) || mockDb.companies[0]);
    }
  });

  app.put('/api/crm/companies/:id', async (req, res) => {
    try {
      const company = await db.company.update({
        where: { id: req.params.id },
        data: req.body
      });
      res.json(company);
    } catch (e) {
      res.json({ ...mockDb.companies[0], ...req.body, id: req.params.id });
    }
  });

  app.post('/api/crm/companies', async (req, res) => {
    try {
      const company = await db.company.create({
        data: { ...req.body, workspaceId: MOCK_WORKSPACE_ID }
      });
      res.json(company);
    } catch (e) {
      res.json({ ...req.body, id: Date.now().toString(), createdAt: new Date().toISOString() });
    }
  });

  // Deals
  app.get('/api/crm/deals', async (req, res) => {
    try {
      const deals = await db.deal.findMany({
        where: { workspaceId: MOCK_WORKSPACE_ID },
        include: { company: true }
      });
      res.json(deals);
    } catch (e) {
      res.json(mockDb.deals);
    }
  });

  app.post('/api/crm/deals', async (req, res) => {
    try {
      const { title, amount, stage, closeDate, priority, companyId, contactId } = req.body;
      const deal = await db.deal.create({
        data: {
          title,
          amount: parseFloat(amount) || 0,
          stage,
          closeDate: closeDate ? new Date(closeDate) : null,
          description: priority || 'medium', // Storing priority in description for schema compatibility or can extend schema
          workspaceId: MOCK_WORKSPACE_ID,
          companyId: companyId || null,
          contactId: contactId || null
        }
      });
      res.json(deal);
    } catch (e) {
      console.error(e);
      res.json({ ...req.body, id: Date.now().toString() });
    }
  });

  // Analytics Dashboard
  app.get('/api/crm/dashboard', async (req, res) => {
    try {
      res.json({
        stats: {
          totalContacts: 1452,
          openDeals: 28,
          openDealsValue: '$240k',
          wonDeals: 18,
          wonDealsValue: '$210k',
          activitiesToday: 8
        },
        recentActivities: [
          { type: 'call', title: 'Discovery call with Alice', target: 'Alice Freeman', date: '2 mins ago' },
          { type: 'email', title: 'Sent proposal to TechStart', target: 'TechStart Inc', date: '1 hour ago' },
          { type: 'meeting', title: 'Product Demo', target: 'Charlie Davis', date: '3 hours ago' }
        ],
        topContacts: [
          { name: 'Sarah Chen', company: 'Acme Corp', leadScore: 98 },
          { name: 'Mike Johnson', company: 'TechStart Inc', leadScore: 92 },
          { name: 'Lisa Wang', company: 'Global Solutions', leadScore: 88 }
        ]
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Database error' });
    }
  });

  app.get('/api/crm/deals/:id', async (req, res) => {
    try {
      const deal = await db.deal.findUnique({ 
        where: { id: req.params.id },
        include: { company: true }
      });
      if (deal) res.json(deal);
      else res.json(mockDb.deals.find(d => d.id === req.params.id) || mockDb.deals[0]);
    } catch (e) {
      res.json(mockDb.deals.find(d => d.id === req.params.id) || mockDb.deals[0]);
    }
  });

  app.put('/api/crm/deals/:id', async (req, res) => {
    try {
      const deal = await db.deal.update({
        where: { id: req.params.id },
        data: req.body
      });
      res.json(deal);
    } catch (e) {
      res.json({ ...mockDb.deals[0], ...req.body, id: req.params.id });
    }
  });

  // Activities
  app.get('/api/crm/activities', async (req, res) => {
    try {
      const activities = await db.activity.findMany({
        orderBy: { createdAt: 'desc' }
      });
      res.json(activities);
    } catch (e) {
      res.json(mockDb.activities || []);
    }
  });

  app.post('/api/crm/activities', async (req, res) => {
    try {
      const activity = await db.activity.create({
        data: req.body
      });
      res.json(activity);
    } catch (e) {
      res.json({ ...req.body, id: Date.now().toString(), createdAt: new Date().toISOString() });
    }
  });

  // Pipelines
  app.get('/api/crm/pipelines', (req, res) => {
    res.json(mockDb.pipelines);
  });
  
  app.put('/api/crm/pipelines/:id', (req, res) => {
    const index = mockDb.pipelines.findIndex(p => p.id === req.params.id);
    if (index !== -1) {
      mockDb.pipelines[index] = { ...mockDb.pipelines[index], ...req.body };
      res.json(mockDb.pipelines[index]);
    } else {
      res.status(404).json({ error: 'Not found' });
    }
  });

  // --- Business Hub Endpoints ---

  // Business Metrics (new)
  app.get('/api/business/metrics', (req, res) => {
    res.json({
      revenue: { current: 48250, previous: 42890, trend: [38,42,41,55,52,62,58,71,68,78,82,92] },
      pipeline: { value: 182400, trend: [120,130,118,145,140,160,155,175,170,185,195,210] },
      contacts: { total: 2847, trend: [2100,2180,2220,2300,2380,2450,2520,2610,2680,2750,2800,2847] },
      conversion: { rate: 24.8, trend: [22,24,23,26,25,27,24,26,25,27,26,25] },
      pipeline_stages: [
        { name:'Lead',        count:45, value:120000, color:'#64748b' },
        { name:'Qualified',   count:28, value:240000, color:'#818cf8' },
        { name:'Proposal',    count:15, value:180000, color:'#fbbf24' },
        { name:'Negotiation', count:8,  value:305000, color:'#a78bfa' },
        { name:'Won',         count:18, value:210000, color:'#34d399' },
      ],
      agentPerformance: [
        { name: 'Lead Scorer',     runs: 1420, success: 98.2, avgTime: '1.2s',  credits: 2840  },
        { name: 'Email Drafter',   runs: 842,  success: 96.8, avgTime: '3.4s',  credits: 5890  },
        { name: 'SEO Analyzer',    runs: 320,  success: 94.1, avgTime: '12.1s', credits: 9600  },
        { name: 'Sentiment Tagger',runs: 2100, success: 99.1, avgTime: '0.8s',  credits: 1680  },
      ],
      campaigns: [
        { name: 'Black Friday VIP',      sent: 14500, opens: 42.5, clicks: 18.2, conversions: 6.8 },
        { name: 'Abandoned Cart Series', sent: 320,   opens: 0,    clicks: 0,    conversions: 0   },
        { name: 'Q4 Newsletter',         sent: 22000, opens: 34.1, clicks: 11.4, conversions: 3.2 },
      ]
    });
  });

  // Campaigns
  app.get('/api/business/campaigns', async (req, res) => {
    try {
      const campaigns = await db.campaign.findMany({ where: { workspaceId: MOCK_WORKSPACE_ID }, orderBy: { updatedAt: 'desc' } });
      res.json(campaigns);
    } catch (e) { res.json(mockDb.campaigns); }
  });
  app.post('/api/business/campaigns', async (req, res) => {
    try {
      const campaign = await db.campaign.create({ data: { ...req.body, workspaceId: MOCK_WORKSPACE_ID } });
      res.json(campaign);
    } catch (e) { res.json({ ...req.body, id: Date.now().toString(), updatedAt: new Date().toISOString() }); }
  });
  app.put('/api/business/campaigns/:id', async (req, res) => {
    try {
      const campaign = await db.campaign.update({ where: { id: req.params.id }, data: req.body });
      res.json(campaign);
    } catch (e) { res.json({ ...mockDb.campaigns.find((c:any)=>c.id===req.params.id)||{}, ...req.body }); }
  });
  app.delete('/api/business/campaigns/:id', async (req, res) => {
    try {
      await db.campaign.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (e) { res.json({ success: true }); }
  });

  // Forms
  app.get('/api/business/forms', async (req, res) => {
    try {
      const forms = await db.form.findMany({ where: { workspaceId: MOCK_WORKSPACE_ID }, orderBy: { createdAt: 'desc' } });
      res.json(forms);
    } catch (e) { res.json(mockDb.forms); }
  });
  app.post('/api/business/forms', async (req, res) => {
    try {
      const form = await db.form.create({ data: { ...req.body, workspaceId: MOCK_WORKSPACE_ID } });
      res.json(form);
    } catch (e) { res.json({ ...req.body, id: Date.now().toString(), visits: 0, submissions: [], updatedAt: new Date().toISOString() }); }
  });
  app.get('/api/business/forms/:id/submissions', async (req, res) => {
    try {
      const submissions = await db.formSubmission.findMany({ where: { formId: req.params.id }, orderBy: { submittedAt: 'desc' } });
      res.json(submissions);
    } catch (e) { res.json([]); }
  });
  app.post('/api/business/forms/:id/submissions', async (req, res) => {
    try {
      const submission = await db.formSubmission.create({ data: { formId: req.params.id, data: JSON.stringify(req.body) } });
      await db.form.update({ where: { id: req.params.id }, data: { visits: { increment: 1 } } });
      res.json(submission);
    } catch (e) { res.json({ id: Date.now().toString(), submittedAt: new Date().toISOString() }); }
  });

  // Reviews (Reputation)
  app.get('/api/business/reviews', async (req, res) => {
    try {
      const reviews = await db.review.findMany({ where: { workspaceId: MOCK_WORKSPACE_ID }, orderBy: { date: 'desc' } });
      res.json(reviews);
    } catch (e) { res.json(mockDb.reviews); }
  });
  app.post('/api/business/reviews', async (req, res) => {
    try {
      const review = await db.review.create({ data: { ...req.body, workspaceId: MOCK_WORKSPACE_ID } });
      res.json(review);
    } catch (e) { res.json({ ...req.body, id: Date.now().toString(), date: new Date().toISOString() }); }
  });

  // Appointments (Calendar)
  app.get('/api/business/appointments', async (req, res) => {
    try {
      const appointments = await db.appointment.findMany({ where: { workspaceId: MOCK_WORKSPACE_ID }, include: { contact: true } });
      res.json(appointments);
    } catch (e) { res.json(mockDb.appointments); }
  });
  app.post('/api/business/appointments', async (req, res) => {
    try {
      const apt = await db.appointment.create({ data: { ...req.body, workspaceId: MOCK_WORKSPACE_ID } });
      res.json(apt);
    } catch (e) { res.json({ ...req.body, id: Date.now().toString() }); }
  });
  app.put('/api/business/appointments/:id', async (req, res) => {
    try {
      const apt = await db.appointment.update({ where: { id: req.params.id }, data: req.body });
      res.json(apt);
    } catch (e) { res.json({ ...req.body, id: req.params.id }); }
  });
  app.delete('/api/business/appointments/:id', async (req, res) => {
    try {
      await db.appointment.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (e) { res.json({ success: true }); }
  });

  // Inbox (Conversations)
  app.get('/api/business/conversations', async (req, res) => {
    try {
      const convos = await db.conversation.findMany({ 
        where: { workspaceId: MOCK_WORKSPACE_ID }, 
        include: { contact: true, messages: { take: 1, orderBy: { createdAt: 'desc' } } },
        orderBy: { updatedAt: 'desc' }
      });
      res.json(convos);
    } catch (e) { res.json(mockDb.conversations); }
  });
  app.post('/api/business/conversations', async (req, res) => {
    try {
      const convo = await db.conversation.create({ data: { ...req.body, workspaceId: MOCK_WORKSPACE_ID } });
      res.json(convo);
    } catch (e) { res.json({ ...req.body, id: Date.now().toString(), updatedAt: new Date().toISOString() }); }
  });
  app.get('/api/business/conversations/:id/messages', async (req, res) => {
    try {
      const messages = await db.conversationMessage.findMany({ where: { conversationId: req.params.id }, orderBy: { createdAt: 'asc' } });
      res.json(messages);
    } catch (e) { res.json((mockDb.messages as any)[req.params.id] || []); }
  });
  app.post('/api/business/conversations/:id/messages', async (req, res) => {
    try {
      const msg = await db.conversationMessage.create({ data: { ...req.body, conversationId: req.params.id } });
      await db.conversation.update({ where: { id: req.params.id }, data: { updatedAt: new Date() } });
      res.json(msg);
    } catch (e) { res.status(500).json({ error: 'Database error' }); }
  });

  // Agents
  app.use('/api/agents', agentsRouter);
  app.use('/api/voice-agents', voiceAgentsRouter);

  // Dashboard
  app.get('/api/crm/dashboard', async (req, res) => {
    try {
      const totalContacts = await db.contact.count({ where: { workspaceId: MOCK_WORKSPACE_ID } });
      const deals = await db.deal.findMany({ where: { workspaceId: MOCK_WORKSPACE_ID } });
      
      const openDeals = deals.filter(d => d.stage !== 'Won' && d.stage !== 'Lost').length;
      const openDealsValue = deals
        .filter(d => d.stage !== 'Won' && d.stage !== 'Lost')
        .reduce((sum, d) => sum + d.amount, 0);
      
      const wonDeals = deals.filter(d => d.stage === 'Won').length;
      const wonDealsValue = deals
        .filter(d => d.stage === 'Won')
        .reduce((sum, d) => sum + d.amount, 0);

      // Activities from today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const activitiesToday = await db.activity.count({
        where: { createdAt: { gte: today } }
      });

      const recentActivities = await db.activity.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' }
      });

      const topContacts = await db.contact.findMany({
        where: { workspaceId: MOCK_WORKSPACE_ID },
        take: 5,
        orderBy: { leadScore: 'desc' }
      });

      res.json({
        stats: {
          totalContacts,
          openDeals,
          openDealsValue: `$${openDealsValue.toLocaleString()}`,
          wonDeals,
          wonDealsValue: `$${wonDealsValue.toLocaleString()}`,
          activitiesToday
        },
        recentActivities,
        topContacts
      });
    } catch (e) {
      res.status(500).json({ error: 'Database error' });
    }
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
