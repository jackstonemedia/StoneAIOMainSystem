import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import workflowAiRouter from './api/workflow-ai.js';
import chatRouter from './api/chat.js';
import agentsRouter from './api/agents.js';
import voiceAgentsRouter from './api/voice-agents.js';
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
    } catch (e) { res.status(500).json({ error: 'Database error' }); }
  });
  
  app.get('/api/crm/contacts/:id', async (req, res) => {
    try {
      const contact = await db.contact.findUnique({ 
        where: { id: req.params.id },
        include: { company: true }
      });
      if (contact) res.json(contact);
      else res.status(404).json({ error: 'Not found' });
    } catch (e) { res.status(500).json({ error: 'Database error' }); }
  });

  app.put('/api/crm/contacts/:id', async (req, res) => {
    try {
      const contact = await db.contact.update({
        where: { id: req.params.id },
        data: req.body
      });
      res.json(contact);
    } catch (e) { res.status(404).json({ error: 'Not found' }); }
  });

  app.post('/api/crm/contacts', async (req, res) => {
    try {
      const contact = await db.contact.create({
        data: { ...req.body, workspaceId: MOCK_WORKSPACE_ID }
      });
      res.json(contact);
    } catch (e) { res.status(500).json({ error: 'Database error' }); }
  });

  // Companies
  app.get('/api/crm/companies', async (req, res) => {
    try {
      const companies = await db.company.findMany({ where: { workspaceId: MOCK_WORKSPACE_ID } });
      res.json(companies);
    } catch (e) { res.status(500).json({ error: 'Database error' }); }
  });

  app.get('/api/crm/companies/:id', async (req, res) => {
    try {
      const company = await db.company.findUnique({ where: { id: req.params.id } });
      if (company) res.json(company);
      else res.status(404).json({ error: 'Not found' });
    } catch (e) { res.status(500).json({ error: 'Database error' }); }
  });

  app.put('/api/crm/companies/:id', async (req, res) => {
    try {
      const company = await db.company.update({
        where: { id: req.params.id },
        data: req.body
      });
      res.json(company);
    } catch (e) { res.status(404).json({ error: 'Not found' }); }
  });

  app.post('/api/crm/companies', async (req, res) => {
    try {
      const company = await db.company.create({
        data: { ...req.body, workspaceId: MOCK_WORKSPACE_ID }
      });
      res.json(company);
    } catch (e) { res.status(500).json({ error: 'Database error' }); }
  });

  // Deals
  app.get('/api/crm/deals', async (req, res) => {
    try {
      const deals = await db.deal.findMany({
        include: { company: true }
      });
      res.json(deals);
    } catch (e) {
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
      else res.status(404).json({ error: 'Not found' });
    } catch (e) {
      res.status(500).json({ error: 'Database error' });
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
      res.status(404).json({ error: 'Not found' });
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
      res.status(500).json({ error: 'Database error' });
    }
  });

  app.post('/api/crm/activities', async (req, res) => {
    try {
      const activity = await db.activity.create({
        data: req.body
      });
      res.json(activity);
    } catch (e) {
      res.status(500).json({ error: 'Database error' });
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
