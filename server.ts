import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';

// Mock database
const db = {
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

  // --- API Routes ---

  // Contacts
  app.get('/api/crm/contacts', (req, res) => {
    res.json(db.contacts);
  });
  
  app.get('/api/crm/contacts/:id', (req, res) => {
    const contact = db.contacts.find(c => c.id === req.params.id);
    if (contact) res.json(contact);
    else res.status(404).json({ error: 'Not found' });
  });

  app.put('/api/crm/contacts/:id', (req, res) => {
    const index = db.contacts.findIndex(c => c.id === req.params.id);
    if (index !== -1) {
      db.contacts[index] = { ...db.contacts[index], ...req.body };
      res.json(db.contacts[index]);
    } else {
      res.status(404).json({ error: 'Not found' });
    }
  });

  // Companies
  app.get('/api/crm/companies', (req, res) => {
    res.json(db.companies);
  });

  app.get('/api/crm/companies/:id', (req, res) => {
    const company = db.companies.find(c => c.id === req.params.id);
    if (company) res.json(company);
    else res.status(404).json({ error: 'Not found' });
  });

  app.put('/api/crm/companies/:id', (req, res) => {
    const index = db.companies.findIndex(c => c.id === req.params.id);
    if (index !== -1) {
      db.companies[index] = { ...db.companies[index], ...req.body };
      res.json(db.companies[index]);
    } else {
      res.status(404).json({ error: 'Not found' });
    }
  });

  // Deals
  app.get('/api/crm/deals', (req, res) => {
    res.json(db.deals);
  });

  app.get('/api/crm/deals/:id', (req, res) => {
    const deal = db.deals.find(d => d.id === req.params.id);
    if (deal) res.json(deal);
    else res.status(404).json({ error: 'Not found' });
  });

  app.put('/api/crm/deals/:id', (req, res) => {
    const index = db.deals.findIndex(d => d.id === req.params.id);
    if (index !== -1) {
      db.deals[index] = { ...db.deals[index], ...req.body };
      res.json(db.deals[index]);
    } else {
      res.status(404).json({ error: 'Not found' });
    }
  });

  // Activities
  app.get('/api/crm/activities', (req, res) => {
    res.json(db.activities);
  });

  // Pipelines
  app.get('/api/crm/pipelines', (req, res) => {
    res.json(db.pipelines);
  });

  app.put('/api/crm/pipelines/:id', (req, res) => {
    const index = db.pipelines.findIndex(p => p.id === req.params.id);
    if (index !== -1) {
      db.pipelines[index] = { ...db.pipelines[index], ...req.body };
      res.json(db.pipelines[index]);
    } else {
      res.status(404).json({ error: 'Not found' });
    }
  });

  // Dashboard
  app.get('/api/crm/dashboard', (req, res) => {
    const totalContacts = db.contacts.length;
    const openDeals = db.deals.filter(d => d.stage !== 'Won' && d.stage !== 'Lost').length;
    const openDealsValue = db.deals
      .filter(d => d.stage !== 'Won' && d.stage !== 'Lost')
      .reduce((sum, d) => sum + parseInt(d.amount.replace(/[^0-9]/g, '') || '0'), 0);
    
    const wonDeals = db.deals.filter(d => d.stage === 'Won').length;
    const wonDealsValue = db.deals
      .filter(d => d.stage === 'Won')
      .reduce((sum, d) => sum + parseInt(d.amount.replace(/[^0-9]/g, '') || '0'), 0);

    const activitiesToday = db.activities.filter(a => a.date.includes('Today')).length;

    res.json({
      stats: {
        totalContacts,
        openDeals,
        openDealsValue: `$${openDealsValue.toLocaleString()}`,
        wonDeals,
        wonDealsValue: `$${wonDealsValue.toLocaleString()}`,
        activitiesToday
      },
      recentActivities: db.activities.slice(0, 5),
      topContacts: db.contacts.sort((a, b) => b.leadScore - a.leadScore).slice(0, 5)
    });
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
