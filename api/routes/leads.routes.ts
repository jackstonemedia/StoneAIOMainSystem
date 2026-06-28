/**
 * Leads Routes — Lead Studio
 * POST /api/leads/generate   - Start a lead generation job
 * GET  /api/leads/jobs       - List user's recent jobs
 * GET  /api/leads/jobs/:id   - Get job status + results
 * GET  /api/leads/quota      - Get user's daily quota
 * DELETE /api/leads/jobs/:id - Cancel / delete a job
 */

import { Router } from 'express';
import { db } from '../../infrastructure/database/client.js';
import { enqueueLeadJob } from '../services/leads/lead-worker.service.js';
import { getQuota } from '../services/leads/dedup.service.js';

const router = Router();

const DAILY_QUOTA = 500;

// POST /api/leads/generate
router.post('/generate', async (req, res) => {
  try {
    const { niche, area, maxLeads = 100 } = req.body;
    if (!niche || !area) {
      return res.status(400).json({ error: 'niche and area are required' });
    }

    const workspaceId = req.workspaceId;
    const userId = (req as any).auth?.userId || workspaceId;

    // Check quota
    const quota = await getQuota(workspaceId, userId);
    if (quota.leadsUsed >= DAILY_QUOTA) {
      return res.status(429).json({
        error: 'Daily quota reached',
        quota: { used: quota.leadsUsed, limit: DAILY_QUOTA, remaining: 0 },
      });
    }

    // Create job record
    const job = await (db as any).leadGenerationJob.create({
      data: {
        workspaceId,
        userId,
        niche: niche.trim(),
        area: area.trim(),
        maxLeads: Math.min(Number(maxLeads), 200),
        status: 'queued',
      },
    });

    // Enqueue
    await enqueueLeadJob({
      jobId: job.id,
      workspaceId,
      userId,
      niche: job.niche,
      area: job.area,
      maxLeads: job.maxLeads,
    });

    res.status(202).json({ jobId: job.id, status: 'queued' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/leads/jobs
router.get('/jobs', async (req, res) => {
  try {
    const jobs = await (db as any).leadGenerationJob.findMany({
      where: { workspaceId: req.workspaceId },
      orderBy: { queuedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        status: true,
        niche: true,
        area: true,
        maxLeads: true,
        leadsFound: true,
        leadsReturned: true,
        progressPct: true,
        message: true,
        errorMessage: true,
        queuedAt: true,
        startedAt: true,
        completedAt: true,
      },
    });
    res.json(jobs);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/leads/jobs/:id
router.get('/jobs/:id', async (req, res) => {
  try {
    const job = await (db as any).leadGenerationJob.findFirst({
      where: { id: req.params.id, workspaceId: req.workspaceId },
    });
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const leads = await (db as any).lead.findMany({
      where: { jobId: req.params.id },
      orderBy: { confidenceScore: 'desc' },
    });

    res.json({ ...job, leads });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/leads/jobs/:id
router.delete('/jobs/:id', async (req, res) => {
  try {
    await (db as any).lead.deleteMany({ where: { jobId: req.params.id, workspaceId: req.workspaceId } });
    await (db as any).leadGenerationJob.delete({ where: { id: req.params.id, workspaceId: req.workspaceId } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/leads/quota
router.get('/quota', async (req, res) => {
  try {
    const workspaceId = req.workspaceId;
    const userId = (req as any).auth?.userId || workspaceId;
    const quota = await getQuota(workspaceId, userId);
    res.json({
      used: quota.leadsUsed,
      requested: quota.leadsRequested,
      limit: DAILY_QUOTA,
      remaining: Math.max(0, DAILY_QUOTA - quota.leadsUsed),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/leads/export/:id — CSV export of a job's leads
router.get('/export/:id', async (req, res) => {
  try {
    const leads = await (db as any).lead.findMany({
      where: { jobId: req.params.id, workspaceId: req.workspaceId },
      orderBy: { confidenceScore: 'desc' },
    });

    const header = ['Business Name', 'Phone', 'Email', 'Website', 'Address', 'City', 'State', 'ZIP', 'Category', 'Confidence', 'Validated'];
    const rows = leads.map((l: any) => [
      l.businessName || '',
      l.phone || '',
      l.email || '',
      l.website || '',
      l.address || '',
      l.city || '',
      l.state || '',
      l.postalCode || '',
      l.category || '',
      l.confidenceScore || '',
      l.phoneValidated ? 'Yes' : 'No',
    ].map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(','));

    const csv = [header.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="leads-${req.params.id}.csv"`);
    res.send(csv);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
