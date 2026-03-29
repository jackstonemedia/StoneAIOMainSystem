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

// Mock database
const mockDb = {
  contacts: [
    { id: '1', name: 'Alice Freeman', title: 'VP of Engineering', company: 'Acme Corp', companyId: '1', email: 'alice@acmecorp.com', phone: '+1 (555) 123-4567', location: 'San Francisco, CA', leadScore: 85, lastContact: '2 days ago', about: 'Key decision maker for enterprise software purchases.' },
    { id: '2', name: 'Bob Smith', title: 'Director of IT', company: 'TechStart', companyId: '2', email: 'bob@techstart.io', phone: '+1 (555) 987-6543', location: 'Austin, TX', leadScore: 62, lastContact: '1 week ago', about: 'Looking to upgrade their current infrastructure.' },
  ],
  companies: [
    { id: '1', name: 'Acme Corp', website: 'acmecorp.com', industry: 'Manufacturing', location: 'San Francisco, CA', employees: '1,000-5,000', revenue: '$100M-$500M', description: 'Leading manufacturer of industrial equipment.' },
    { id: '2', name: 'TechStart', website: 'techstart.io', industry: 'Software', location: 'Austin, TX', employees: '50-200', revenue: '$10M-$50M', description: 'Fast-growing software startup.' },
  ],
  deals: [
    { id: '1', title: 'Q3 Enterprise License', amount: '$120,000', stage: 'Proposal', probability: 60, closeDate: 'Sep 30, 2026', company: 'Acme Corp', companyId: '1', contact: 'Alice Freeman', contactId: '1', owner: 'Jane Doe', description: 'Enterprise license for 500 users.' },
    { id: '2', title: 'Infrastructure Upgrade', amount: '$45,000', stage: 'Qualified', probability: 30, closeDate: 'Oct 15, 2026', company: 'TechStart', companyId: '2', contact: 'Bob Smith', contactId: '2', owner: 'John Smith', description: 'Server infrastructure upgrade.' },
  ],
  activities: [
    { id: '1', type: 'email', title: 'Sent proposal email', target: 'Alice Freeman', company: 'Acme Corp', date: 'Today, 10:30 AM' },
    { id: '2', type: 'call', title: 'Discovery call completed', target: 'Bob Smith', company: 'TechStart', date: 'Today, 9:00 AM' },
  ],
  pipelines: [
    { id: '1', name: 'Standard Sales', stages: [
      { id: 'lead', name: 'Lead', order: 0 },
      { id: 'qualified', name: 'Qualified', order: 1 },
      { id: 'proposal', name: 'Proposal', order: 2 },
      { id: 'negotiation', name: 'Negotiation', order: 3 },
      { id: 'won', name: 'Won', order: 4 },
    ]}
  ]
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

  // Campaigns
  app.get('/api/business/campaigns', async (req, res) => {
    try {
      const campaigns = await db.campaign.findMany({ where: { workspaceId: MOCK_WORKSPACE_ID }, orderBy: { updatedAt: 'desc' } });
      res.json(campaigns);
    } catch (e) { res.status(500).json({ error: 'Database error' }); }
  });
  app.post('/api/business/campaigns', async (req, res) => {
    try {
      const campaign = await db.campaign.create({ data: { ...req.body, workspaceId: MOCK_WORKSPACE_ID } });
      res.json(campaign);
    } catch (e) { res.status(500).json({ error: 'Database error' }); }
  });
  app.put('/api/business/campaigns/:id', async (req, res) => {
    try {
      const campaign = await db.campaign.update({ where: { id: req.params.id }, data: req.body });
      res.json(campaign);
    } catch (e) { res.status(500).json({ error: 'Database error' }); }
  });
  app.delete('/api/business/campaigns/:id', async (req, res) => {
    try {
      await db.campaign.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Database error' }); }
  });

  // Forms
  app.get('/api/business/forms', async (req, res) => {
    try {
      const forms = await db.form.findMany({ where: { workspaceId: MOCK_WORKSPACE_ID }, orderBy: { createdAt: 'desc' } });
      res.json(forms);
    } catch (e) { res.status(500).json({ error: 'Database error' }); }
  });
  app.post('/api/business/forms', async (req, res) => {
    try {
      const form = await db.form.create({ data: { ...req.body, workspaceId: MOCK_WORKSPACE_ID } });
      res.json(form);
    } catch (e) { res.status(500).json({ error: 'Database error' }); }
  });
  app.get('/api/business/forms/:id/submissions', async (req, res) => {
    try {
      const submissions = await db.formSubmission.findMany({ where: { formId: req.params.id }, orderBy: { submittedAt: 'desc' } });
      res.json(submissions);
    } catch (e) { res.status(500).json({ error: 'Database error' }); }
  });
  app.post('/api/business/forms/:id/submissions', async (req, res) => {
    try {
      const submission = await db.formSubmission.create({ data: { formId: req.params.id, data: JSON.stringify(req.body) } });
      await db.form.update({ where: { id: req.params.id }, data: { visits: { increment: 1 } } });
      res.json(submission);
    } catch (e) { res.status(500).json({ error: 'Database error' }); }
  });

  // Reviews (Reputation)
  app.get('/api/business/reviews', async (req, res) => {
    try {
      const reviews = await db.review.findMany({ where: { workspaceId: MOCK_WORKSPACE_ID }, orderBy: { date: 'desc' } });
      res.json(reviews);
    } catch (e) { res.status(500).json({ error: 'Database error' }); }
  });
  app.post('/api/business/reviews', async (req, res) => {
    try {
      const review = await db.review.create({ data: { ...req.body, workspaceId: MOCK_WORKSPACE_ID } });
      res.json(review);
    } catch (e) { res.status(500).json({ error: 'Database error' }); }
  });

  // Appointments (Calendar)
  app.get('/api/business/appointments', async (req, res) => {
    try {
      const appointments = await db.appointment.findMany({ where: { workspaceId: MOCK_WORKSPACE_ID }, include: { contact: true } });
      res.json(appointments);
    } catch (e) { res.status(500).json({ error: 'Database error' }); }
  });
  app.post('/api/business/appointments', async (req, res) => {
    try {
      const apt = await db.appointment.create({ data: { ...req.body, workspaceId: MOCK_WORKSPACE_ID } });
      res.json(apt);
    } catch (e) { res.status(500).json({ error: `Database error ${e}` }); }
  });
  app.put('/api/business/appointments/:id', async (req, res) => {
    try {
      const apt = await db.appointment.update({ where: { id: req.params.id }, data: req.body });
      res.json(apt);
    } catch (e) { res.status(500).json({ error: 'Database error' }); }
  });
  app.delete('/api/business/appointments/:id', async (req, res) => {
    try {
      await db.appointment.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Database error' }); }
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
    } catch (e) { res.status(500).json({ error: 'Database error' }); }
  });
  app.post('/api/business/conversations', async (req, res) => {
    try {
      const convo = await db.conversation.create({ data: { ...req.body, workspaceId: MOCK_WORKSPACE_ID } });
      res.json(convo);
    } catch (e) { res.status(500).json({ error: 'Database error' }); }
  });
  app.get('/api/business/conversations/:id/messages', async (req, res) => {
    try {
      const messages = await db.conversationMessage.findMany({ where: { conversationId: req.params.id }, orderBy: { createdAt: 'asc' } });
      res.json(messages);
    } catch (e) { res.status(500).json({ error: 'Database error' }); }
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
