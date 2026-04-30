/**
 * prisma/seed.ts
 * Run with: npx tsx prisma/seed.ts
 * Populates the database with a default workspace + realistic sample data.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const WORKSPACE_ID = 'ws_default_stone_aio';
const OWNER_ID     = 'user_dev_jack_stone';

async function main() {
  console.log('🌱 Seeding Stone AIO database...\n');

  // ── Workspace ──────────────────────────────────────────
  const workspace = await db.workspace.upsert({
    where: { id: WORKSPACE_ID },
    update: {},
    create: {
      id:      WORKSPACE_ID,
      name:    'Stone AIO',
      ownerId: OWNER_ID,
      plan:    'pro',
    },
  });
  console.log(`✅ Workspace: ${workspace.name}`);

  // ── Companies ──────────────────────────────────────────
  const companies = await Promise.all([
    db.company.upsert({ where: { id: 'co_acme' }, update: {}, create: { id: 'co_acme', workspaceId: WORKSPACE_ID, name: 'Acme Corp', website: 'acmecorp.com', industry: 'Manufacturing', location: 'San Francisco, CA', employees: '1,000-5,000', revenue: '$100M-$500M', description: 'Leading manufacturer of industrial equipment.' } }),
    db.company.upsert({ where: { id: 'co_techstart' }, update: {}, create: { id: 'co_techstart', workspaceId: WORKSPACE_ID, name: 'TechStart', website: 'techstart.io', industry: 'Software', location: 'Austin, TX', employees: '50-200', revenue: '$10M-$50M', description: 'Fast-growing B2B software startup.' } }),
    db.company.upsert({ where: { id: 'co_global' }, update: {}, create: { id: 'co_global', workspaceId: WORKSPACE_ID, name: 'Global Solutions', website: 'globalsol.com', industry: 'Consulting', location: 'Chicago, IL', employees: '500-1,000', revenue: '$50M-$100M', description: 'Management consulting firm.' } }),
    db.company.upsert({ where: { id: 'co_nexus' }, update: {}, create: { id: 'co_nexus', workspaceId: WORKSPACE_ID, name: 'Nexus LLC', website: 'nexusllc.com', industry: 'Logistics', location: 'Seattle, WA', employees: '200-500', revenue: '$20M-$50M', description: 'Regional logistics and distribution.' } }),
    db.company.upsert({ where: { id: 'co_bright' }, update: {}, create: { id: 'co_bright', workspaceId: WORKSPACE_ID, name: 'BrightCo', website: 'brightco.com', industry: 'Marketing', location: 'Miami, FL', employees: '10-50', revenue: '$1M-$5M', description: 'Digital marketing agency.' } }),
  ]);
  console.log(`✅ Companies: ${companies.length}`);

  // ── Contacts ──────────────────────────────────────────
  const contacts = await Promise.all([
    db.contact.upsert({ where: { id: 'ct_alice' },  update: {}, create: { id: 'ct_alice',  workspaceId: WORKSPACE_ID, companyId: 'co_acme',     firstName: 'Alice',  lastName: 'Freeman', email: 'alice@acmecorp.com',  phone: '+1 (555) 123-4567', location: 'San Francisco, CA', title: 'VP of Engineering',   leadScore: 98, status: 'hot',     tagsJson: JSON.stringify(['enterprise','vip']),        source: 'Outbound',    about: 'Key decision maker for enterprise software purchases.', color: '#7dd3fc' } }),
    db.contact.upsert({ where: { id: 'ct_bob' },    update: {}, create: { id: 'ct_bob',    workspaceId: WORKSPACE_ID, companyId: 'co_techstart', firstName: 'Bob',    lastName: 'Smith',   email: 'bob@techstart.io',   phone: '+1 (555) 987-6543', location: 'Austin, TX',         title: 'Director of IT',      leadScore: 74, status: 'warm',    tagsJson: JSON.stringify(['smb']),                     source: 'Inbound',     about: 'Looking to upgrade their current infrastructure.',     color: '#c4b5fd' } }),
    db.contact.upsert({ where: { id: 'ct_carol' },  update: {}, create: { id: 'ct_carol',  workspaceId: WORKSPACE_ID, companyId: 'co_global',   firstName: 'Carol',  lastName: 'Nguyen',  email: 'carol@globalsol.com', phone: '+1 (555) 234-5678', location: 'Chicago, IL',        title: 'CEO',                 leadScore: 92, status: 'hot',     tagsJson: JSON.stringify(['enterprise','ceo']),        source: 'Referral',    about: 'Interested in our enterprise tier.',                  color: '#86efac' } }),
    db.contact.upsert({ where: { id: 'ct_david' },  update: {}, create: { id: 'ct_david',  workspaceId: WORKSPACE_ID, companyId: 'co_nexus',    firstName: 'David',  lastName: 'Park',    email: 'david@nexusllc.com', phone: '+1 (555) 345-6789', location: 'Seattle, WA',        title: 'Head of Procurement', leadScore: 61, status: 'warm',    tagsJson: JSON.stringify(['mid-market']),              source: 'Google',      about: 'Evaluating vendors for Q4 purchase.',                 color: '#fde68a' } }),
    db.contact.upsert({ where: { id: 'ct_elena' },  update: {}, create: { id: 'ct_elena',  workspaceId: WORKSPACE_ID, companyId: 'co_bright',   firstName: 'Elena',  lastName: 'Torres',  email: 'elena@brightco.com', phone: '+1 (555) 456-7890', location: 'Miami, FL',          title: 'Marketing Director',  leadScore: 55, status: 'neutral', tagsJson: JSON.stringify(['marketing']),               source: 'LinkedIn',    about: 'Interested in our marketing automation.',             color: '#93c5fd', healthScore: 70, ownerId: OWNER_ID } }),
    db.contact.upsert({ where: { id: 'ct_frank' },  update: {}, create: { id: 'ct_frank',  workspaceId: WORKSPACE_ID, companyId: 'co_acme',     firstName: 'Frank',  lastName: 'Muller',  email: 'frank@apex.com',      phone: '+1 (555) 567-8901', location: 'New York, NY',       title: 'CTO',                 leadScore: 88, status: 'hot',     tagsJson: JSON.stringify(['enterprise','cto']),        source: 'Conference',  about: 'Met at SaaStr. Very interested in API access.',        color: '#d1d5db', healthScore: 85, ownerId: OWNER_ID } }),
    db.contact.upsert({ where: { id: 'ct_grace' },  update: {}, create: { id: 'ct_grace',  workspaceId: WORKSPACE_ID, companyId: 'co_techstart', firstName: 'Grace',  lastName: 'Kim',     email: 'grace@techstart.io', phone: '+1 (555) 678-9012', location: 'Austin, TX',         title: 'Product Manager',     leadScore: 49, status: 'cold',    tagsJson: JSON.stringify(['smb']),                     source: 'Inbound',     about: 'Evaluated last quarter but no budget then.',          color: '#a5b4fc', healthScore: 40, ownerId: OWNER_ID } }),
    db.contact.upsert({ where: { id: 'ct_henry' },  update: {}, create: { id: 'ct_henry',  workspaceId: WORKSPACE_ID, companyId: 'co_acme',     firstName: 'Henry',  lastName: 'Walsh',   email: 'henry@acmecorp.com',  phone: '+1 (555) 789-0123', location: 'San Francisco, CA', title: 'CFO',                 leadScore: 71, status: 'warm',    tagsJson: JSON.stringify(['enterprise','finance']),    source: 'Outbound',    about: 'Controls budget approvals for Acme.',                 color: '#fca5a5', healthScore: 75, ownerId: OWNER_ID } }),
    db.contact.upsert({ where: { id: 'ct_irene' },  update: {}, create: { id: 'ct_irene',  workspaceId: WORKSPACE_ID, companyId: 'co_nexus',    firstName: 'Irene',  lastName: 'Chang',   email: 'irene@nexusllc.com',  phone: '+1 (555) 890-1234', location: 'Seattle, WA',        title: 'VP of Operations',    leadScore: 65, status: 'warm',    tagsJson: JSON.stringify(['mid-market','ops']),        source: 'Webinar',     about: 'Looking to streamline warehouse operations.',         color: '#fdba74', healthScore: 80, ownerId: OWNER_ID } }),
    db.contact.upsert({ where: { id: 'ct_jack' },   update: {}, create: { id: 'ct_jack',   workspaceId: WORKSPACE_ID, companyId: 'co_global',   firstName: 'Jack',   lastName: 'OConnor', email: 'jack@globalsol.com',  phone: '+1 (555) 901-2345', location: 'Chicago, IL',        title: 'Partner',             leadScore: 85, status: 'hot',     tagsJson: JSON.stringify(['enterprise','partner']),    source: 'Referral',    about: 'Introduced by Carol. Wants a demo.',                  color: '#6ee7b7', healthScore: 90, ownerId: OWNER_ID } }),
    db.contact.upsert({ where: { id: 'ct_karen' },  update: {}, create: { id: 'ct_karen',  workspaceId: WORKSPACE_ID, companyId: 'co_bright',   firstName: 'Karen',  lastName: 'Lee',     email: 'karen@brightco.com',  phone: '+1 (555) 012-3456', location: 'Miami, FL',          title: 'Account Executive',   leadScore: 40, status: 'neutral', tagsJson: JSON.stringify(['marketing','sales']),       source: 'Inbound',     about: 'Interested in CRM tools for her team.',               color: '#f9a8d4', healthScore: 60, ownerId: OWNER_ID } }),
    db.contact.upsert({ where: { id: 'ct_liam' },   update: {}, create: { id: 'ct_liam',   workspaceId: WORKSPACE_ID, companyId: 'co_techstart', firstName: 'Liam',   lastName: 'Patel',   email: 'liam@techstart.io',  phone: '+1 (555) 123-9876', location: 'Austin, TX',         title: 'Lead Developer',      leadScore: 50, status: 'cold',    tagsJson: JSON.stringify(['smb','tech']),              source: 'Github',      about: 'Checking out our open source components.',            color: '#d8b4fe', healthScore: 55, ownerId: OWNER_ID } }),
  ]);
  console.log(`✅ Contacts: ${contacts.length}`);

  // ── Pipeline ──────────────────────────────────────────
  const pipeline = await db.pipeline.upsert({
    where: { id: 'pl_standard' },
    update: {},
    create: { id: 'pl_standard', workspaceId: WORKSPACE_ID, name: 'Standard Sales', isDefault: true },
  });
  const stages = await Promise.all([
    db.pipelineStage.upsert({ where: { id: 'ps_lead' },        update: {}, create: { id: 'ps_lead',        pipelineId: 'pl_standard', name: 'Lead',        color: '#64748b', order: 0, probability: 10  } }),
    db.pipelineStage.upsert({ where: { id: 'ps_qualified' },   update: {}, create: { id: 'ps_qualified',   pipelineId: 'pl_standard', name: 'Qualified',   color: '#818cf8', order: 1, probability: 30  } }),
    db.pipelineStage.upsert({ where: { id: 'ps_proposal' },    update: {}, create: { id: 'ps_proposal',    pipelineId: 'pl_standard', name: 'Proposal',    color: '#fbbf24', order: 2, probability: 60  } }),
    db.pipelineStage.upsert({ where: { id: 'ps_negotiation' }, update: {}, create: { id: 'ps_negotiation', pipelineId: 'pl_standard', name: 'Negotiation', color: '#a78bfa', order: 3, probability: 80  } }),
    db.pipelineStage.upsert({ where: { id: 'ps_won' },         update: {}, create: { id: 'ps_won',         pipelineId: 'pl_standard', name: 'Won',         color: '#34d399', order: 4, probability: 100 } }),
    db.pipelineStage.upsert({ where: { id: 'ps_lost' },        update: {}, create: { id: 'ps_lost',        pipelineId: 'pl_standard', name: 'Lost',        color: '#ef4444', order: 5, probability: 0   } }),
  ]);
  console.log(`✅ Pipeline: ${pipeline.name} (${stages.length} stages)`);

  // ── Deals ──────────────────────────────────────────────
  const deals = await Promise.all([
    db.deal.upsert({ where: { id: 'dl_1' }, update: {}, create: { id: 'dl_1', workspaceId: WORKSPACE_ID, companyId: 'co_acme',     contactId: 'ct_alice', pipelineStageId: 'ps_proposal',    title: 'Q3 Enterprise License',    amount: 120000, probability: 60, priority: 'high',   closeDate: new Date('2026-09-30'), ownerId: OWNER_ID, description: 'Enterprise license for 500 users.' } }),
    db.deal.upsert({ where: { id: 'dl_2' }, update: {}, create: { id: 'dl_2', workspaceId: WORKSPACE_ID, companyId: 'co_techstart', contactId: 'ct_bob',   pipelineStageId: 'ps_qualified',   title: 'Infrastructure Upgrade',   amount:  45000, probability: 30, priority: 'medium', closeDate: new Date('2026-10-15'), ownerId: OWNER_ID, description: 'Server infrastructure upgrade bundle.' } }),
    db.deal.upsert({ where: { id: 'dl_3' }, update: {}, create: { id: 'dl_3', workspaceId: WORKSPACE_ID, companyId: 'co_bright',   contactId: 'ct_elena', pipelineStageId: 'ps_negotiation', title: 'Marketing Automation',     amount:  28000, probability: 75, priority: 'high',   closeDate: new Date('2026-08-31'), ownerId: OWNER_ID, description: 'Full automation suite implementation.' } }),
    db.deal.upsert({ where: { id: 'dl_4' }, update: {}, create: { id: 'dl_4', workspaceId: WORKSPACE_ID, companyId: 'co_global',   contactId: 'ct_carol', pipelineStageId: 'ps_won',         title: 'Consulting Retainer',      amount:  72000, probability: 100,priority: 'high',   closeDate: new Date('2026-07-01'), ownerId: OWNER_ID, description: 'Annual consulting retainer.' } }),
    db.deal.upsert({ where: { id: 'dl_5' }, update: {}, create: { id: 'dl_5', workspaceId: WORKSPACE_ID, companyId: 'co_nexus',    contactId: 'ct_david', pipelineStageId: 'ps_lead',        title: 'Logistics Platform',       amount:  95000, probability: 15, priority: 'low',    closeDate: new Date('2026-11-30'), ownerId: OWNER_ID, description: 'Custom logistics tracking platform.' } }),
    db.deal.upsert({ where: { id: 'dl_6' }, update: {}, create: { id: 'dl_6', workspaceId: WORKSPACE_ID, companyId: 'co_techstart', contactId: 'ct_grace', pipelineStageId: 'ps_qualified',   title: 'API Access — Startup',     amount:  12000, probability: 45, priority: 'medium', closeDate: new Date('2026-09-15'), ownerId: OWNER_ID, description: 'Startup plan with full API access.' } }),
    db.deal.upsert({ where: { id: 'dl_7' }, update: {}, create: { id: 'dl_7', workspaceId: WORKSPACE_ID, companyId: 'co_acme',     contactId: 'ct_frank', pipelineStageId: 'ps_proposal',    title: 'Enterprise Expansion',     amount: 240000, probability: 55, priority: 'high',   closeDate: new Date('2026-10-01'), ownerId: OWNER_ID, description: 'Expanding existing license to 2,000 users.' } }),
    db.deal.upsert({ where: { id: 'dl_8' }, update: {}, create: { id: 'dl_8', workspaceId: WORKSPACE_ID, companyId: 'co_bright',   contactId: 'ct_elena', pipelineStageId: 'ps_won',         title: 'SMB Starter Pack',         amount:   8400, probability: 100,priority: 'low',    closeDate: new Date('2026-06-15'), ownerId: OWNER_ID, description: 'SMB starter kit with onboarding.' } }),
  ]);
  console.log(`✅ Deals: ${deals.length}`);

  // ── Tasks ──────────────────────────────────────────────
  const now = new Date();
  const tasks = await Promise.all([
    db.task.upsert({ where: { id: 'tk_1' }, update: {}, create: { id: 'tk_1', workspaceId: WORKSPACE_ID, contactId: 'ct_alice', title: 'Follow up on enterprise proposal', type: 'follow_up', priority: 'high',   status: 'pending', dueDate: new Date(now.getTime() + 0) } }),
    db.task.upsert({ where: { id: 'tk_2' }, update: {}, create: { id: 'tk_2', workspaceId: WORKSPACE_ID, contactId: 'ct_bob',   title: 'Send revised contract',            type: 'email',     priority: 'high',   status: 'overdue', dueDate: new Date(now.getTime() - 86400000) } }),
    db.task.upsert({ where: { id: 'tk_3' }, update: {}, create: { id: 'tk_3', workspaceId: WORKSPACE_ID, contactId: 'ct_carol', title: 'Initial discovery call',           type: 'call',      priority: 'medium', status: 'pending', dueDate: new Date(now.getTime() + 86400000) } }),
    db.task.upsert({ where: { id: 'tk_4' }, update: {}, create: { id: 'tk_4', workspaceId: WORKSPACE_ID, contactId: 'ct_david', title: 'Demo scheduling for procurement',  type: 'meeting',   priority: 'medium', status: 'pending', dueDate: new Date(now.getTime() + 172800000) } }),
    db.task.upsert({ where: { id: 'tk_5' }, update: {}, create: { id: 'tk_5', workspaceId: WORKSPACE_ID, contactId: 'ct_elena', title: 'Send pricing breakdown',          type: 'email',     priority: 'low',    status: 'pending', dueDate: new Date(now.getTime() + 259200000) } }),
    db.task.upsert({ where: { id: 'tk_6' }, update: {}, create: { id: 'tk_6', workspaceId: WORKSPACE_ID, contactId: 'ct_frank', title: 'Confirm technical requirements',  type: 'task',      priority: 'high',   status: 'completed', dueDate: new Date(now.getTime() - 172800000) } }),
  ]);
  console.log(`✅ Tasks: ${tasks.length}`);

  // ── Activities ─────────────────────────────────────────
  const activities = await Promise.all([
    db.activity.upsert({ where: { id: 'ac_1' }, update: {}, create: { id: 'ac_1', workspaceId: WORKSPACE_ID, dealId: 'dl_1', contactId: 'ct_alice', type: 'email',   title: 'Sent Q3 proposal email' } }),
    db.activity.upsert({ where: { id: 'ac_2' }, update: {}, create: { id: 'ac_2', workspaceId: WORKSPACE_ID, dealId: 'dl_2', contactId: 'ct_bob',   type: 'call',    title: 'Discovery call completed' } }),
    db.activity.upsert({ where: { id: 'ac_3' }, update: {}, create: { id: 'ac_3', workspaceId: WORKSPACE_ID, dealId: 'dl_4', contactId: 'ct_carol', type: 'meeting', title: 'Product demo — Enterprise tier' } }),
    db.activity.upsert({ where: { id: 'ac_4' }, update: {}, create: { id: 'ac_4', workspaceId: WORKSPACE_ID, dealId: 'dl_5', contactId: 'ct_david', type: 'note',    title: 'Added follow-up note' } }),
    db.activity.upsert({ where: { id: 'ac_5' }, update: {}, create: { id: 'ac_5', workspaceId: WORKSPACE_ID, dealId: 'dl_3', contactId: 'ct_elena', type: 'call',    title: 'Negotiation call' } }),
    db.activity.upsert({ where: { id: 'ac_6' }, update: {}, create: { id: 'ac_6', workspaceId: WORKSPACE_ID, dealId: 'dl_6', contactId: 'ct_grace', type: 'email',   title: 'Sent API documentation' } }),
    db.activity.upsert({ where: { id: 'ac_7' }, update: {}, create: { id: 'ac_7', workspaceId: WORKSPACE_ID, dealId: 'dl_7', contactId: 'ct_frank', type: 'meeting', title: 'Technical review meeting' } }),
    db.activity.upsert({ where: { id: 'ac_8' }, update: {}, create: { id: 'ac_8', workspaceId: WORKSPACE_ID, dealId: 'dl_8', contactId: 'ct_elena', type: 'note',    title: 'Onboarding kickoff complete' } }),
    db.activity.upsert({ where: { id: 'ac_9' }, update: {}, create: { id: 'ac_9', workspaceId: WORKSPACE_ID, dealId: 'dl_1', contactId: 'ct_henry', type: 'email',   title: 'Sent vendor assessment form' } }),
    db.activity.upsert({ where: { id: 'ac_10' }, update: {}, create: { id: 'ac_10', workspaceId: WORKSPACE_ID, dealId: 'dl_5', contactId: 'ct_irene', type: 'call',    title: 'Introductory call with operations' } }),
  ]);
  console.log(`✅ Activities: ${activities.length}`);

  // ── Campaigns ──────────────────────────────────────────
  const campaigns = await Promise.all([
    db.campaign.upsert({ where: { id: 'cm_1' }, update: {}, create: { id: 'cm_1', workspaceId: WORKSPACE_ID, name: 'Black Friday VIP Early Access',   type: 'email', status: 'sent',      audienceJson: JSON.stringify({count:14500}), metricsJson: JSON.stringify({openRate:42.5,clickRate:18.2,opens:6113,clicks:2639}) } }),
    db.campaign.upsert({ where: { id: 'cm_2' }, update: {}, create: { id: 'cm_2', workspaceId: WORKSPACE_ID, name: 'Abandoned Cart Recovery Series', type: 'email', status: 'sending',   audienceJson: JSON.stringify({count:320}),   metricsJson: JSON.stringify({openRate:0,clickRate:0}) } }),
    db.campaign.upsert({ where: { id: 'cm_3' }, update: {}, create: { id: 'cm_3', workspaceId: WORKSPACE_ID, name: 'Flash Sale SMS Blast',            type: 'sms',   status: 'scheduled', audienceJson: JSON.stringify({count:5800}),  metricsJson: JSON.stringify({openRate:0,clickRate:0}) } }),
    db.campaign.upsert({ where: { id: 'cm_4' }, update: {}, create: { id: 'cm_4', workspaceId: WORKSPACE_ID, name: 'Q4 Product Update Newsletter',    type: 'email', status: 'draft',     audienceJson: JSON.stringify({count:22000}), metricsJson: JSON.stringify({openRate:0,clickRate:0}) } }),
  ]);
  console.log(`✅ Campaigns: ${campaigns.length}`);

  // ── Forms ──────────────────────────────────────────────
  const forms = await Promise.all([
    db.form.upsert({ where: { id: 'fm_1' }, update: {}, create: { id: 'fm_1', workspaceId: WORKSPACE_ID, name: 'Contact Us',              schema: JSON.stringify([{id:'f1',type:'text',label:'Full Name',required:true},{id:'f2',type:'email',label:'Email',required:true},{id:'f4',type:'textarea',label:'Message',required:false}]), visits: 1240 } }),
    db.form.upsert({ where: { id: 'fm_2' }, update: {}, create: { id: 'fm_2', workspaceId: WORKSPACE_ID, name: 'Lead Magnet Download',    schema: JSON.stringify([{id:'f1',type:'text',label:'Full Name',required:true},{id:'f2',type:'email',label:'Email',required:true}]), visits: 3820 } }),
    db.form.upsert({ where: { id: 'fm_3' }, update: {}, create: { id: 'fm_3', workspaceId: WORKSPACE_ID, name: 'Event RSVP — Q4 Summit', schema: JSON.stringify([{id:'f1',type:'text',label:'Full Name',required:true},{id:'f2',type:'email',label:'Email',required:true},{id:'f3',type:'phone',label:'Phone',required:false}]), visits: 890 } }),
  ]);
  console.log(`✅ Forms: ${forms.length}`);

  // ── Reviews ────────────────────────────────────────────
  const reviews = await Promise.all([
    db.review.upsert({ where: { id: 'rv_1' }, update: {}, create: { id: 'rv_1', workspaceId: WORKSPACE_ID, author: 'Sarah Mitchell',  rating: 5, source: 'google',   text: 'Absolutely outstanding platform. The automation features have saved our team 20hrs/week.', replied: false } }),
    db.review.upsert({ where: { id: 'rv_2' }, update: {}, create: { id: 'rv_2', workspaceId: WORKSPACE_ID, author: 'James OBrien',    rating: 4, source: 'google',   text: 'Very impressed with the CRM features. The pipeline view is intuitive and the reporting is solid.', replied: true, replyText: 'Thank you James! We appreciate the feedback.' } }),
    db.review.upsert({ where: { id: 'rv_3' }, update: {}, create: { id: 'rv_3', workspaceId: WORKSPACE_ID, author: 'Priya Sharma',    rating: 5, source: 'facebook', text: 'Made the switch from GoHighLevel and never looked back. The AI assistant alone is worth the price.', replied: false } }),
    db.review.upsert({ where: { id: 'rv_4' }, update: {}, create: { id: 'rv_4', workspaceId: WORKSPACE_ID, author: 'Marcus Webb',     rating: 2, source: 'yelp',     text: 'Had some connectivity issues during onboarding. Support was helpful but took 2 days to resolve.', replied: true, replyText: 'We apologize for the inconvenience, Marcus. We have since improved our onboarding process.' } }),
    db.review.upsert({ where: { id: 'rv_5' }, update: {}, create: { id: 'rv_5', workspaceId: WORKSPACE_ID, author: 'Lisa Tanaka',     rating: 5, source: 'google',   text: 'The campaign builder is incredible. Open rates jumped from 18% to 38% after switching.', replied: false } }),
    db.review.upsert({ where: { id: 'rv_6' }, update: {}, create: { id: 'rv_6', workspaceId: WORKSPACE_ID, author: 'Derek Johnson',   rating: 4, source: 'google',   text: 'Solid enterprise tool. We use it for our entire sales workflow. Integration with Twilio works flawlessly.', replied: true, replyText: 'Thanks Derek! We are always working to improve our integrations.' } }),
    db.review.upsert({ where: { id: 'rv_7' }, update: {}, create: { id: 'rv_7', workspaceId: WORKSPACE_ID, author: 'Amanda Foster',   rating: 1, source: 'yelp',     text: 'Initial setup was confusing and documentation is lacking. Hope they improve the onboarding experience.', replied: false } }),
    db.review.upsert({ where: { id: 'rv_8' }, update: {}, create: { id: 'rv_8', workspaceId: WORKSPACE_ID, author: 'Chris Reynolds',  rating: 5, source: 'facebook', text: 'Best investment we made this year. The AI deal scoring alone increased our close rate by 22%.', replied: false } }),
  ]);
  console.log(`✅ Reviews: ${reviews.length}`);

  // ── Appointments ───────────────────────────────────────
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
  const apts = [];
  for (let d = 0; d < 5; d++) {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + d);
    apts.push(
      db.appointment.upsert({ where: { id: `apt_${d}_1` }, update: {}, create: { id: `apt_${d}_1`, workspaceId: WORKSPACE_ID, contactId: 'ct_alice', title: 'Discovery Call', type: 'call',    status: 'scheduled', startTime: new Date(new Date(day).setHours(10,0,0,0)), endTime: new Date(new Date(day).setHours(11,0,0,0)), location: 'Zoom' } }),
      db.appointment.upsert({ where: { id: `apt_${d}_2` }, update: {}, create: { id: `apt_${d}_2`, workspaceId: WORKSPACE_ID, contactId: 'ct_bob',   title: 'Product Demo',   type: 'meeting', status: 'scheduled', startTime: new Date(new Date(day).setHours(14,0,0,0)), endTime: new Date(new Date(day).setHours(15,0,0,0)), location: 'Google Meet' } }),
    );
  }
  const aptResults = await Promise.all(apts);
  console.log(`✅ Appointments: ${aptResults.length}`);

  // ── Conversations ─────────────────────────────────────
  const convos = await Promise.all([
    db.conversation.upsert({ where: { id: 'cv_1' }, update: {}, create: { id: 'cv_1', workspaceId: WORKSPACE_ID, contactId: 'ct_alice', channel: 'email', status: 'open',   unreadCount: 2 } }),
    db.conversation.upsert({ where: { id: 'cv_2' }, update: {}, create: { id: 'cv_2', workspaceId: WORKSPACE_ID, contactId: 'ct_bob',   channel: 'sms',   status: 'open',   unreadCount: 1 } }),
    db.conversation.upsert({ where: { id: 'cv_3' }, update: {}, create: { id: 'cv_3', workspaceId: WORKSPACE_ID, contactId: 'ct_carol', channel: 'chat',  status: 'closed', unreadCount: 0 } }),
    db.conversation.upsert({ where: { id: 'cv_4' }, update: {}, create: { id: 'cv_4', workspaceId: WORKSPACE_ID, contactId: 'ct_david', channel: 'email', status: 'open',   unreadCount: 3 } }),
    db.conversation.upsert({ where: { id: 'cv_5' }, update: {}, create: { id: 'cv_5', workspaceId: WORKSPACE_ID, contactId: 'ct_elena', channel: 'sms',   status: 'open',   unreadCount: 0 } }),
  ]);
  await Promise.all([
    db.conversationMessage.upsert({ where: { id: 'msg_1' }, update: {}, create: { id: 'msg_1', conversationId: 'cv_1', sender: 'contact', body: 'Hi! I wanted to follow up on the proposal you sent last week.', direction: 'inbound' } }),
    db.conversationMessage.upsert({ where: { id: 'msg_2' }, update: {}, create: { id: 'msg_2', conversationId: 'cv_1', sender: 'user',    body: "Of course! The Q3 Enterprise License proposal covers 500 seats. Happy to walk you through the pricing breakdown on a call?", direction: 'outbound' } }),
    db.conversationMessage.upsert({ where: { id: 'msg_3' }, update: {}, create: { id: 'msg_3', conversationId: 'cv_1', sender: 'contact', body: 'That would be great. Can we schedule for Thursday at 2pm?', direction: 'inbound' } }),
    db.conversationMessage.upsert({ where: { id: 'msg_4' }, update: {}, create: { id: 'msg_4', conversationId: 'cv_1', sender: 'user',    body: 'Thursday 2pm works perfectly. Sending over a calendar invite now!', direction: 'outbound' } }),
    db.conversationMessage.upsert({ where: { id: 'msg_5' }, update: {}, create: { id: 'msg_5', conversationId: 'cv_1', sender: 'contact', body: 'One more thing — can you include the API add-on pricing as well?', direction: 'inbound' } }),
    db.conversationMessage.upsert({ where: { id: 'msg_6' }, update: {}, create: { id: 'msg_6', conversationId: 'cv_2', sender: 'contact', body: 'Hey, saw your SMS blast about the Black Friday sale. What are the enterprise discounts?', direction: 'inbound' } }),
    db.conversationMessage.upsert({ where: { id: 'msg_7' }, update: {}, create: { id: 'msg_7', conversationId: 'cv_2', sender: 'user',    body: 'Hey Bob! Enterprise gets 25% off annual plans + dedicated support. Want me to send details?', direction: 'outbound' } }),
    db.conversationMessage.upsert({ where: { id: 'msg_8' }, update: {}, create: { id: 'msg_8', conversationId: 'cv_4', sender: 'user',    body: 'Following up on our conversation from the conference. Ready to move forward with procurement?', direction: 'outbound' } }),
    db.conversationMessage.upsert({ where: { id: 'msg_9' }, update: {}, create: { id: 'msg_9', conversationId: 'cv_4', sender: 'contact', body: 'Yes, we need a formal quote sent to our procurement team.', direction: 'inbound' } }),
  ]);
  console.log(`✅ Conversations: ${convos.length}`);

  // ── Custom Fields ──────────────────────────────────────
  const customFields = await Promise.all([
    db.customField.upsert({ where: { id: 'cf_1' }, update: {}, create: { id: 'cf_1', workspaceId: WORKSPACE_ID, entityType: 'contact', label: 'Birthday', type: 'date', order: 0 } }),
    db.customField.upsert({ where: { id: 'cf_2' }, update: {}, create: { id: 'cf_2', workspaceId: WORKSPACE_ID, entityType: 'contact', label: 'VIP Level', type: 'select', optionsJson: JSON.stringify(['Gold', 'Silver', 'Bronze']), order: 1 } }),
    db.customField.upsert({ where: { id: 'cf_3' }, update: {}, create: { id: 'cf_3', workspaceId: WORKSPACE_ID, entityType: 'deal', label: 'Expected ARR', type: 'number', order: 0 } }),
    db.customField.upsert({ where: { id: 'cf_4' }, update: {}, create: { id: 'cf_4', workspaceId: WORKSPACE_ID, entityType: 'deal', label: 'Competitors', type: 'text', order: 1 } }),
    db.customField.upsert({ where: { id: 'cf_5' }, update: {}, create: { id: 'cf_5', workspaceId: WORKSPACE_ID, entityType: 'company', label: 'Registration Number', type: 'text', order: 0 } }),
  ]);
  console.log(`✅ Custom Fields: ${customFields.length}`);

  // ── Tags ───────────────────────────────────────────────
  const tags = await Promise.all([
    db.tag.upsert({ where: { workspaceId_name: { workspaceId: WORKSPACE_ID, name: 'hot' } }, update: {}, create: { id: 'tg_1', workspaceId: WORKSPACE_ID, name: 'hot', color: '#ef4444' } }),
    db.tag.upsert({ where: { workspaceId_name: { workspaceId: WORKSPACE_ID, name: 'vip' } }, update: {}, create: { id: 'tg_2', workspaceId: WORKSPACE_ID, name: 'vip', color: '#eab308' } }),
    db.tag.upsert({ where: { workspaceId_name: { workspaceId: WORKSPACE_ID, name: 'follow-up' } }, update: {}, create: { id: 'tg_3', workspaceId: WORKSPACE_ID, name: 'follow-up', color: '#3b82f6' } }),
    db.tag.upsert({ where: { workspaceId_name: { workspaceId: WORKSPACE_ID, name: 'enterprise' } }, update: {}, create: { id: 'tg_4', workspaceId: WORKSPACE_ID, name: 'enterprise', color: '#8b5cf6' } }),
  ]);
  console.log(`✅ Tags: ${tags.length}`);

  // ── Smart Lists ────────────────────────────────────────
  const smartLists = await Promise.all([
    db.smartList.upsert({ where: { id: 'sl_1' }, update: {}, create: { id: 'sl_1', workspaceId: WORKSPACE_ID, name: 'Hot Leads', filtersJson: JSON.stringify([{ field: 'leadScore', operator: 'gt', value: 80 }]) } }),
    db.smartList.upsert({ where: { id: 'sl_2' }, update: {}, create: { id: 'sl_2', workspaceId: WORKSPACE_ID, name: 'Enterprise Contacts', filtersJson: JSON.stringify([{ field: 'tags', operator: 'contains', value: 'enterprise' }]) } }),
    db.smartList.upsert({ where: { id: 'sl_3' }, update: {}, create: { id: 'sl_3', workspaceId: WORKSPACE_ID, name: 'Recently Active', filtersJson: JSON.stringify([{ field: 'status', operator: 'in', value: ['warm', 'hot'] }]) } }),
  ]);
  console.log(`✅ Smart Lists: ${smartLists.length}`);

  console.log('\n✨ Seed complete! Database is ready.\n');
  console.log(`   Workspace ID : ${WORKSPACE_ID}`);
  console.log(`   Owner ID     : ${OWNER_ID}`);
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(() => db.$disconnect());
