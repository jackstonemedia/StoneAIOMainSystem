/**
 * Autonomous AI SDR API Routes
 *
 * Provides REST endpoints to manage SDR agents, research cycles,
 * lead dossiers, approval queues, and reply intent classification.
 */

import { Router } from 'express';
import { sdrStore } from '../services/sdr/sdr-store.js';
import {
  runSdrProspectingCycle,
  batchApproveSdrDossiers,
} from '../services/sdr/sdr-orchestrator.service.js';
import { classifyInboundReply } from '../services/sdr/reply-classifier.service.js';

export const sdrRouter = Router();

// ── GET /api/sdr/agents — List SDR agents for this workspace ─────────────────
sdrRouter.get('/agents', async (req: any, res) => {
  try {
    const workspaceId = req.workspaceId;
    const agents = await sdrStore.listAgents(workspaceId);
    res.json(agents);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch SDR agents' });
  }
});

// ── POST /api/sdr/agents — Create a new SDR agent ────────────────────────────
sdrRouter.post('/agents', async (req: any, res) => {
  try {
    const workspaceId = req.workspaceId;
    const {
      name,
      targetIcp,
      valueProposition,
      primaryOffer,
      calendarUrl,
      mode,
      dailyLimit,
      sequenceConfig,
    } = req.body;

    if (!name || !valueProposition || !primaryOffer) {
      return res.status(400).json({ error: 'Name, Value Proposition, and Primary Offer are required' });
    }

    const agent = await sdrStore.createAgent({
      workspaceId,
      name,
      targetIcp: targetIcp || {},
      valueProposition,
      primaryOffer,
      calendarUrl: calendarUrl || null,
      mode: mode === 'AUTOPILOT' ? 'AUTOPILOT' : 'COPILOT',
      status: 'ACTIVE',
      dailyLimit: Number(dailyLimit) || 35,
      sequenceConfig: sequenceConfig || {
        stepCount: 3,
        followUpDelayDays: [0, 3, 7],
        sendingWindow: { start: '09:00', end: '17:00', timezone: 'America/New_York' },
      },
    });

    res.status(201).json(agent);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create SDR agent' });
  }
});

// ── PATCH /api/sdr/agents/:id — Update SDR agent settings ─────────────────────
sdrRouter.patch('/agents/:id', async (req: any, res) => {
  try {
    const workspaceId = req.workspaceId;
    const { id } = req.params;
    const updates = req.body;

    const existing = await sdrStore.getAgent(id, workspaceId);
    if (!existing) {
      return res.status(404).json({ error: 'SDR agent not found' });
    }

    const updated = await sdrStore.updateAgent(id, {
      name: updates.name ?? existing.name,
      mode: updates.mode ?? existing.mode,
      status: updates.status ?? existing.status,
      dailyLimit: updates.dailyLimit ? Number(updates.dailyLimit) : existing.dailyLimit,
      valueProposition: updates.valueProposition ?? existing.valueProposition,
      primaryOffer: updates.primaryOffer ?? existing.primaryOffer,
      calendarUrl: updates.calendarUrl !== undefined ? updates.calendarUrl : existing.calendarUrl,
      targetIcp: updates.targetIcp ?? existing.targetIcp,
      sequenceConfig: updates.sequenceConfig ?? existing.sequenceConfig,
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update SDR agent' });
  }
});

// ── DELETE /api/sdr/agents/:id — Delete SDR agent ────────────────────────────
sdrRouter.delete('/agents/:id', async (req: any, res) => {
  try {
    const workspaceId = req.workspaceId;
    const { id } = req.params;

    const existing = await sdrStore.getAgent(id, workspaceId);
    if (!existing) {
      return res.status(404).json({ error: 'SDR agent not found' });
    }

    await sdrStore.deleteAgent(id);
    res.json({ success: true, message: 'Agent deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete SDR agent' });
  }
});

// ── GET /api/sdr/agents/:id/dossiers — Fetch dossiers and stats ───────────────
sdrRouter.get('/agents/:id/dossiers', async (req: any, res) => {
  try {
    const workspaceId = req.workspaceId;
    const { id } = req.params;

    const agent = await sdrStore.getAgent(id, workspaceId);
    if (!agent) {
      return res.status(404).json({ error: 'SDR agent not found' });
    }

    const dossiers = await sdrStore.listDossiers(id);

    // Compute live performance metrics
    const stats = {
      totalResearched: dossiers.length,
      pendingApproval: dossiers.filter((d: any) => d.status === 'DRAFTED').length,
      approvedAndSending: dossiers.filter((d: any) => d.status === 'APPROVED' || d.status === 'SENDING').length,
      engagedReplies: dossiers.filter((d: any) => d.status === 'ENGAGED').length,
      meetingsBooked: dossiers.filter((d: any) => d.status === 'MEETING_BOOKED').length,
      positiveReplyRate: dossiers.length > 0
        ? ((dossiers.filter((d: any) => d.status === 'ENGAGED' || d.status === 'MEETING_BOOKED').length / dossiers.length) * 100).toFixed(1)
        : '0.0',
    };

    res.json({ agent, stats, dossiers });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch dossiers' });
  }
});

// ── POST /api/sdr/agents/:id/trigger-cycle — Run autonomous research cycle ────
sdrRouter.post('/agents/:id/trigger-cycle', async (req: any, res) => {
  try {
    const workspaceId = req.workspaceId;
    const { id } = req.params;
    const limit = Number(req.body.limit) || 4;

    const result = await runSdrProspectingCycle(id, workspaceId, limit);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to run prospecting cycle' });
  }
});

// ── POST /api/sdr/agents/:id/approve-batch — Batch approve drafted outreach ───
sdrRouter.post('/agents/:id/approve-batch', async (req: any, res) => {
  try {
    const workspaceId = req.workspaceId;
    const { id } = req.params;
    const { dossierIds } = req.body;

    const result = await batchApproveSdrDossiers(id, workspaceId, dossierIds);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to approve dossiers' });
  }
});

// ── POST /api/sdr/classify-reply — Inbound reply intent classifier ────────────
sdrRouter.post('/classify-reply', async (req: any, res) => {
  try {
    const {
      prospectName,
      prospectEmail,
      originalOutreachSubject,
      originalOutreachBody,
      replyMessageText,
      calendarUrl,
    } = req.body;

    if (!replyMessageText) {
      return res.status(400).json({ error: 'replyMessageText is required' });
    }

    const classification = await classifyInboundReply({
      prospectName: prospectName || 'Prospect',
      prospectEmail: prospectEmail || 'prospect@example.com',
      originalOutreachSubject: originalOutreachSubject || 'Quick question',
      originalOutreachBody: originalOutreachBody || 'Outreach body',
      replyMessageText,
      calendarUrl,
    });

    res.json(classification);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to classify reply' });
  }
});
